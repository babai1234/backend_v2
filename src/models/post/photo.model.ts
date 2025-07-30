import { ClientSession, ObjectId, WithId } from "mongodb";
import { Comment, PhotoPost } from "../../types/collection/post.type";
import {
	AccountTag,
	PhotoPostUploadParams,
	PhotoWithPreview,
} from "../../types/util.type";
import { isAccountBlocked, isAccountFollower } from "../../utils/dbUtils";
import { getEmojis, getHashtags, getKeywords, getMentions } from "../../utils/functions";
import { photoCollection, photoCommentCollection } from "../index.model";
import { getAccountById, getAccountByUserId } from "../account.model";
import { getTaggedLocationInfoByOsmId } from "../location.model";
import { AppError } from "../../constants/appError";
import HttpStatusCodes from "../../constants/HttpStatusCodes";
import { getMusicAudioById } from "../audio.model";

/**
 * Uploads a photo post with associated metadata, handling tags, locations, and audio sections.
 * Validates input data like hashtags, mentions, tagged accounts, audio section, and location.
 * Saves the photo post to the database and returns the inserted post.
 *
 * @param {string} clientAccountId - The ID of the client uploading the photo post.
 * @param {PhotoPostUploadParams} photoPostMetaData - The metadata related to the photo post (caption, location, tagged accounts, etc.).
 * @param {PhotoWithPreview[]} photoPostImageList - The list of photos to be uploaded, each containing image data and preview information.
 * @param {ClientSession} session - MongoDB session for transaction support.
 * @returns {Promise<WithId<PhotoPost>>} A promise that resolves with the inserted photo post, including the unique post ID.
 * @throws {Error} Throws error if validation fails for hashtags, mentions, tagged accounts, location, or audio.
 */
export const photoPostUpload = async (
	clientAccountId: string,
	photoPostMetaData: PhotoPostUploadParams,
	photoPostImageList: PhotoWithPreview[],
	session: ClientSession
): Promise<WithId<PhotoPost>> => {
	// Initialize variables to hold parsed data
	let photoPostInfo: PhotoPost;
	let hashTags: Set<string> = new Set<string>();
	let keywords: Set<string> = new Set<string>();
	let mentions: Set<string> = new Set<string>();
	let mentionsList: string[] = [];
	let emojis: Set<string> = new Set<string>();
	let isTaggedLocationVaild = false;
	let taggedAccounts: AccountTag[] = [];
	let isUsedAudioValid = false;
	let usedAudioInfo: { id: ObjectId; usedSection: [number, number] } | undefined =
		undefined;

	try {
		// Parse the caption for hashtags, keywords, mentions, and emojis
		if (photoPostMetaData.caption) {
			getKeywords(photoPostMetaData.caption).map((keyword) =>
				keywords.add(keyword)
			);
			getHashtags(photoPostMetaData.caption).map((hashtag) =>
				hashTags.add(hashtag)
			);
			getMentions(photoPostMetaData.caption).map((mention) =>
				mentions.add(mention)
			);
			getEmojis(photoPostMetaData.caption).map((emoji) => emojis.add(emoji));
		}

		// Process mentions: Check if the client is blocked and if the mention is allowed
		if (mentions.size) {
			for (let mention of mentions) {
				const accountInfo = await getAccountByUserId(mention);
				if (accountInfo) {
					// Check if the account is blocked and if the client is allowed to mention them
					if (
						!(await isAccountBlocked(
							accountInfo._id.toString(),
							clientAccountId
						))
					) {
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
						} else {
							continue; // Skip if mentions are not allowed
						}
					}
				}
			}
		}

		// Validate the location if tagged
		if (photoPostMetaData.taggedLocation) {
			const locationInfo = await getTaggedLocationInfoByOsmId(
				photoPostMetaData.taggedLocation.osmId
			);
			if (locationInfo) {
				isTaggedLocationVaild = true;
			} else {
				// Throw error if location is invalid
				throw new AppError("Failed to add location", HttpStatusCodes.NOT_FOUND);
			}
		}

		// Process tagged accounts: Ensure they are not blocked and are allowed to be tagged
		if (photoPostMetaData.taggedAccounts) {
			for (const accountTags of photoPostMetaData.taggedAccounts) {
				const accountInfo = await getAccountById(accountTags.accountId);
				if (!accountInfo) {
					throw new AppError("Failed to tag", HttpStatusCodes.NOT_FOUND);
				}
				if (
					!(await isAccountBlocked(accountInfo._id.toString(), clientAccountId))
				) {
					const allow = accountInfo.privacySettings.allowTags;
					const isFollower = await isAccountFollower(
						clientAccountId,
						accountInfo._id.toString()
					);
					if (allow === "everyone" || (allow === "following" && isFollower)) {
						taggedAccounts.push({
							accountId: new ObjectId(accountTags.accountId),
							position: accountTags.position,
						});
					} else {
						throw new AppError("Failed to tag", HttpStatusCodes.FORBIDDEN);
					}
				} else {
					throw new AppError("Failed to tag", HttpStatusCodes.NOT_FOUND);
				}
			}
		}

		// Validate the audio section if used
		if (photoPostMetaData.usedAudio) {
			const audioInfo = await getMusicAudioById(photoPostMetaData.usedAudio.id);
			if (audioInfo) {
				let audioStart = photoPostMetaData.usedAudio.usedSection[0];
				let audioEnd = photoPostMetaData.usedAudio.usedSection[1];
				// Ensure audio section is valid (start and end times are within duration and section length is at least 10 seconds)
				if (
					(audioStart < audioInfo.duration || audioStart >= 0) &&
					(audioEnd <= audioInfo.duration || audioEnd > 0) &&
					audioEnd - audioStart >= 10
				) {
					isUsedAudioValid = true;
					usedAudioInfo = {
						id: new ObjectId(photoPostMetaData.usedAudio.id),
						usedSection: photoPostMetaData.usedAudio.usedSection,
					};
				} else {
					// Throw error if audio section is invalid
					throw new AppError(
						"Failed to add audio",
						HttpStatusCodes.BAD_REQUEST
					);
				}
			} else {
				// Throw error if audio is not found
				throw new AppError("Failed to add audio", HttpStatusCodes.NOT_FOUND);
			}
		}

		// Construct the photo post information to insert into the database
		photoPostInfo = {
			createdAt: new Date(),
			caption: photoPostMetaData.caption,
			taggedLocation:
				photoPostMetaData.taggedLocation && isTaggedLocationVaild
					? {
							id: new ObjectId(),
							name: photoPostMetaData.taggedLocation.name,
							osmId: photoPostMetaData.taggedLocation.osmId,
					  }
					: undefined,
			engagementSummary: {
				noOfLikes: 0,
				noOfComments: 0,
				noOfViews: 0,
				noOfShares: 0,
			},
			advancedSettings: {
				commentDisabled: photoPostMetaData.advancedOptions.commentDisabled,
				hideLikesAndViewsCount: photoPostMetaData.advancedOptions.hideEngagement,
			},
			author: new ObjectId(clientAccountId),
			photos: photoPostImageList,
			taggedAccounts: taggedAccounts,
			usedAudio: isUsedAudioValid ? usedAudioInfo : undefined,
			meta:
				mentions || keywords || hashTags || emojis || photoPostMetaData.topics
					? {
							mentions: mentionsList.length ? mentionsList : undefined,
							keywords: keywords.size ? [...keywords] : undefined,
							hashtags: hashTags.size ? [...hashTags] : undefined,
							emojis: emojis.size ? [...emojis] : undefined,
							topics: photoPostMetaData.topics,
					  }
					: undefined,
			status: "SUCCESSFULL",
		};

		// Insert the photo post into the database and return the inserted post with its ID
		const postId = (await photoCollection.insertOne(photoPostInfo, { session }))
			.insertedId;
		return { _id: postId, ...photoPostInfo };
	} catch (error) {
		// Catch and throw any errors
		throw error;
	}
};

/**
 * Retrieves a photo post by its ID.
 *
 * @param {string} postId - The ID of the photo post to be fetched.
 * @returns {Promise<WithId<PhotoPost> | null>} A promise that resolves with the photo post data if found, otherwise null.
 */
export const getPhotoPostById = async (
	postId: string
): Promise<WithId<PhotoPost> | null> => {
	const photoPostInfo = await photoCollection.findOne({ _id: new ObjectId(postId) });
	return photoPostInfo;
};

/**
 * Increments the number of shares for a photo post.
 *
 * @param {string} postId - The ID of the photo post to update.
 * @param {ClientSession} session - The MongoDB session used for transactional consistency.
 * @returns {Promise<void>} A promise that resolves once the share count is updated.
 */
export const updatePhotoPostShares = async (
	postId: string,
	session: ClientSession
): Promise<void> => {
	await photoCollection.updateOne(
		{ _id: new ObjectId(postId) },
		{ $inc: { "engagementSummary.noOfShares": 1 } },
		{ session }
	);
};

/**
 * Increments the number of comments (`engagementSummary.noOfComments`) on a specific photo post.
 *
 * This function first verifies that the post exists. If it does not, it throws an `AppError`.
 * If the post exists, it uses the provided MongoDB session to safely increment the comment count
 * within a transactional context.
 *
 * @param {string} postId - The unique identifier of the photo post to update.
 * @param {ClientSession} session - The MongoDB session used to execute this operation in a transaction.
 * @returns {Promise<void>} - Resolves when the comment count has been successfully updated.
 * @throws {AppError} If the photo post is not found.
 * @throws Will propagate any unexpected errors during the update operation.
 */
export async function updatePhotoPostComments(postId: string, session: ClientSession) {
	try {
		// Fetch the photo post by its ID to ensure it exists
		const photoPostInfo = await getPhotoPostById(postId);
		if (!photoPostInfo) {
			// If the post doesn't exist, throw a custom error with a 404 status code
			throw new AppError("Failed to upload comment", HttpStatusCodes.NOT_FOUND);
		}

		// Increment the noOfComments field inside engagementSummary
		await photoCollection.updateOne(
			{ _id: new ObjectId(postId) }, // Filter to match the photo post by _id
			{ $inc: { "engagementSummary.noOfComments": 1 } }, // Increment comment count
			{ session } // Execute within the provided session for transactional safety
		);
	} catch (error) {
		// Propagate the error to the caller for handling
		throw error;
	}
}

/**
 * Uploads a comment for a photo post and handles mentions, keywords, and replies.
 *
 * @param {string} postId - The ID of the photo post to comment on.
 * @param {string} comment - The content of the comment.
 * @param {string} clientAccountId - The ID of the client posting the comment.
 * @param {ClientSession} session - The MongoDB session used for transactional consistency.
 * @param {string} [repliedTo] - The ID of the comment being replied to, if applicable.
 * @returns {Promise<WithId<Comment>>} A promise that resolves with the inserted comment information, including the comment ID.
 * @throws {Error} Throws an error if the reply comment is not found or any other error occurs.
 */
export const photoPostCommentUpload = async (
	postId: string,
	comment: string,
	clientAccountId: string,
	session: ClientSession,
	repliedTo?: string
): Promise<WithId<Comment>> => {
	let keywords: Set<string> = new Set<string>();
	let mentions: Set<string> = new Set<string>();
	let mentionsList: string[] = [];
	try {
		// Extract keywords and mentions from the comment
		getKeywords(comment).map((keyword) => keywords.add(keyword));
		getMentions(comment).map((mention) => mentions.add(mention));

		// Process mentions to ensure they are not blocked and are allowed to be mentioned
		if (mentions.size) {
			for (let mention of mentions) {
				const accountInfo = await getAccountByUserId(mention);
				if (accountInfo) {
					// Check if the client is blocked and if the mention is allowed based on account privacy settings
					if (
						!(await isAccountBlocked(
							accountInfo._id.toString(),
							clientAccountId
						))
					) {
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
						} else {
							continue; // Skip mentions that are not allowed
						}
					}
				}
			}
		}

		// Construct comment information object
		let postCommentInfo: Comment;
		if (repliedTo) {
			// If the comment is a reply, validate the original comment
			const commentRepliedToInfo = await photoCommentCollection.findOne({
				_id: new ObjectId(repliedTo),
			});
			if (!commentRepliedToInfo) {
				// Throw error if the reply target comment is not found
				throw new AppError("Not found", HttpStatusCodes.NOT_FOUND);
			}
			// Build the reply comment object
			postCommentInfo = {
				createdAt: new Date(),
				author: new ObjectId(clientAccountId),
				text: comment,
				postId: new ObjectId(postId),
				repliedTo: new ObjectId(repliedTo),
				mentions: mentionsList.length ? mentionsList : undefined,
				keywords: keywords.size ? [...keywords] : undefined,
				meta: {
					noOfLikes: 0,
					noOfReplies: 0,
				},
			};
		} else {
			// Build the regular comment object
			postCommentInfo = {
				createdAt: new Date(),
				author: new ObjectId(clientAccountId),
				text: comment,
				postId: new ObjectId(postId),
				mentions: mentionsList.length ? mentionsList : undefined,
				keywords: keywords.size ? [...keywords] : undefined,
				meta: {
					noOfLikes: 0,
					noOfReplies: 0,
				},
			};
		}

		// Insert the comment into the database
		const commentId = (
			await photoCommentCollection.insertOne(postCommentInfo, { session })
		).insertedId;

		// If replying to a comment, update the reply count on the original comment
		if (repliedTo) {
			await updatePhotoPostCommentReply(repliedTo, session);
		}

		// Return the inserted comment with its ID
		return { _id: commentId, ...postCommentInfo };
	} catch (error) {
		// Catch and throw any errors
		throw error;
	}
};

/**
 * Retrieves a photo post comment by its ID.
 *
 * @param {string} commentId - The ID of the comment to be fetched.
 * @returns {Promise<WithId<Comment> | null>} A promise that resolves with the comment data if found, otherwise null.
 */
export const getPhotoPostCommentById = async (
	commentId: string
): Promise<WithId<Comment> | null> => {
	try {
		// Find and return the comment by ID
		const commentInfo = await photoCommentCollection.findOne({
			_id: new ObjectId(commentId),
		});
		return commentInfo;
	} catch (error) {
		// Catch and throw any errors
		throw error;
	}
};

/**
 * Increments the number of replies for a comment on a photo post.
 *
 * @param {string} commentId - The ID of the comment to update.
 * @param {ClientSession} session - The MongoDB session used for transactional consistency.
 * @returns {Promise<void>} A promise that resolves once the reply count is updated.
 */
export const updatePhotoPostCommentReply = async (
	commentId: string,
	session: ClientSession
): Promise<void> => {
	try {
		// Increment the reply count for the specified comment
		await photoCommentCollection.updateOne(
			{ _id: new ObjectId(commentId) },
			{ $inc: { "meta.noOfReplies": 1 } },
			{ session }
		);
	} catch (error) {
		// Catch and throw any errors
		throw error;
	}
};
