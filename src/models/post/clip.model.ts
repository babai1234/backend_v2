import { ClientSession, ObjectId, WithId } from "mongodb";
import { ClipPost, Comment } from "../../types/collection/post.type";
import { isAccountBlocked, isAccountFollower } from "../../utils/dbUtils";
import { getEmojis, getHashtags, getKeywords, getMentions } from "../../utils/functions";
import { ClipPostUploadParams, PostVideoParams } from "../../types/util.type";
import { getAccountById, getAccountByUserId } from "../account.model";
import { getTaggedLocationInfoByOsmId } from "../location.model";
import { clipCollection, clipCommentCollection } from "../index.model";
import HttpStatusCodes from "../../constants/HttpStatusCodes";
import { AppError } from "../../constants/appError";

/**
 * Uploads a new clip post to the database, processing captions, mentions, hashtags, emojis,
 * tagged location, and tagged accounts. Initializes engagement summary and advanced settings.
 *
 * @param {string} clientAccountId - The ID of the user creating the clip post.
 * @param {ClipPostUploadParams} clipPostMetaData - Metadata for the clip post, including caption, location, tags, etc.
 * @param {PostVideoParams} clipPostVideoParams - Video-specific parameters (e.g., URL, bitrate, codec).
 * @param {ClientSession} session - The MongoDB session for transactional support.
 * @returns {Promise<WithId<ClipPost>>} The inserted clip post document with its generated `_id`.
 *
 * @throws {Error} If any referenced location is invalid, account tagging is not allowed, or database insertion fails.
 */
export const clipPostUpload = async (
	clientAccountId: string,
	clipPostMetaData: ClipPostUploadParams,
	clipPostVideoParams: PostVideoParams,
	session: ClientSession
): Promise<WithId<ClipPost>> => {
	try {
		let clipPostInfo: ClipPost;

		// Prepare sets to collect unique metadata
		let hashTags: Set<string> = new Set<string>();
		let keywords: Set<string> = new Set<string>();
		let mentions: Set<string> = new Set<string>();
		let mentionsList: string[] = [];
		let emojis: Set<string> = new Set<string>();
		let isTaggedLocationVaild = false;
		let taggedAccounts: ObjectId[] = [];

		// If a caption is provided, extract keywords, hashtags, mentions, and emojis
		if (clipPostMetaData.caption) {
			getKeywords(clipPostMetaData.caption).forEach((keyword) =>
				keywords.add(keyword)
			);
			getHashtags(clipPostMetaData.caption).forEach((hashtag) =>
				hashTags.add(hashtag)
			);
			getMentions(clipPostMetaData.caption).forEach((mention) =>
				mentions.add(mention)
			);
			getEmojis(clipPostMetaData.caption).forEach((emoji) => emojis.add(emoji));
		}

		// Validate each mention against block and privacy settings
		if (mentions.size) {
			for (let mention of mentions) {
				const accountInfo = await getAccountByUserId(mention);
				if (
					accountInfo &&
					!(await isAccountBlocked(accountInfo._id.toString(), clientAccountId))
				) {
					if (accountInfo.privacySettings.allowMentions === "everyone") {
						mentionsList.push(mention);
					} else if (
						accountInfo.privacySettings.allowMentions === "following" &&
						(await isAccountFollower(
							clientAccountId,
							accountInfo._id.toString()
						))
					) {
						mentionsList.push(mention);
					}
				}
			}
		}

		// Validate tagged location if provided
		if (clipPostMetaData.taggedLocation) {
			const locationInfo = await getTaggedLocationInfoByOsmId(
				clipPostMetaData.taggedLocation.osmId
			);
			if (locationInfo) {
				isTaggedLocationVaild = true;
			} else {
				throw new AppError("Failed to add location", HttpStatusCodes.NOT_FOUND);
			}
		}

		// Validate and collect tagged accounts based on privacy settings
		if (clipPostMetaData.taggedAccounts) {
			for (const accountTags of clipPostMetaData.taggedAccounts) {
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

		// Construct the clip post document
		clipPostInfo = {
			createdAt: new Date(),
			caption: clipPostMetaData.caption,
			taggedLocation:
				clipPostMetaData.taggedLocation && isTaggedLocationVaild
					? {
							id: new ObjectId(),
							name: clipPostMetaData.taggedLocation.name,
							osmId: clipPostMetaData.taggedLocation.osmId,
					  }
					: undefined,
			engagementSummary: {
				noOfLikes: 0,
				noOfComments: 0,
				noOfViews: 0,
				noOfShares: 0,
			},
			advancedSettings: {
				commentDisabled: clipPostMetaData.advancedOptions.commentDisabled,
				hideLikesAndViewsCount: clipPostMetaData.advancedOptions.hideEngagement,
			},
			author: new ObjectId(clientAccountId),
			video: clipPostVideoParams,
			taggedAccounts: taggedAccounts,
			meta:
				mentionsList.length > 0 ||
				keywords.size > 0 ||
				hashTags.size > 0 ||
				clipPostMetaData.topics
					? {
							mentions: mentionsList.length ? mentionsList : undefined,
							keywords: keywords.size ? [...keywords] : undefined,
							hashtags: hashTags.size ? [...hashTags] : undefined,
							topics: clipPostMetaData.topics,
					  }
					: undefined,
			status: "PROCESSING",
		};

		// Insert the new clip post into the database within the transaction
		const postId = (await clipCollection.insertOne(clipPostInfo, { session }))
			.insertedId;

		return { _id: postId, ...clipPostInfo };
	} catch (error) {
		// Rethrow to let upstream handle or log it
		throw error;
	}
};

/**
 * Retrieves a single clip post document from the database using its ID.
 *
 * @param {string} postId - The string representation of the clip post's ObjectId.
 * @returns {Promise<WithId<ClipPost> | null>} A promise that resolves to the clip post document
 * if found, or `null` if no document exists with the given ID.
 *
 * @throws {Error} If the ID is invalid or a database error occurs.
 */
export const getClipPostById = async (
	postId: string
): Promise<WithId<ClipPost> | null> => {
	// Find the clip post document in the database by its ObjectId
	const clipPostInfo = await clipCollection.findOne(new ObjectId(postId));

	// Return the found document or null if not found
	return clipPostInfo;
};

/**
 * Increments the share count of a specific clip post by 1.
 *
 * @param {string} postId - The string representation of the clip post's ObjectId.
 * @param {ClientSession} session - The MongoDB session to ensure the update is part of a transaction.
 * @returns {Promise<void>} A promise that resolves when the update operation completes.
 *
 * @throws {Error} If the update operation fails.
 */
export const updateClipPostShares = async (
	postId: string,
	session: ClientSession
): Promise<void> => {
	// Increment the 'noOfShares' field in the engagement summary of the specified clip post
	await clipCollection.updateOne(
		{ _id: new ObjectId(postId) }, // Find the clip post by its ObjectId
		{ $inc: { "engagementSummary.noOfShares": 1 } }, // Increment the share count by 1
		{ session } // Use the provided session for transactional safety
	);
};

/**
 * Increments the number of comments (`engagementSummary.noOfComments`) on a specific clip post.
 *
 * This function checks whether the clip post exists in the database using the provided `postId`.
 * If the post is not found, it throws an `AppError` with a 404 status code.
 * If found, it increments the comment count by 1 using the MongoDB `$inc` operator within
 * the provided transaction session.
 *
 * @param {string} postId - The unique identifier of the clip post to update.
 * @param {ClientSession} session - The MongoDB session used for ensuring transactional consistency.
 * @returns {Promise<void>} - Resolves when the update operation is successfully completed.
 * @throws {AppError} If the clip post is not found in the database.
 * @throws Will re-throw any unexpected errors encountered during the update.
 */
export async function updateClipPostComments(postId: string, session: ClientSession) {
	try {
		// Attempt to retrieve the clip post by its ID
		const clipPostInfo = await getClipPostById(postId);
		if (!clipPostInfo) {
			// Throw a 404 error if the post doesn't exist
			throw new AppError("Failed to upload comment", HttpStatusCodes.NOT_FOUND);
		}

		// Perform an atomic increment of the comment count in the engagement summary
		await clipCollection.updateOne(
			{ _id: new ObjectId(postId) }, // Match the document by its ObjectId
			{ $inc: { "engagementSummary.noOfComments": 1 } }, // Increment the comment count
			{ session } // Use the provided session for transactional integrity
		);
	} catch (error) {
		// Re-throw the error so it can be handled at a higher level
		throw error;
	}
}

/**
 * Uploads a comment for a clip post, optionally as a reply to another comment.
 *
 * @param {string} postId - The ID of the clip post to comment on.
 * @param {string} comment - The text content of the comment.
 * @param {string} clientAccountId - The ID of the account posting the comment.
 * @param {ClientSession} session - MongoDB session used for transactional operations.
 * @param {string} [repliedTo] - (Optional) The ID of the comment being replied to.
 * @returns {Promise<WithId<Comment>>} The inserted comment document with its generated ID.
 *
 * @throws {AppError} If the `repliedTo` comment is not found.
 * @throws {Error} If any database or internal error occurs.
 */
export const clipPostCommentUpload = async (
	postId: string,
	comment: string,
	clientAccountId: string,
	session: ClientSession,
	repliedTo?: string
): Promise<WithId<Comment>> => {
	let keywords: Set<string> = new Set();
	let mentions: Set<string> = new Set();
	let mentionsList: string[] = [];

	try {
		// Extract keywords and mentions from comment text
		getKeywords(comment).map((keyword) => keywords.add(keyword));
		getMentions(comment).map((mention) => mentions.add(mention));

		// Filter allowed mentions based on the mentioned users' privacy settings
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
							const isFollowing = await isAccountFollower(
								clientAccountId,
								accountInfo._id.toString()
							);
							if (isFollowing) {
								mentionsList.push(mention);
							}
						}
					}
				}
			}
		}

		let postCommentInfo: Comment;

		// If replying to another comment, validate and link reply
		if (repliedTo) {
			const repliedComment = await clipCommentCollection.findOne({
				_id: new ObjectId(repliedTo),
			});
			if (!repliedComment)
				throw new AppError("Not found", HttpStatusCodes.NOT_FOUND);

			postCommentInfo = {
				createdAt: new Date(),
				author: new ObjectId(clientAccountId),
				text: comment,
				postId: new ObjectId(postId),
				repliedTo: new ObjectId(repliedTo),
				mentions: mentionsList.length ? mentionsList : undefined,
				keywords: keywords.size ? [...keywords] : undefined,
				meta: { noOfLikes: 0, noOfReplies: 0 },
			};
		} else {
			// Regular (non-reply) comment
			postCommentInfo = {
				createdAt: new Date(),
				author: new ObjectId(clientAccountId),
				text: comment,
				postId: new ObjectId(postId),
				mentions: mentionsList.length ? mentionsList : undefined,
				keywords: keywords.size ? [...keywords] : undefined,
				meta: { noOfLikes: 0, noOfReplies: 0 },
			};
		}

		// Insert comment into database
		const commentId = (
			await clipCommentCollection.insertOne(postCommentInfo, { session })
		).insertedId;

		// If this was a reply, update the original comment's reply count
		if (repliedTo) {
			await updateClipPostCommentReply(repliedTo, session);
		}

		return { _id: commentId, ...postCommentInfo };
	} catch (error) {
		throw error;
	}
};

/**
 * Retrieves a clip post comment by its ID.
 *
 * @param {string} commentId - The ID of the comment to retrieve.
 * @returns {Promise<WithId<Comment> | null>} The comment document if found, otherwise null.
 *
 * @throws {Error} If the database query fails.
 */
export const getClipPostCommentById = async (
	commentId: string
): Promise<WithId<Comment> | null> => {
	try {
		// Fetch the comment from the database by ID
		const commentInfo = await clipCommentCollection.findOne({
			_id: new ObjectId(commentId),
		});
		return commentInfo;
	} catch (error) {
		throw error;
	}
};

/**
 * Increments the reply count (`meta.noOfReplies`) of a specific comment.
 *
 * @param {string} commentId - The ID of the comment whose reply count should be incremented.
 * @param {ClientSession} session - MongoDB session used to ensure transactional consistency.
 * @returns {Promise<void>} A promise that resolves when the update completes.
 *
 * @throws {Error} If the update operation fails.
 */
export const updateClipPostCommentReply = async (
	commentId: string,
	session: ClientSession
): Promise<void> => {
	try {
		// Increment the number of replies to the comment
		await clipCommentCollection.updateOne(
			{ _id: new ObjectId(commentId) },
			{ $inc: { "meta.noOfReplies": 1 } },
			{ session }
		);
	} catch (error) {
		throw error;
	}
};
