import { ClientSession, ObjectId, WithId } from "mongodb";
import { HighLight, Memory } from "../../types/collection/memory.type";
import { Caption, Content, MemoryUploadParams, Sticker } from "../../types/util.type";
import {
	getEmojis,
	getHashtags,
	getKeywords,
	getMentions,
	setExpirationTime,
} from "../../utils/functions";
import { isAccountBlocked, isAccountFollower } from "../../utils/dbUtils";
import { getTaggedLocationInfoByOsmId } from "../location.model";
import { getAccountByUserId } from "../account.model";
import { highlightCollection, memoryCollection } from "../index.model";
import { AppError } from "../../constants/appError";
import HttpStatusCodes from "../../constants/HttpStatusCodes";
import { getMusicAudioById } from "../audio.model";

/**
 * Uploads a memory object to the database, including captions, media content, mentions,
 * hashtags, emojis, location, sticker-based interactions (like polls or star ratings), and more.
 *
 * The function extracts relevant metadata (hashtags, mentions, keywords, etc.), validates mentions
 * and highlights, checks the existence of tagged locations, and constructs a full `Memory` object
 * which is then inserted into the memory collection.
 *
 * @param {string} clientAccountId - The ID of the account creating the memory.
 * @param {Content} memoryMedia - The media content (photo, video, etc.) associated with the memory.
 * @param {MemoryUploadParams} memoryMetadata - Metadata describing captions, location, audio, stickers, and more.
 *
 * @returns {Promise<WithId<Memory>>} The full memory document including the newly generated ID.
 *
 * @throws {AppError} If a referenced highlight or location is not found, or if insertion fails.
 */
export const memoryUpload = async (
	clientAccountId: string,
	memoryMedia: Content,
	memoryMetadata: MemoryUploadParams
): Promise<WithId<Memory>> => {
	try {
		let memoryInfo: Memory;
		let hashTags: Set<string> = new Set();
		let keywords: Set<string> = new Set();
		let mentions: Set<string> = new Set();
		let mentionsList: string[] = [];
		let emojis: Set<string> = new Set();
		let captions: Caption[] = [];
		let current = new Date();
		let addedHighlights: { highlight: ObjectId; timestamp: Date }[] = [];
		let sticker: Sticker | undefined;
		let isTaggedLocationVaild = false;
		let isUsedAudioValid = false;

		// Parse and transform captions while extracting metadata
		if (memoryMetadata.captions) {
			for (const caption of memoryMetadata.captions) {
				getKeywords(caption.text).map((keyword) => keywords.add(keyword));
				getHashtags(caption.text).map((hashtag) => hashTags.add(hashtag));
				getMentions(caption.text).map((mention) => mentions.add(mention));
				getEmojis(caption.text).map((emoji) => emojis.add(emoji));

				// Construct caption object for memory
				captions.push({
					text: caption.text,
					animation: caption.enteringAnimation,
					appearence: { color: caption.color, style: caption.style },
					fontFamily: caption.fontFamily,
					transform: {
						rotation: caption.rotation,
						scale: caption.scale,
						translation: {
							x: caption.position.x,
							y: caption.position.y,
						},
					},
					zIndex: caption.zIndex,
				});
			}
		}

		// Validate mentions based on privacy settings and block status
		if (mentions.size) {
			for (let mention of mentions) {
				const accountInfo = await getAccountByUserId(mention);
				if (accountInfo) {
					const isBlocked = await isAccountBlocked(
						accountInfo._id.toString(),
						clientAccountId
					);
					if (!isBlocked) {
						if (accountInfo.privacySettings.allowMentions === "everyone") {
							mentionsList.push(mention);
						} else if (
							accountInfo.privacySettings.allowMentions === "following"
						) {
							const followingInfo = await isAccountFollower(
								clientAccountId,
								accountInfo._id.toString()
							);
							if (followingInfo) {
								mentionsList.push(mention);
							}
						}
					}
				}
			}
		}

		// Validate highlight references
		if (memoryMetadata.addedHighlights) {
			for (const highlightId in memoryMetadata.addedHighlights) {
				if (await getHighlightById(highlightId)) {
					addedHighlights.push({
						highlight: new ObjectId(highlightId),
						timestamp: current,
					});
				} else {
					throw new AppError("Highlight not found", HttpStatusCodes.NOT_FOUND);
				}
			}
		}

		// Add poll or star-rating sticker
		if (memoryMetadata.poll) {
			sticker = {
				type: "poll",
				color: memoryMetadata.poll.color,
				transform: {
					rotation: memoryMetadata.poll.rotation,
					scale: memoryMetadata.poll.scale,
					translation: {
						x: memoryMetadata.poll.position.x,
						y: memoryMetadata.poll.position.y,
					},
				},
				zIndex: memoryMetadata.poll.zIndex,
				text: memoryMetadata.poll.title,
				options: memoryMetadata.poll.options,
				responseSummary: {
					totalVotes: 0,
					voteCount: [],
				},
			};
		} else if (memoryMetadata.starRating) {
			sticker = {
				type: "star-rating",
				color: memoryMetadata.starRating.color,
				transform: {
					rotation: memoryMetadata.starRating.rotation,
					scale: memoryMetadata.starRating.scale,
					translation: {
						x: memoryMetadata.starRating.position.x,
						y: memoryMetadata.starRating.position.y,
					},
				},
				zIndex: memoryMetadata.starRating.zIndex,
				text: memoryMetadata.starRating.title,
				responseSummary: {
					ratingCounts: [],
					totalRatings: 0,
				},
			};
		}

		// Validate tagged location (OSM-based)
		if (memoryMetadata.taggedLocation) {
			const locationInfo = await getTaggedLocationInfoByOsmId(
				memoryMetadata.taggedLocation.osmId
			);
			if (locationInfo) {
				isTaggedLocationVaild = true;
			} else {
				throw new AppError("Location not found", HttpStatusCodes.NOT_FOUND);
			}
		}

		// Validate used audio
		if (memoryMetadata.usedAudioId) {
			const audioInfo = await getMusicAudioById(memoryMetadata.usedAudioId);
			if (audioInfo) {
				isUsedAudioValid = true;
			} else {
				throw new AppError("Audio not found", HttpStatusCodes.NOT_FOUND);
			}
		}

		// Construct the full Memory object
		memoryInfo = {
			createdAt: current,
			isDeleted: false,
			author: new ObjectId(clientAccountId),
			expiredAt: setExpirationTime(current),
			content: memoryMedia,
			usedAudioId:
				memoryMetadata.usedAudioId && isUsedAudioValid
					? new ObjectId(memoryMetadata.usedAudioId)
					: undefined,
			captions: captions.length ? captions : undefined,
			sticker,
			taggedLocation:
				memoryMetadata.taggedLocation && isTaggedLocationVaild
					? {
							id: new ObjectId(memoryMetadata.taggedLocation.osmId),
							name: memoryMetadata.taggedLocation.name,
							appearence: {
								color: memoryMetadata.taggedLocation.color,
								style: memoryMetadata.taggedLocation.style,
							},
							transform: {
								scale: memoryMetadata.taggedLocation.scale,
								rotation: memoryMetadata.taggedLocation.rotation,
								translation: {
									x: memoryMetadata.taggedLocation.position.x,
									y: memoryMetadata.taggedLocation.position.y,
								},
							},
							zIndex: memoryMetadata.taggedLocation.zIndex,
					  }
					: undefined,
			link: memoryMetadata.link
				? {
						url: memoryMetadata.link.href,
						title: memoryMetadata.link.title,
						appearence: {
							color: memoryMetadata.link.color,
							style: memoryMetadata.link.style,
						},
						transform: {
							rotation: memoryMetadata.link.rotation,
							scale: memoryMetadata.link.scale,
							translation: {
								x: memoryMetadata.link.position.x,
								y: memoryMetadata.link.position.y,
							},
						},
						zIndex: memoryMetadata.link.zIndex,
				  }
				: undefined,
			addedTo: memoryMetadata.addedHighlights ? addedHighlights : undefined,
			isBoomerang: memoryMetadata.isBoomerang,
			advancedOptions: {
				replySetting: memoryMetadata.replyMode,
				reactionSetting: memoryMetadata.reactionMode,
			},
			engagementSummary: {
				noOfViews: 0,
				noOfLikes: 0,
				noOfReplies: 0,
				noOfShares: 0,
				noOfCirculations: 0,
			},
			meta: {
				hashtags: hashTags.size ? [...hashTags] : undefined,
				mentions: mentionsList.length ? mentionsList : undefined,
				keywords: keywords.size ? [...keywords] : undefined,
				emojis: emojis.size ? [...emojis] : undefined,
			},
		};

		// Insert memory document into the collection and return with _id
		const memoryId = (await memoryCollection.insertOne(memoryInfo)).insertedId;
		return { _id: memoryId, ...memoryInfo };
	} catch (error) {
		throw error;
	}
};

/**
 * Retrieves a memory document by its unique ID from the database.
 *
 * This function fetches a memory with the specified ID from the `memoryCollection`,
 * ensuring that the memory is not marked as deleted.
 *
 * @param {string} memoryId - The unique identifier of the memory to retrieve.
 * @returns {Promise<WithId<Memory> | null>} A promise that resolves to the memory document if found, or `null` if not.
 *
 * @throws {Error} If the provided ID is invalid or a database error occurs.
 */
export const getMemoryById = async (memoryId: string): Promise<WithId<Memory> | null> => {
	try {
		// Query the memory document by ID, excluding any that are marked as deleted
		const memoryInfo = await memoryCollection.findOne({
			_id: new ObjectId(memoryId),
			isDeleted: false,
		});
		return memoryInfo;
	} catch (error) {
		// Rethrow any errors encountered (e.g. invalid ID or DB issues)
		throw error;
	}
};

/**
 * Retrieves a highlight document by its unique ID from the database.
 *
 * This function queries the `highlightCollection` to find a highlight document
 * that matches the provided ID.
 *
 * @param {string} highlightId - The unique identifier of the highlight to retrieve.
 * @returns {Promise<HighLight | null>} A promise that resolves to the highlight document if found, or `null` if not found.
 *
 * @throws {Error} If the ID is invalid or if a database error occurs during the query.
 */
export const getHighlightById = async (
	highlightId: string
): Promise<HighLight | null> => {
	try {
		// Attempt to find the highlight document by its ObjectId
		const memoryInfo = await highlightCollection.findOne({
			_id: new ObjectId(highlightId),
		});
		return memoryInfo;
	} catch (error) {
		// Rethrow any errors encountered (e.g. invalid ID format, DB issues)
		throw error;
	}
};

/**
 * Increments the share count of a memory by 1.
 *
 * This function updates the `engagementSummary.noOfShares` field of a memory document
 * in the `memoryCollection` by increasing it by 1. The update is performed within the
 * provided MongoDB session to ensure it is part of a larger transaction if needed.
 *
 * @param {string} postId - The ID of the memory post whose share count is to be updated.
 * @param {ClientSession} session - The MongoDB client session used to perform the update within a transaction.
 * @returns {Promise<void>} A promise that resolves when the update operation completes.
 *
 * @throws {Error} If the update operation fails or the post ID is invalid.
 */
export const updateMemoryShares = async (
	postId: string,
	session: ClientSession
): Promise<void> => {
	try {
		// Increment the 'noOfShares' field in the engagement summary for the given memory
		await memoryCollection.updateOne(
			{ _id: new ObjectId(postId) }, // Filter by the memory's ObjectId
			{ $inc: { "engagementSummary.noOfShares": 1 } }, // Increment share count
			{ session } // Run within a transaction session
		);
	} catch (error) {
		// Propagate any error (e.g., invalid ObjectId or DB issue)
		throw error;
	}
};
