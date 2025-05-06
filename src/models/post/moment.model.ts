import { ClientSession, ObjectId, WithId } from "mongodb";
import { Comment, MomentPost } from "../../types/collection/post.type";
import { isAccountBlocked, isAccountFollower } from "../../utils/dbUtils";
import { getEmojis, getHashtags, getKeywords, getMentions } from "../../utils/functions";
import {
	AccountTag,
	MomentPostUploadParams,
	PostVideoParams,
} from "../../types/util.type";
import { getAudioById } from "../audio.model";
import { getAccountById, getAccountByUserId } from "../account.model";
import { getTaggedLocationInfoByOsmId } from "../location.model";
import { momentCollection, momentCommentCollection } from "../index.model";
import HttpStatusCodes from "../../constants/HttpStatusCodes";
import { AppError } from "../../constants/appError";

/**
 * Uploads a moment post, including metadata, video details, and optional audio, location, and tagged accounts.
 *
 * @param {string} clientAccountId - The ID of the client account uploading the post.
 * @param {MomentPostUploadParams} momentPostMetaData - Metadata related to the moment post, such as caption, location, tags, etc.
 * @param {PostVideoParams} momentPostVideoParams - Video parameters related to the moment post, including video file and video settings.
 * @param {ClientSession} session - MongoDB session to ensure atomicity of operations.
 * @param {string} [audioId] - (Optional) The ID of the audio to use for the moment post.
 * @returns {Promise<WithId<MomentPost>>} A promise that resolves with the newly created moment post document, including the inserted ID.
 *
 * @throws {Error} If any of the provided data (location, accounts, audio) is invalid, or if there are any issues during the upload process.
 */
export const momentPostUpload = async (
	clientAccountId: string,
	momentPostMetaData: MomentPostUploadParams,
	momentPostVideoParams: PostVideoParams,
	session: ClientSession,
	audioId?: string
): Promise<WithId<MomentPost>> => {
	try {
		// Initialize sets for keywords, hashtags, mentions, and emojis
		let momentPostInfo: MomentPost;
		let hashTags: Set<string> = new Set<string>();
		let keywords: Set<string> = new Set<string>();
		let mentions: Set<string> = new Set<string>();
		let mentionsList: string[] = [];
		let emojis: Set<string> = new Set<string>();
		let isTaggedLocationVaild = false;
		let taggedAccounts: ObjectId[] = [];
		let isUsedAudioValid = false;
		let usedAudioInfo: { id: ObjectId; usedSection: [number, number] } | undefined =
			undefined;

		// Extract keywords, hashtags, mentions, and emojis from caption
		if (momentPostMetaData.caption) {
			getKeywords(momentPostMetaData.caption).map((keyword) =>
				keywords.add(keyword)
			);
			getHashtags(momentPostMetaData.caption).map((hashtag) =>
				hashTags.add(hashtag)
			);
			getMentions(momentPostMetaData.caption).map((mention) =>
				mentions.add(mention)
			);
			getEmojis(momentPostMetaData.caption).map((emoji) => emojis.add(emoji));
		}

		// Process mentions: validate if mentioned accounts can be tagged
		if (mentions.size) {
			for (let mention of mentions) {
				const accountInfo = await getAccountByUserId(mention);
				if (accountInfo) {
					// Ensure the account is not blocked by the client
					if (
						!(await isAccountBlocked(
							accountInfo._id.toString(),
							clientAccountId
						))
					) {
						// Check privacy settings of the mentioned account
						if (accountInfo.privacySettings.allowMentions === "everyone") {
							mentionsList.push(mention);
						} else if (
							accountInfo.privacySettings.allowMentions === "following"
						) {
							// Ensure the client is following the account if mentions are restricted
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

		// Validate tagged location
		if (momentPostMetaData.taggedLocation) {
			const locationInfo = await getTaggedLocationInfoByOsmId(
				momentPostMetaData.taggedLocation.osmId
			);
			if (locationInfo) {
				isTaggedLocationVaild = true;
			} else {
				throw new AppError("Failed to add location", HttpStatusCodes.NOT_FOUND);
			}
		}

		// Process tagged accounts: validate if accounts can be tagged
		if (momentPostMetaData.taggedAccounts) {
			for (const accountTags of momentPostMetaData.taggedAccounts) {
				const accountInfo = await getAccountById(accountTags);
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
						taggedAccounts.push(new ObjectId(accountTags));
					} else {
						throw new AppError("Failed to tag", HttpStatusCodes.FORBIDDEN);
					}
				} else {
					throw new AppError("Failed to tag", HttpStatusCodes.NOT_FOUND);
				}
			}
		}

		// Validate audio usage: check if the used audio section is valid
		if (momentPostMetaData.usedAudio) {
			const audioInfo = await getAudioById(momentPostMetaData.usedAudio.audioId);
			if (audioInfo) {
				let audioStart = momentPostMetaData.usedAudio.usedSection[0];
				let audioEnd = momentPostMetaData.usedAudio.usedSection[1];
				// Ensure the selected audio section is valid and at least 10 seconds long
				if (
					(audioStart < audioInfo.duration || audioStart >= 0) &&
					(audioEnd <= audioInfo.duration || audioEnd > 0) &&
					audioEnd - audioStart >= 10
				) {
					isUsedAudioValid = true;
					usedAudioInfo = {
						id: new ObjectId(momentPostMetaData.usedAudio.audioId),
						usedSection: momentPostMetaData.usedAudio.usedSection,
					};
				} else {
					throw new AppError(
						"Failed to add audio",
						HttpStatusCodes.BAD_REQUEST
					);
				}
			} else {
				throw new AppError("Failed to add audio", HttpStatusCodes.NOT_FOUND);
			}
		} else if (audioId) {
			// If no audio is provided in the metadata, check for audioId parameter
			const audioInfo = await getAudioById(audioId);
			if (audioInfo) {
				isUsedAudioValid = true;
				usedAudioInfo = {
					id: new ObjectId(audioId),
					usedSection: [0, audioInfo.duration],
				};
			} else {
				throw new AppError("Failed to add audio", HttpStatusCodes.NOT_FOUND);
			}
		}

		// Prepare moment post information for insertion into the database
		momentPostInfo = {
			createdAt: new Date(),
			caption: momentPostMetaData.caption,
			taggedLocation:
				momentPostMetaData.taggedLocation && isTaggedLocationVaild
					? {
							id: new ObjectId(),
							name: momentPostMetaData.taggedLocation.name,
							osmId: momentPostMetaData.taggedLocation.osmId,
					  }
					: undefined,
			engagementSummary: {
				noOfLikes: 0,
				noOfComments: 0,
				noOfViews: 0,
				noOfShares: 0,
			},
			advancedSettings: {
				commentDisabled: momentPostMetaData.advancedOptions.commentDisabled,
				hideLikesAndViewsCount: momentPostMetaData.advancedOptions.hideEngagement,
			},
			author: new ObjectId(clientAccountId),
			video: momentPostVideoParams,
			taggedAccounts: taggedAccounts,
			usedAudio: isUsedAudioValid ? usedAudioInfo : undefined,
			meta:
				mentions || keywords || hashTags || momentPostMetaData.topics
					? {
							mentions: mentionsList.length ? mentionsList : undefined,
							keywords: keywords.size ? [...keywords] : undefined,
							hashtags: hashTags.size ? [...hashTags] : undefined,
							emojis: emojis.size ? [...emojis] : undefined,
							topics: momentPostMetaData.topics,
					  }
					: undefined,
			status: "PROCESSING",
		};

		// Insert the new moment post into the database
		const postId = (await momentCollection.insertOne(momentPostInfo, { session }))
			.insertedId;

		// Return the moment post with the inserted ID
		return { _id: postId, ...momentPostInfo };
	} catch (error) {
		throw error;
	}
};

/**
 * Retrieves a moment post by its ID from the database.
 *
 * @param {string} postId - The ID of the post to be retrieved.
 * @returns {Promise<WithId<MomentPost> | null>} A promise that resolves to the moment post if found, or null if not.
 */
export const getMomentPostById = async (
	postId: string
): Promise<WithId<MomentPost> | null> => {
	// Attempt to find the post in the database by its ID
	const photoPostInfo = await momentCollection.findOne(new ObjectId(postId));
	return photoPostInfo;
};

/**
 * Increments the number of shares for a given moment post.
 *
 * @param {string} postId - The ID of the post whose share count is to be incremented.
 * @param {ClientSession} session - MongoDB session to ensure atomicity.
 * @returns {Promise<void>} A promise that resolves once the share count is updated.
 */
export const updateMomentPostShares = async (
	postId: string,
	session: ClientSession
): Promise<void> => {
	// Increment the number of shares for the post
	await momentCollection.updateOne(
		{ _id: new ObjectId(postId) },
		{ $inc: { "engagementSummary.noOfShares": 1 } },
		{ session }
	);
};

/**
 * Increments the number of comments (`engagementSummary.noOfComments`) on a specific moment post.
 *
 * This function first checks if the moment post exists in the database using its `postId`.
 * If the post is not found, it throws an `AppError` with a 404 status.
 * Otherwise, it increments the comment count using the provided MongoDB session, ensuring the operation
 * is part of a transaction if applicable.
 *
 * @param {string} postId - The unique identifier of the moment post to update.
 * @param {ClientSession} session - The MongoDB session used to ensure the operation is part of a transaction.
 * @returns {Promise<void>} - Resolves once the update is complete.
 * @throws {AppError} If the moment post is not found in the database.
 * @throws Will re-throw any unexpected errors encountered during the database operation.
 */
export async function updateMomentPostComments(postId: string, session: ClientSession) {
	try {
		// Check if the moment post exists using the provided postId
		const momentPostInfo = await getMomentPostById(postId);
		if (!momentPostInfo) {
			// Throw an application-level error if the post is not found
			throw new AppError("Failed to upload comment", HttpStatusCodes.NOT_FOUND);
		}

		// Increment the comment count on the moment post's engagement summary
		await momentCollection.updateOne(
			{ _id: new ObjectId(postId) }, // Filter by the post's ObjectId
			{ $inc: { "engagementSummary.noOfComments": 1 } }, // Increase comment count by 1
			{ session } // Execute within the provided session for transactional consistency
		);
	} catch (error) {
		// Re-throw any caught errors to be handled by the calling function
		throw error;
	}
}

/**
 * Uploads a comment for a moment post, handling mentions, keywords, and optional replies.
 *
 * @param {string} postId - The ID of the post that the comment belongs to.
 * @param {string} comment - The content of the comment.
 * @param {string} clientAccountId - The ID of the client account posting the comment.
 * @param {ClientSession} session - MongoDB session to ensure atomicity.
 * @param {string} [repliedTo] - The ID of the comment being replied to, if any.
 * @returns {Promise<WithId<Comment>>} A promise that resolves with the inserted comment.
 * @throws {AppError} If the comment being replied to is not found or if any other error occurs.
 */

export const momentPostCommentUpload = async (
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

		// Process mentions: ensure they are valid based on privacy settings and the client's account status
		if (mentions.size) {
			for (let mention of mentions) {
				const accountInfo = await getAccountByUserId(mention);
				if (accountInfo) {
					// Check if the account is blocked by the client
					if (
						!(await isAccountBlocked(
							accountInfo._id.toString(),
							clientAccountId
						))
					) {
						// Handle different privacy settings for mentions
						if (accountInfo.privacySettings.allowMentions === "everyone") {
							mentionsList.push(mention);
						} else if (
							accountInfo.privacySettings.allowMentions === "following"
						) {
							// Ensure the client is following the account if the setting restricts mentions
							const followingInfo = await isAccountFollower(
								clientAccountId,
								accountInfo._id.toString()
							);
							if (followingInfo) {
								mentionsList.push(mention);
							}
						} else {
							continue;
						}
					}
				}
			}
		}

		let postCommentInfo: Comment;

		// If replying to another comment, find the original comment
		if (repliedTo) {
			const commentRepliedToInfo = await momentCommentCollection.findOne({
				_id: new ObjectId(repliedTo),
			});
			if (!commentRepliedToInfo) {
				// If the reply target comment is not found, throw an error
				throw new AppError("Not found", HttpStatusCodes.NOT_FOUND);
			}
			// Create the comment object including the repliedTo field
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
			// Create the comment object for a standalone comment (not a reply)
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
			await momentCommentCollection.insertOne(postCommentInfo, { session })
		).insertedId;

		// If this is a reply, update the replied-to comment's reply count
		if (repliedTo) {
			await updateMomentPostCommentReply(repliedTo, session);
		}

		// Return the newly created comment with its ID
		return { _id: commentId, ...postCommentInfo };
	} catch (error) {
		// Catch and re-throw any errors
		throw error;
	}
};

/**
 * Retrieves a moment post comment by its ID from the database.
 *
 * @param {string} commentId - The ID of the comment to be retrieved.
 * @returns {Promise<WithId<Comment> | null>} A promise that resolves to the comment if found, or null if not.
 */
export const getMomentPostCommentById = async (
	commentId: string
): Promise<WithId<Comment> | null> => {
	try {
		// Attempt to find the comment in the database by its ID
		const commentInfo = await momentCommentCollection.findOne({
			_id: new ObjectId(commentId),
		});
		return commentInfo;
	} catch (error) {
		// Catch and re-throw any errors
		throw error;
	}
};

/**
 * Increments the number of replies for a given comment.
 *
 * @param {string} commentId - The ID of the comment whose reply count is to be incremented.
 * @param {ClientSession} session - MongoDB session to ensure atomicity.
 * @returns {Promise<void>} A promise that resolves once the reply count is updated.
 */
export const updateMomentPostCommentReply = async (
	commentId: string,
	session: ClientSession
): Promise<void> => {
	try {
		// Increment the number of replies for the comment
		await momentCommentCollection.updateOne(
			{
				_id: new ObjectId(commentId),
			},
			{
				$inc: { "meta.noOfReplies": 1 },
			},
			{ session }
		);
	} catch (error) {
		// Catch and re-throw any errors
		throw error;
	}
};
