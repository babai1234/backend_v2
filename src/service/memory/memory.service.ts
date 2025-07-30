import { WithId } from "mongodb";
import {
	FCMMessaging,
	MessagePriority,
	NotificationAction,
	NotificationChannelId,
	NotificationPriority,
	NotificationVisibility,
} from "../../fcm/messaging";
import { sendMessageToTopic } from "../../fcm/oneToOneMessage";
import { getMemoryById, memoryUpload } from "../../models/memory/memory.model";
import { Content, MemoryUploadParams } from "../../types/util.type";
import { urlGenerator } from "../../utils/functions";
import { Account } from "../../types/collection/account.type";
import { getAccountByUserId } from "../../models/account.model";
import { executeTransactionWithRetry } from "../../utils/dbUtils";
import { databaseClient } from "../../models/index.model";
import {
	updateLocationMemoryUse,
	updateLocationPostUse,
} from "../../models/location.model";
import { updateHashtagMemoryUse } from "../../models/hashTag.model";
import { Memory } from "../../types/collection/memory.type";
import {
	getMusicAudioApiResultById,
	getMusicAudioByApiId,
	updateMusicAudioMemoryUse,
	uploadMusicAudio,
} from "../../models/audio.model";
import { AppError } from "../../constants/appError";
import HttpStatusCodes from "../../constants/HttpStatusCodes";

/**
 * Handles uploading a memory (photo or video), updating related metadata such as
 * tagged locations, hashtags, audio usage, and sending mention notifications.
 *
 * @param {MemoryUploadParams} memoryMetadata - The metadata of the memory being uploaded (media details, captions, location, mentions, etc.).
 * @param {WithId<Account>} clientAccountInfo - Account info of the user uploading the memory.
 * @returns {Promise<void>} Resolves once memory is uploaded and associated operations are complete.
 * @throws Will throw if any operation fails during the upload or update process.
 */
export const memoryUploadService = async (
	memoryMetaData: MemoryUploadParams,
	clientAccountInfo: WithId<Account>
): Promise<void> => {
	try {
		const clientAccountId = clientAccountInfo._id.toString();
		const memoryMedia = memoryMetaData.media;

		let memoryFileInfo: Content;

		// Generate memory content object depending on type: video or photo
		if (memoryMedia.type === "video") {
			memoryFileInfo = {
				type: "video",
				width: memoryMedia.width,
				height: memoryMedia.height,
				thumbnail: {
					url: urlGenerator(memoryMedia.fileName, "memory", "thumbnail"),
					width: memoryMedia.thumbnailWidth,
					height: memoryMedia.thumbnailHeight,
				},
				url: urlGenerator(memoryMedia.fileName, "memory", "video"),
				duration: memoryMedia.duration ?? 0,
			};
		} else {
			memoryFileInfo = {
				type: "photo",
				width: memoryMedia.width,
				height: memoryMedia.height,
				thumbnail: {
					url: urlGenerator(memoryMedia.fileName, "memory", "thumbnail"),
					width: memoryMedia.thumbnailWidth,
					height: memoryMedia.thumbnailHeight,
				},
				url: urlGenerator(memoryMedia.fileName, "memory", "image"),
			};
		}

		// Begin transaction to upload memory and update linked data
		const memoryInfo = await executeTransactionWithRetry<WithId<Memory>>(
			databaseClient,
			async (session) => {
				if (memoryMetaData.usedAudioId) {
					const audioInfo = await getMusicAudioByApiId(
						memoryMetaData.usedAudioId
					);
					if (!audioInfo) {
						const musicApiResult = await getMusicAudioApiResultById(
							memoryMetaData.usedAudioId
						);
						if (!musicApiResult) {
							throw new AppError(
								"Audio not found",
								HttpStatusCodes.NOT_FOUND
							);
						}
						memoryMetaData.usedAudioId = await uploadMusicAudio(
							musicApiResult,
							session
						);
					} else {
						memoryMetaData.usedAudioId = audioInfo._id.toString();
					}
				}
				// Upload memory to the database
				const memoryInfo = await memoryUpload(
					clientAccountId,
					memoryFileInfo,
					memoryMetaData
				);

				// If memory has a tagged location, update its usage stats
				if (memoryInfo.taggedLocation) {
					await updateLocationMemoryUse(
						memoryInfo.taggedLocation.id.toString(),
						session
					);
				}

				// Update all used hashtags' usage stats
				if (memoryInfo.meta?.hashtags) {
					for (const hashTag of memoryInfo.meta.hashtags) {
						await updateHashtagMemoryUse(hashTag, session);
					}
				}

				// Update audio usage stats if a sound was used
				if (memoryInfo.usedAudioId) {
					await updateMusicAudioMemoryUse(
						memoryInfo.usedAudioId.toString(),
						session
					);
				}

				// Return the newly inserted memory document
				return memoryInfo;
			}
		);

		// Notify users who were mentioned in the memory
		if (memoryInfo.meta.mentions?.length) {
			for (const userId of memoryInfo.meta.mentions) {
				const accountInfo = await getAccountByUserId(userId);
				if (accountInfo) {
					let recipientMessage: FCMMessaging = {
						data: {
							memoryId: memoryInfo._id.toString(),
						},
						notification: {
							title: clientAccountInfo.name,
							body: `${clientAccountInfo.name} mentioned you in a memory`,
							imageUrl: clientAccountInfo.profilePictureUri,
						},
						android: {
							priority: MessagePriority.HIGH,
							ttl: 86400, // 24 hours
							notification: {
								eventTimestamp: new Date(),
								channelId: NotificationChannelId.DIRECT_MESSAGE, // This channel ID may need to be reviewed
								priority: NotificationPriority.HIGH,
								visibility: NotificationVisibility.PRIVATE,
								clickAction: NotificationAction.MEMORY,
							},
						},
						topic: accountInfo.broadcastTopic,
					};
					// Send FCM push notification
					// await sendMessageToTopic(recipientMessage);
				}
			}
		}
	} catch (error) {
		// Propagate errors up the call stack for centralized error handling
		throw error;
	}
};
