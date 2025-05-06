import { ClientSession } from "mongodb";
import { hashTagCollection } from "./index.model";

/**
 * Creates a new hashtag document in the database within the context of a MongoDB transaction session.
 *
 * Initializes usage metadata counters for posts, memories, and bios to zero.
 *
 * @param {string} hashTag - The name of the hashtag to be created.
 * @param {ClientSession} session - The MongoDB session under which the operation is executed (for transaction support).
 * @returns {Promise<void>} - Resolves when the hashtag is successfully inserted.
 * @throws Will propagate any insertion error thrown by MongoDB.
 */
export async function createHashtag(
	hashTag: string,
	session: ClientSession
): Promise<void> {
	try {
		// Insert a new hashtag document into the collection
		await hashTagCollection.insertOne(
			{
				name: hashTag, // Hashtag name (e.g., "#travel")
				createdAt: new Date(), // Timestamp of creation
				meta: {
					noOfPostUse: 0, // Counter for how many times used in posts
					noOfMemoryUse: 0, // Counter for memory feature usage
					noOfBioUse: 0, // Counter for bio mentions
				},
			},
			{ session } // Attach operation to the given MongoDB session
		);
	} catch (error) {
		// Re-throw error to let caller handle it appropriately (e.g., transaction rollback)
		throw error;
	}
}

/**
 * Increments the `noOfPostUse` counter of a hashtag in the database.
 *
 * If the hashtag does not exist, this function first creates it with initial metadata,
 * and then increments the `meta.noOfPostUse` field by 1.
 *
 * This operation is intended to be part of a MongoDB transaction, so a session must be provided.
 *
 * @param {string} hashTag - The name of the hashtag to update or create.
 * @param {ClientSession} session - The MongoDB session used to execute this operation within a transaction.
 * @returns {Promise<void>} - Resolves when the operation is complete.
 * @throws Will propagate any errors that occur during the operation.
 */
export async function updateHashtagPostUse(
	hashTag: string,
	session: ClientSession
): Promise<void> {
	try {
		// Attempt to retrieve the hashtag from the database
		const hashTagInfo = await getHashTag(hashTag);

		// If it does not exist, create a new hashtag entry
		if (!hashTagInfo) {
			await createHashtag(hashTag, session);
		}

		// Increment the noOfPostUse counter in the hashtag's metadata
		await hashTagCollection.updateOne(
			{ name: hashTag }, // Filter: match hashtag by name
			{ $inc: { "meta.noOfPostUse": 1 } }, // Update: increment post use count
			{ session } // Use the same transaction session for consistency
		);
	} catch (error) {
		// Re-throw any errors to be handled by the calling context
		throw error;
	}
}

/**
 * Increments the memory usage count (`meta.noOfMemoryUse`) for a given hashtag.
 *
 * This function checks if the provided hashtag exists in the database. If it does not,
 * it creates a new hashtag document with default metadata. It then performs an atomic
 * increment on the `meta.noOfMemoryUse` field to reflect that this hashtag has been used
 * in a memory. The operation is executed within the provided MongoDB transaction session.
 *
 * @param {string} hashTag - The hashtag string whose memory usage count should be updated.
 * @param {ClientSession} session - The MongoDB session used to execute the operation transactionally.
 * @returns {Promise<void>} - Resolves once the memory usage count has been incremented or the hashtag is created.
 * @throws Will re-throw any errors encountered during the database operations.
 */
export async function updateHashtagMemoryUse(
	hashTag: string,
	session: ClientSession
): Promise<void> {
	try {
		// Attempt to retrieve the hashtag from the database
		const hashTagInfo = await getHashTag(hashTag);

		// If it does not exist, create a new hashtag entry
		if (!hashTagInfo) {
			await createHashtag(hashTag, session);
		}

		// Increment the noOfMemoryUse counter in the hashtag's metadata
		await hashTagCollection.updateOne(
			{ name: hashTag }, // Filter: match hashtag by name
			{ $inc: { "meta.noOfMemoryUse": 1 } }, // Update: increment memory use count
			{ session } // Use the same transaction session for consistency
		);
	} catch (error) {
		// Re-throw any errors to be handled by the calling context
		throw error;
	}
}

/**
 * Retrieves a hashtag document from the database by its name.
 *
 * This function queries the `hashTagCollection` to find a hashtag matching the provided name.
 *
 * @param {string} hashtag - The name of the hashtag to retrieve (e.g., "#travel").
 * @returns {Promise<any | null>} - A promise that resolves to the hashtag document if found, or `null` if not.
 * @throws Will propagate any errors thrown during the database query.
 */
export async function getHashTag(hashtag: string): Promise<any | null> {
	try {
		// Search for a hashtag document with the exact name
		return await hashTagCollection.findOne({ name: hashtag });
	} catch (error) {
		// Re-throw the error so the caller can handle it
		throw error;
	}
}
