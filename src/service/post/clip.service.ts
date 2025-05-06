import { WithId } from "mongodb";
import { Account } from "../../types/collection/account.type";
import {
	ClipPostUploadParams,
	FileMetadata,
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
import { clipPostJobGenerator, mcClient, urlGenerator } from "../../utils/functions";
import { getAccountById, getAccountByUserId } from "../../models/account.model";
import {
	clipPostCommentUpload,
	clipPostUpload,
	getClipPostById,
	getClipPostCommentById,
	updateClipPostComments,
} from "../../models/post/clip.model";
import { CreateJobCommand } from "@aws-sdk/client-mediaconvert";
import { ClipPost, Comment } from "../../types/collection/post.type";
import { AppError } from "../../constants/appError";
import HttpStatusCodes from "../../constants/HttpStatusCodes";

/**
 * Handles the creation and upload of a "clip" post.
 *
 * This includes saving post metadata to the database, constructing MediaConvert job parameters,
 * and sending tagged/mentioned user notifications (currently commented out).
 *
 * @param {ClipPostUploadParams} clipPostMetaData - Metadata about the clip post, including file info.
 * @param {WithId<Account>} clientAccountInfo - The account information of the user uploading the post.
 * @returns {Promise<void>} Resolves when the upload and job submission processes complete.
 * @throws Will throw if any step of the upload or processing pipeline fails.
 */
export const clipPostUploadService = async (
	clipPostMetaData: ClipPostUploadParams,
	clientAccountInfo: WithId<Account>
): Promise<void> => {
	try {
		const clientAccountId = clientAccountInfo._id.toString();

		// Construct the video parameters for the post
		const clipPostVideoParams = {
			uri: urlGenerator(clipPostMetaData.postFileInfo.fileName, "clip", "stream"),
			duration: clipPostMetaData.postFileInfo.duration,
			poster: {
				blurhash: clipPostMetaData.postFileInfo.hash,
				width: clipPostMetaData.postFileInfo.width,
				height: clipPostMetaData.postFileInfo.height,
				uri: urlGenerator(
					clipPostMetaData.postFileInfo.fileName,
					"clip",
					"thumbnail"
				),
			},
			preview: urlGenerator(
				clipPostMetaData.postFileInfo.fileName,
				"clip",
				"preview"
			),
		} as PostVideoParams;

		// Save the post in a transactional operation
		const clipPostInfo = await executeTransactionWithRetry<WithId<ClipPost>>(
			databaseClient,
			async (session) => {
				// Upload the clip post to the database
				const clipPostInfo = await clipPostUpload(
					clientAccountId,
					clipPostMetaData,
					clipPostVideoParams,
					session
				);
				return clipPostInfo;
			}
		);

		// Prepare metadata to send to MediaConvert
		const fileMetaData: FileMetadata = {
			width: clipPostMetaData.postFileInfo.width,
			height: clipPostMetaData.postFileInfo.height,
			audioBitrate: clipPostMetaData.postFileInfo.audioBitrate,
			frameRate: clipPostMetaData.postFileInfo.frameRate,
			videoBitrate: clipPostMetaData.postFileInfo.videoBitrate,
		};

		// Generate MediaConvert job parameters
		const jobParams = clipPostJobGenerator(
			fileMetaData,
			clipPostMetaData.postFileInfo.fileName
		);

		// Submit the MediaConvert job with user metadata
		const jobCommand = new CreateJobCommand({
			...jobParams,
			UserMetadata: {
				postType: "clip",
				postId: clipPostInfo._id.toString(),
				clientId: clientAccountId,
				retryAttempts: String(0), // initial upload, not a retry
				bucketName: process.env.AWS_S3_BUCKET_NAME as string,
				fileName: clipPostMetaData.postFileInfo.fileName,
			},
		});
		await mcClient.send(jobCommand);

		// Handle notifications for tagged accounts (e.g., "tagged you in a post")
		if (clipPostInfo.taggedAccounts) {
			for (const accountTags of clipPostInfo.taggedAccounts) {
				const accountInfo = await getAccountById(accountTags.toString());
				if (accountInfo) {
					let notificationMessage: FCMMessaging = {
						data: {
							postId: clipPostInfo._id.toString(),
						},
						notification: {
							title: clientAccountInfo.name,
							body: `${clientAccountInfo.name} tagged you in a post`,
							imageUrl: clientAccountInfo.profilePictureUri,
						},
						android: {
							priority: MessagePriority.HIGH,
							ttl: 86400, // 24 hours in seconds
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

		// Handle notifications for mentioned accounts (e.g., "mentioned you in a post")
		if (clipPostInfo.meta?.mentions) {
			for (const accountMentions of clipPostInfo.meta.mentions) {
				const accountInfo = await getAccountByUserId(accountMentions);
				if (accountInfo) {
					let notificationMessage: FCMMessaging = {
						data: {
							postId: clipPostInfo._id.toString(),
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
								channelId: NotificationChannelId.POST_UPLOAD, // You may want to use a different channel
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
		// Propagate error to the caller
		throw error;
	}
};

/**
 * Handles uploading a comment to a clip post. Validates post state, account permissions,
 * and handles notifications for mentions, replies, and comment actions.
 *
 * @param {string} postId - ID of the clip post being commented on.
 * @param {string} comment - The comment text.
 * @param {WithId<Account>} clientAccountInfo - Account information of the user making the comment.
 * @param {string} [repliedTo] - Optional ID of the comment being replied to.
 * @returns {Promise<void>} Resolves when comment is successfully uploaded and notifications are queued.
 * @throws Will throw an error if validation fails or the upload operation encounters issues.
 */
export const clipPostCommentUploadService = async (
	postId: string,
	comment: string,
	clientAccountInfo: WithId<Account>,
	repliedTo?: string
): Promise<void> => {
	try {
		// 1. Fetch the clip post
		const clipPostInfo = await getClipPostById(postId);
		if (!clipPostInfo) {
			throw new AppError("Not found", HttpStatusCodes.NOT_FOUND);
		}

		// 2. Ensure the post is fully processed and not in a failed or pending state
		if (clipPostInfo.status !== "SUCCESSFULL") {
			throw new AppError("Not found", HttpStatusCodes.NOT_FOUND);
		}

		// 3. Reject comments if comments are disabled by the author
		if (clipPostInfo.advancedSettings.commentDisabled) {
			throw new AppError("Failed to upload", HttpStatusCodes.FORBIDDEN);
		}

		// 4. Fetch the post author's account
		const userAccountInfo = await getAccountById(clipPostInfo.author.toString());
		if (!userAccountInfo) {
			throw new AppError("Not found", HttpStatusCodes.NOT_FOUND);
		}

		// 5. Ensure commenter is not blocked by the post author
		const accountBlockInfo = await isAccountBlocked(
			userAccountInfo._id.toString(),
			clientAccountInfo._id.toString()
		);
		if (accountBlockInfo) {
			throw new AppError("Not found", HttpStatusCodes.NOT_FOUND);
		}

		// 6. Check if user is allowed to comment based on the author's privacy settings
		const userFollowingInfo = await isAccountFollower(
			clipPostInfo.author.toString(),
			clientAccountInfo._id.toString()
		);
		if (
			(userAccountInfo.isPrivate && userFollowingInfo) ||
			!userAccountInfo.isPrivate
		) {
			// 7. Upload the comment inside a transaction
			const commentInfo = await executeTransactionWithRetry<WithId<Comment>>(
				databaseClient,
				async (session) => {
					const commentInfo = await clipPostCommentUpload(
						postId,
						comment,
						clientAccountInfo._id.toString(),
						session,
						repliedTo
					);
					await updateClipPostComments(postId, session);
					return commentInfo;
				}
			);

			// 8. Notify mentioned users in the comment
			if (commentInfo.mentions) {
				for (const accountMentions of commentInfo.mentions) {
					const accountInfo = await getAccountByUserId(accountMentions);
					if (accountInfo) {
						let notificationMessage: FCMMessaging = {
							data: {
								postId: clipPostInfo._id.toString(),
								commentId: commentInfo._id.toString(),
							},
							notification: {
								title: clientAccountInfo.name,
								body: `${clientAccountInfo.name} mentioned you in a comment`,
								imageUrl: clientAccountInfo.profilePictureUri,
							},
							android: {
								priority: MessagePriority.HIGH,
								ttl: 86400, // 24 hours
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

			// 9. Notify the author of the original comment (if this is a reply)
			if (commentInfo.repliedTo) {
				const commentRepliedToInfo = await getClipPostCommentById(
					commentInfo.repliedTo.toString()
				);
				if (commentRepliedToInfo) {
					const accountInfo = await getAccountById(
						commentRepliedToInfo.author.toString()
					);
					if (accountInfo) {
						let notificationMessage: FCMMessaging = {
							data: {
								postId: clipPostInfo._id.toString(),
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

			// 10. Notify the post author if the commenter is not the author
			if (clipPostInfo.author.toString() !== clientAccountInfo._id.toString()) {
				let notificationMessage: FCMMessaging = {
					data: {
						postId: clipPostInfo._id.toString(),
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
		// Propagate the error up the call stack
		throw error;
	}
};
