import { WithId } from "mongodb";
import { Account } from "../../types/collection/account.type";
import {
	FileMetadata,
	MomentPostUploadParams,
	PostVideoParams,
} from "../../types/util.type";
import {
	executeTransactionWithRetry,
	isAccountBlocked,
	isAccountFollower,
} from "../../utils/dbUtils";
import {
	FCMMessaging,
	MessagePriority,
	NotificationAction,
	NotificationChannelId,
	NotificationPriority,
	NotificationVisibility,
} from "../../fcm/messaging";
import { sendMessageToTopic } from "../../fcm/oneToOneMessage";
import { databaseClient } from "../../models/index.model";
import { mcClient, momentPostJobGenerator, urlGenerator } from "../../utils/functions";
import {
	getMomentPostById,
	getMomentPostCommentById,
	momentPostCommentUpload,
	momentPostUpload,
	updateMomentPostComments,
} from "../../models/post/moment.model";
import {
	CreateJobCommand,
	CreateJobCommandInput,
	GetJobCommand,
} from "@aws-sdk/client-mediaconvert";
import { getAccountById, getAccountByUserId } from "../../models/account.model";
import { Comment, MomentPost } from "../../types/collection/post.type";
import { AppError } from "../../constants/appError";
import HttpStatusCodes from "../../constants/HttpStatusCodes";
import {
	getMusicAudioApiResultById,
	getMusicAudioByApiId,
	getOriginalAudioById,
	uploadMusicAudio,
	uploadOriginalAudio,
} from "../../models/audio.model";

/**
 * Handles the full lifecycle of uploading a "moment" post (short-form video).
 *
 * This includes:
 * - Generating video and thumbnail URLs
 * - Extracting or attaching audio if applicable
 * - Uploading the post metadata in a database transaction
 * - Generating and dispatching a media processing job
 * - Sending notifications to mentioned or tagged users
 *
 * @param {MomentPostUploadParams} momentPostMetaData - Metadata and file information for the moment post.
 * @param {WithId<Account>} clientAccountInfo - Authenticated account uploading the moment.
 * @returns {Promise<void>} Resolves when upload and background jobs are successfully initialized.
 * @throws Will propagate any error thrown during the process.
 */
export const momentPostUploadService = async (
	momentPostMetaData: MomentPostUploadParams,
	clientAccountInfo: WithId<Account>
) => {
	try {
		const clientAccountId = clientAccountInfo._id.toString();

		// Construct the video-related fields and URLs from the file name and metadata
		const momentPostVideoParams = {
			uri: urlGenerator(
				momentPostMetaData.postFileInfo.fileName,
				"moment",
				"stream"
			),
			duration: momentPostMetaData.postFileInfo.duration,
			muted: momentPostMetaData.isMute,
			poster: {
				blurhash: momentPostMetaData.postFileInfo.hash,
				width: momentPostMetaData.postFileInfo.width,
				height: momentPostMetaData.postFileInfo.height,
				uri: urlGenerator(
					momentPostMetaData.postFileInfo.fileName,
					"moment",
					"thumbnail"
				),
			},
			preview: urlGenerator(
				momentPostMetaData.postFileInfo.fileName,
				"moment",
				"preview"
			),
		} as PostVideoParams;

		let hasNewMusicAudio = false;

		// Create the post inside a transaction
		const momentPostInfo = await executeTransactionWithRetry<WithId<MomentPost>>(
			databaseClient,
			async (session) => {
				// If audio isn't already used and post isn't muted, extract original audio
				let audioId: string | undefined = undefined;
				if (!momentPostMetaData.usedAudio && !momentPostMetaData.isMute) {
					audioId = await uploadOriginalAudio(
						momentPostMetaData.postFileInfo.fileName,
						momentPostVideoParams.duration,
						clientAccountInfo,
						session
					);
				} else if (momentPostMetaData.usedAudio) {
					if (momentPostMetaData.usedAudio.type === "music") {
						const audioInfo = await getMusicAudioByApiId(
							momentPostMetaData.usedAudio.id
						);
						if (!audioInfo) {
							const musicApiResult = await getMusicAudioApiResultById(
								momentPostMetaData.usedAudio.id
							);
							if (!musicApiResult) {
								throw new AppError(
									"Audio not found",
									HttpStatusCodes.NOT_FOUND
								);
							}
							momentPostMetaData.usedAudio.id = await uploadMusicAudio(
								musicApiResult,
								session,
								momentPostMetaData.usedAudio.usedSection
							);
							hasNewMusicAudio = true;
						} else {
							momentPostMetaData.usedAudio.id = audioInfo._id.toString();
						}
					} else {
						const audioInfo = await getOriginalAudioById(
							momentPostMetaData.usedAudio.id
						);
						if (!audioInfo) {
							throw new AppError(
								"Audio not found",
								HttpStatusCodes.NOT_FOUND
							);
						}
					}
				}

				// Save the post to the database with audio reference (if any)
				const momentPostInfo = await momentPostUpload(
					clientAccountId,
					momentPostMetaData,
					momentPostVideoParams,
					session,
					audioId
				);
				return momentPostInfo;
			}
		);

		// Extract video metadata for job creation
		const fileMetaData: FileMetadata = {
			width: momentPostMetaData.postFileInfo.width,
			height: momentPostMetaData.postFileInfo.height,
			audioBitrate: momentPostMetaData.postFileInfo.audioBitrate,
			frameRate: momentPostMetaData.postFileInfo.frameRate,
			videoBitrate: momentPostMetaData.postFileInfo.videoBitrate,
		};

		// Determine if audio extraction should be done
		const shouldExtractAudio =
			!momentPostMetaData.usedAudio && !momentPostMetaData.isMute;

		// Generate job parameters for background processing
		const jobParams = momentPostJobGenerator(
			fileMetaData,
			momentPostMetaData.postFileInfo.fileName,
			shouldExtractAudio
		);

		// Create and dispatch the job to AWS MediaConvert
		const jobCommand = new CreateJobCommand({
			...jobParams,
			UserMetadata: {
				postType: "moment",
				postId: momentPostInfo._id.toString(),
				clientId: clientAccountId,
				hasNewAudio: String(shouldExtractAudio || hasNewMusicAudio),
				retryAttempts: String(0),
				bucketName: process.env.AWS_S3_BUCKET_NAME as string,
				fileName: momentPostMetaData.postFileInfo.fileName,
			},
		});
		await mcClient.send(jobCommand);

		// Notify all tagged users in the post
		if (momentPostInfo.taggedAccounts) {
			for (const accountTags of momentPostInfo.taggedAccounts) {
				const accountInfo = await getAccountById(accountTags.toString());
				if (accountInfo) {
					let notificationMessage: FCMMessaging = {
						data: {
							postId: momentPostInfo._id.toString(),
						},
						notification: {
							title: clientAccountInfo.name,
							body: `${clientAccountInfo.name} tagged you in a post`,
							imageUrl: clientAccountInfo.profilePictureUri,
						},
						android: {
							priority: MessagePriority.HIGH,
							ttl: 86400,
							notification: {
								eventTimestamp: new Date(),
								channelId: NotificationChannelId.POST_UPLOAD,
								priority: NotificationPriority.HIGH,
								visibility: NotificationVisibility.PRIVATE,
								clickAction: NotificationAction.POST,
							},
						},
						topic: accountInfo.broadcastTopic,
					};
					// await sendMessageToTopic(notificationMessage);
				}
			}
		}

		// Notify all mentioned users in the post metadata
		if (momentPostInfo.meta?.mentions) {
			for (const accountMentions of momentPostInfo.meta.mentions) {
				const accountInfo = await getAccountByUserId(accountMentions);
				if (accountInfo) {
					let notificationMessage: FCMMessaging = {
						data: {
							postId: momentPostInfo._id.toString(),
						},
						notification: {
							title: clientAccountInfo.name,
							body: `${clientAccountInfo.name} mentioned you in a post`,
							imageUrl: clientAccountInfo.profilePictureUri,
						},
						android: {
							priority: MessagePriority.HIGH,
							ttl: 86400,
							notification: {
								eventTimestamp: new Date(),
								channelId: NotificationChannelId.POST_UPLOAD, // Consider customizing this
								priority: NotificationPriority.HIGH,
								visibility: NotificationVisibility.PRIVATE,
								clickAction: NotificationAction.POST,
							},
						},
						topic: accountInfo.broadcastTopic,
					};
					// await sendMessageToTopic(notificationMessage);
				}
			}
		}
	} catch (error) {
		// Propagate any error to the caller
		throw error;
	}
};

/**
 * Handles uploading a comment to a moment post.
 *
 * The service validates the post status, commenting permissions, blocking, and privacy rules,
 * uploads the comment, and conditionally sends FCM notifications based on mentions, replies, and
 * post ownership.
 *
 * @param {string} postId - ID of the moment post being commented on.
 * @param {string} comment - The comment text.
 * @param {WithId<Account>} clientAccountInfo - The account making the comment.
 * @param {string} [repliedTo] - Optional comment ID if this is a reply to another comment.
 * @returns {Promise<void>} Resolves when the comment is uploaded and notifications are processed.
 * @throws {AppError} If the post is not found, comments are disabled, or access is restricted.
 */
export const momentPostCommentUploadService = async (
	postId: string,
	comment: string,
	clientAccountInfo: WithId<Account>,
	repliedTo?: string
): Promise<void> => {
	try {
		// Step 1: Fetch and validate the target moment post
		const momentPostInfo = await getMomentPostById(postId);
		if (!momentPostInfo) {
			throw new AppError("Not found", HttpStatusCodes.NOT_FOUND);
		}

		// Step 2: Ensure the post is successfully uploaded
		if (momentPostInfo.status !== "SUCCESSFULL") {
			throw new AppError("Not found", HttpStatusCodes.NOT_FOUND);
		}

		// Step 3: Check if commenting is allowed on the post
		if (momentPostInfo.advancedSettings.commentDisabled) {
			throw new AppError("Failed to upload", HttpStatusCodes.FORBIDDEN);
		}

		// Step 4: Fetch the post author
		const userAccountInfo = await getAccountById(momentPostInfo.author.toString());
		if (!userAccountInfo) {
			throw new AppError("Not found", HttpStatusCodes.NOT_FOUND);
		}

		// Step 5: Check if the commenter is blocked by the author
		const accountBlockInfo = await isAccountBlocked(
			userAccountInfo._id.toString(),
			clientAccountInfo._id.toString()
		);
		if (accountBlockInfo) {
			throw new AppError("Not found", HttpStatusCodes.NOT_FOUND);
		}

		// Step 6: Check if the user is following the author (if account is private)
		const userFollowingInfo = await isAccountFollower(
			momentPostInfo.author.toString(),
			clientAccountInfo._id.toString()
		);

		// Only allow comment if the post is public, or private but the commenter is a follower
		if (
			(userAccountInfo.isPrivate && userFollowingInfo) ||
			!userAccountInfo.isPrivate
		) {
			// Step 7: Upload the comment inside a transaction
			const commentInfo = await executeTransactionWithRetry<WithId<Comment>>(
				databaseClient,
				async (session) => {
					const commentInfo = await momentPostCommentUpload(
						postId,
						comment,
						clientAccountInfo._id.toString(),
						session,
						repliedTo
					);
					await updateMomentPostComments(postId, session);
					return commentInfo;
				}
			);

			// Step 8: Notify mentioned users in the comment
			if (commentInfo.mentions) {
				for (const accountMentions of commentInfo.mentions) {
					const accountInfo = await getAccountByUserId(accountMentions);
					if (accountInfo) {
						const notificationMessage: FCMMessaging = {
							data: {
								postId: momentPostInfo._id.toString(),
								commentId: commentInfo._id.toString(),
							},
							notification: {
								title: clientAccountInfo.name,
								body: `${clientAccountInfo.name} mentioned you in a comment`,
								imageUrl: clientAccountInfo.profilePictureUri,
							},
							android: {
								priority: MessagePriority.HIGH,
								ttl: 86400,
								notification: {
									eventTimestamp: new Date(),
									channelId: NotificationChannelId.POST_UPLOAD,
									priority: NotificationPriority.HIGH,
									visibility: NotificationVisibility.PRIVATE,
									clickAction: NotificationAction.POST,
								},
							},
							topic: accountInfo.broadcastTopic,
						};
						// await sendMessageToTopic(notificationMessage);
					}
				}
			}

			// Step 9: Notify the author of the comment being replied to (if this is a reply)
			if (commentInfo.repliedTo) {
				const commentRepliedToInfo = await getMomentPostCommentById(
					commentInfo.repliedTo.toString()
				);
				if (commentRepliedToInfo) {
					const accountInfo = await getAccountById(
						commentRepliedToInfo.author.toString()
					);
					if (accountInfo) {
						const notificationMessage: FCMMessaging = {
							data: {
								postId: momentPostInfo._id.toString(),
								commentId: commentInfo._id.toString(),
							},
							notification: {
								title: clientAccountInfo.name,
								body: `${clientAccountInfo.name} replied to your comment`,
								imageUrl: clientAccountInfo.profilePictureUri,
							},
							android: {
								priority: MessagePriority.HIGH,
								ttl: 86400,
								notification: {
									eventTimestamp: new Date(),
									channelId: NotificationChannelId.POST_UPLOAD,
									priority: NotificationPriority.HIGH,
									visibility: NotificationVisibility.PRIVATE,
									clickAction: NotificationAction.POST,
								},
							},
							topic: userAccountInfo.broadcastTopic,
						};
						// await sendMessageToTopic(notificationMessage);
					}
				}
			}

			// Step 10: Notify the post author if the commenter isn't them
			if (momentPostInfo.author.toString() !== clientAccountInfo._id.toString()) {
				const notificationMessage: FCMMessaging = {
					data: {
						postId: momentPostInfo._id.toString(),
						commentId: commentInfo._id.toString(),
					},
					notification: {
						title: clientAccountInfo.name,
						body: `${clientAccountInfo.name} commented on your post`,
						imageUrl: clientAccountInfo.profilePictureUri,
					},
					android: {
						priority: MessagePriority.HIGH,
						ttl: 86400,
						notification: {
							eventTimestamp: new Date(),
							channelId: NotificationChannelId.POST_UPLOAD,
							priority: NotificationPriority.HIGH,
							visibility: NotificationVisibility.PRIVATE,
							clickAction: NotificationAction.POST,
						},
					},
					topic: userAccountInfo.broadcastTopic,
				};
				// await sendMessageToTopic(notificationMessage);
			}
		}
	} catch (error) {
		// Propagate error to caller
		throw error;
	}
};

/**
 * Retries a previously failed MediaConvert job by creating a new job with the same settings and metadata.
 *
 * The function retrieves the original job details using its ID, clones its configuration,
 * adds a retry attempt metadata flag, and submits a new job to the same queue.
 *
 * @param {string} jobId - The ID of the original MediaConvert job to retry.
 * @returns {Promise<string | undefined>} The new job ID if successfully created, otherwise undefined.
 * @throws {AppError} If the original job cannot be retrieved or the retry job fails to create.
 */
export async function postRetryUploadService(jobId: string): Promise<string | undefined> {
	try {
		// 1. Retrieve the original MediaConvert job by ID
		const getJobCommand = new GetJobCommand({ Id: jobId });
		const getJobResponse = await mcClient.send(getJobCommand);

		// Check if job exists
		if (!getJobResponse.Job) {
			const errorMessage = `Original job with ID ${jobId} not found.`;
			console.error(errorMessage);
			throw new AppError(
				"Something went wrong",
				HttpStatusCodes.INTERNAL_SERVER_ERROR
			);
		}

		// Extract necessary properties from the original job
		const originalJobSettings = getJobResponse.Job.Settings;
		const userMetaData = getJobResponse.Job.UserMetadata;
		const role = getJobResponse.Job.Role;

		// Ensure original job has settings
		if (!originalJobSettings) {
			const errorMessage = `Settings not found for job with ID ${jobId}.`;
			console.error(errorMessage);
			throw new AppError(
				"Something went wrong",
				HttpStatusCodes.INTERNAL_SERVER_ERROR
			);
		}

		// Ensure original job has metadata (used for identifying postId, etc.)
		if (!userMetaData) {
			const errorMessage = `User metadata not found for job with ID ${jobId}.`;
			console.error(errorMessage);
			throw new AppError(
				"Something went wrong",
				HttpStatusCodes.INTERNAL_SERVER_ERROR
			);
		}

		// 2. Prepare the parameters for the new retry job
		const createJobParams: CreateJobCommandInput = {
			Settings: {
				...originalJobSettings, // Reuse previous encoding settings
			},
			UserMetadata: {
				...userMetaData, // Retain any original metadata (e.g., postId)
				retryAttempts: String(1), // Optionally track retry attempts
			},
			Queue: getJobResponse.Job.Queue, // Reuse same job queue
			Role: role, // Required IAM role for MediaConvert job execution
			// Additional settings like Priority or Tags can also be copied/modified here if needed
		};

		// 3. Create the new MediaConvert job using the same parameters
		const createJobCommand = new CreateJobCommand(createJobParams);
		const createJobResponse = await mcClient.send(createJobCommand);

		// 4. Handle success or failure of new job creation
		if (createJobResponse.Job) {
			console.log(
				`Successfully created a new job for postId: ${userMetaData.postId}. New jobId: ${createJobResponse.Job.Id}`
			);
			return createJobResponse.Job.Id;
		} else {
			const errorMessage = `Failed to create a new job for postId: ${userMetaData.postId}.`;
			console.error(errorMessage);
			throw new AppError(
				"Something went wrong",
				HttpStatusCodes.INTERNAL_SERVER_ERROR
			);
		}
	} catch (error) {
		// Let the calling function handle the thrown error
		throw error;
	}
}
