import { WithId } from "mongodb";
import { Account } from "../../types/collection/account.type";
import { PhotoPostUploadParams, PhotoWithPreview } from "../../types/util.type";
import { urlGenerator } from "../../utils/functions";
import {
	getPhotoPostById,
	getPhotoPostCommentById,
	photoPostCommentUpload,
	photoPostUpload,
	updatePhotoPostComments,
} from "../../models/post/photo.model";
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
import { updateHashtagPostUse } from "../../models/hashTag.model";
import { getAccountById, getAccountByUserId } from "../../models/account.model";
import { updateLocationPostUse } from "../../models/location.model";
import { Comment, PhotoPost } from "../../types/collection/post.type";
import { AppError } from "../../constants/appError";
import HttpStatusCodes from "../../constants/HttpStatusCodes";
import {
	getMusicAudioApiResultById,
	getMusicAudioByApiId,
	updateMusicAudioPhotoUse,
	updateMusicAudioUsedSection,
	uploadMusicAudio,
} from "../../models/audio.model";

/**
 * Handles the service layer logic for uploading a photo post.
 *
 * This function transforms uploaded file metadata into a list of photo objects,
 * uploads the post within a transaction, updates related entities (location, hashtags, audio),
 * and prepares notifications for tagged accounts and mentioned users.
 *
 * @param {PhotoPostUploadParams} photoPostMetaData - Metadata related to the photo post, including caption, files, tags, and more.
 * @param {WithId<Account>} clientAccountInfo - Authenticated user's account information.
 * @returns {Promise<void>} A promise that resolves when the upload and related operations are completed.
 * @throws {Error} Throws if any part of the transaction or notification logic fails.
 */
export const photoPostUploadService = async (
	photoPostMetaData: PhotoPostUploadParams,
	clientAccountInfo: WithId<Account>
) => {
	try {
		const clientAccountId = clientAccountInfo._id.toString();
		let photoPostImageList: PhotoWithPreview[] = [];

		// Generate structured image info from the uploaded files
		for (const file of photoPostMetaData.postFileInfo) {
			photoPostImageList.push({
				uri: urlGenerator(file.fileName, "photo", "image"), // Full image URL
				width: file.width,
				height: file.height,
				blurhash: file.hash,
				preview: urlGenerator(file.fileName, "photo", "thumbnail"), // Thumbnail URL
			});
		}

		// Run all core post creation and related updates in a MongoDB transaction
		const photoPostInfo = await executeTransactionWithRetry<WithId<PhotoPost>>(
			databaseClient,
			async (session) => {
				if (photoPostMetaData.usedAudio) {
					const audioInfo = await getMusicAudioByApiId(
						photoPostMetaData.usedAudio.id
					);
					if (!audioInfo) {
						const musicApiResult = await getMusicAudioApiResultById(
							photoPostMetaData.usedAudio.id
						);
						if (!musicApiResult) {
							throw new AppError(
								"Audio not found",
								HttpStatusCodes.NOT_FOUND
							);
						}
						photoPostMetaData.usedAudio.id = await uploadMusicAudio(
							musicApiResult,
							session,
							photoPostMetaData.usedAudio.usedSection
						);
					} else {
						photoPostMetaData.usedAudio.id = audioInfo._id.toString();
					}
				}
				// Upload the post
				const photoPostInfo = await photoPostUpload(
					clientAccountId,
					photoPostMetaData,
					photoPostImageList,
					session
				);

				// Update usage count for tagged location if provided
				if (photoPostInfo.taggedLocation) {
					await updateLocationPostUse(
						photoPostInfo.taggedLocation.osmId,
						session
					);
				}

				// Update usage count for any hashtags in the post
				if (photoPostInfo.meta?.hashtags) {
					for (const hashTag of photoPostInfo.meta.hashtags) {
						await updateHashtagPostUse(hashTag, session);
					}
				}

				// Update audio usage count if an audio track is used
				if (photoPostInfo.usedAudio) {
					await updateMusicAudioPhotoUse(
						photoPostInfo.usedAudio.id.toString(),
						session
					);
					await updateMusicAudioUsedSection(
						photoPostInfo.usedAudio.id.toString(),
						photoPostInfo.usedAudio.usedSection,
						session
					);
				}

				return photoPostInfo;
			}
		);

		// Prepare notifications for any tagged accounts in the post
		if (photoPostInfo.taggedAccounts) {
			for (const accountTags of photoPostInfo.taggedAccounts) {
				const accountInfo = await getAccountById(
					accountTags.accountId.toString()
				);
				if (accountInfo) {
					let notificationMessage: FCMMessaging = {
						data: {
							postId: photoPostInfo._id.toString(),
						},
						notification: {
							title: clientAccountInfo.name,
							body: `${clientAccountInfo.name} tagged you in a post`,
							imageUrl: clientAccountInfo.profilePictureUri,
						},
						android: {
							priority: MessagePriority.HIGH,
							ttl: 86400, // 1 day
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
					// Uncomment to enable sending tag notifications
					// await sendMessageToTopic(notificationMessage);
				}
			}
		}

		// Prepare notifications for any mentioned users in the caption
		if (photoPostInfo.meta?.mentions) {
			for (const accountMentions of photoPostInfo.meta.mentions) {
				const accountInfo = await getAccountByUserId(accountMentions);
				if (accountInfo) {
					let notificationMessage: FCMMessaging = {
						data: {
							postId: photoPostInfo._id.toString(),
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
								channelId: NotificationChannelId.POST_UPLOAD,
								priority: NotificationPriority.HIGH,
								visibility: NotificationVisibility.PRIVATE,
								clickAction: NotificationAction.POST,
							},
						},
						topic: accountInfo.broadcastTopic,
					};
					// Uncomment to enable mention notifications
					// await sendMessageToTopic(notificationMessage);
				}
			}
		}
	} catch (error) {
		// Forward any thrown error to be handled by the calling function
		throw error;
	}
};

/**
 * Handles the process of uploading a comment to a photo post.
 *
 * This includes:
 * - Validating the post's existence and comment settings
 * - Verifying relationship and privacy access
 * - Uploading the comment within a transaction
 * - Sending notifications to mentioned users, the original post author, and the comment's parent (if it's a reply)
 *
 * @param {string} postId - The ID of the post being commented on.
 * @param {string} comment - The text content of the comment.
 * @param {WithId<Account>} clientAccountInfo - The account making the comment.
 * @param {string} [repliedTo] - Optional ID of the comment being replied to (in case of a nested comment).
 * @returns {Promise<void>} Resolves when comment upload and notifications are processed.
 * @throws {AppError} Throws 404 or 403 errors depending on access and post/comment state.
 */
export const photoPostCommentUploadService = async (
	postId: string,
	comment: string,
	clientAccountInfo: WithId<Account>,
	repliedTo?: string
) => {
	try {
		// Fetch the photo post to validate its existence and accessibility
		const photoPostInfo = await getPhotoPostById(postId);
		if (!photoPostInfo) {
			throw new AppError("Not found", HttpStatusCodes.NOT_FOUND);
		}

		// Check that the post is fully uploaded and viewable
		if (photoPostInfo.status !== "SUCCESSFULL") {
			throw new AppError("Not found", HttpStatusCodes.NOT_FOUND);
		}

		// Ensure comments are not disabled on this post
		if (photoPostInfo.advancedSettings.commentDisabled) {
			throw new AppError("Failed to upload", HttpStatusCodes.FORBIDDEN);
		}

		// Fetch the author of the post
		const userAccountInfo = await getAccountById(photoPostInfo.author.toString());
		if (!userAccountInfo) {
			throw new AppError("Not found", HttpStatusCodes.NOT_FOUND);
		}

		// Ensure the commenter is not blocked by the post author
		const accountBlockInfo = await isAccountBlocked(
			userAccountInfo._id.toString(),
			clientAccountInfo._id.toString()
		);
		if (accountBlockInfo) {
			throw new AppError("Not found", HttpStatusCodes.NOT_FOUND);
		}

		// Determine if the commenting user is allowed to comment on a private account's post
		const userFollowingInfo = await isAccountFollower(
			photoPostInfo.author.toString(),
			clientAccountInfo._id.toString()
		);

		// Proceed only if the author is public or the user follows the author
		if (
			(userAccountInfo.isPrivate && userFollowingInfo) ||
			!userAccountInfo.isPrivate
		) {
			// Upload comment inside a transaction
			const commentInfo = await executeTransactionWithRetry<WithId<Comment>>(
				databaseClient,
				async (session) => {
					const commentInfo = await photoPostCommentUpload(
						postId,
						comment,
						clientAccountInfo._id.toString(),
						session,
						repliedTo
					);
					await updatePhotoPostComments(postId, session);
					return commentInfo;
				}
			);

			// Notify mentioned users within the comment
			if (commentInfo.mentions) {
				for (const accountMentions of commentInfo.mentions) {
					const accountInfo = await getAccountByUserId(accountMentions);
					if (accountInfo) {
						let notificationMessage: FCMMessaging = {
							data: {
								postId: photoPostInfo._id.toString(),
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

			// Notify the user who was replied to, if applicable
			if (commentInfo.repliedTo) {
				const commentRepliedToInfo = await getPhotoPostCommentById(
					commentInfo.repliedTo.toString()
				);
				if (commentRepliedToInfo) {
					const accountInfo = await getAccountById(
						commentRepliedToInfo.author.toString()
					);
					if (accountInfo) {
						let notificationMessage: FCMMessaging = {
							data: {
								postId: photoPostInfo._id.toString(),
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

			// Notify post author (if commenter is not the author)
			if (photoPostInfo.author.toString() !== clientAccountInfo._id.toString()) {
				let notificationMessage: FCMMessaging = {
					data: {
						postId: photoPostInfo._id.toString(),
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
		// Pass the error to the higher-level handler
		throw error;
	}
};
