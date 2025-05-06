import { ClientSession, ObjectId, WithId } from "mongodb";
import { Account } from "../types/collection/account.type";
import { Audio } from "../types/collection/audio.type";
import { urlGenerator } from "../utils/functions";
import { audioCollection } from "./index.model";
import { AppError } from "../constants/appError";
import HttpStatusCodes from "../constants/HttpStatusCodes";
/**
 * Uploads a new audio record to the database.
 *
 * @param {string} file - The filename or file path of the uploaded audio.
 * @param {number} duration - The duration of the audio in seconds.
 * @param {WithId<Account>} clientAccountInfo - The account information of the uploading user.
 * @returns {Promise<string>} A promise that resolves with the ID of the inserted audio document.
 * @throws {Error} If the database insertion fails.
 */
export async function uploadAudio(
	file: string,
	duration: number,
	clientAccountInfo: WithId<Account>
): Promise<string> {
	const audioInfo: Audio = {
		createdAt: new Date(),
		url: urlGenerator(file, "moment", "audio"), // Generate a URL for the audio file
		duration: duration,
		isDeleted: false,
		isAvailable: true,
		type: "original", // Marks this audio as original (not reused)
		uploadedBy: "user",
		associatedAccountId: clientAccountInfo._id,
		title: `Original_Audio_${clientAccountInfo.userId}`, // Title includes uploader's userId
		meta: {
			noOfPostUse: 0,
			noOfMemoryUse: 0,
			noOfVisits: 0,
			noOfSearches: 0,
			noOfShares: 0,
			noOfSaves: 0,
		},
		status: "PROCESSING", // Audio is in processing state initially
	};
	try {
		const audioId = await audioCollection.insertOne(audioInfo); // Insert audio metadata into DB
		return audioId.insertedId.toString(); // Return the ID of the inserted document
	} catch (error) {
		throw error; // Propagate errors
	}
}

/**
 * Retrieves an audio document by its ID.
 *
 * @param {string} audioId - The ID of the audio document to retrieve.
 * @returns {Promise<WithId<Audio> | null>} A promise resolving with the audio document, or null if not found.
 * @throws {Error} If the database query fails.
 */
export async function getAudioById(audioId: string): Promise<WithId<Audio> | null> {
	try {
		const audioInfo = await audioCollection.findOne({ _id: new ObjectId(audioId) });
		return audioInfo;
	} catch (error) {
		throw error;
	}
}

/**
 * Increments the number of times the audio has been used in posts.
 *
 * @param {string} audioId - The ID of the audio to update.
 * @param {ClientSession} session - The MongoDB session for transactional safety.
 * @returns {Promise<void>} A promise that resolves once the update is complete.
 * @throws {Error} If the database update fails.
 */
export async function updateAudioPostUse(
	audioId: string,
	session: ClientSession
): Promise<void> {
	try {
		const audioInfo = await getAudioById(audioId);
		if (!audioInfo) {
			throw new AppError("Failed to upload", HttpStatusCodes.NOT_FOUND);
		}
		await audioCollection.updateOne(
			{ _id: new ObjectId(audioId) },
			{ $inc: { "meta.noOfPostUse": 1 } }, // Increment post usage count
			{ session }
		);
	} catch (error) {
		throw error;
	}
}

/**
 * Increments the memory usage count (`meta.noOfMemoryUse`) for a specific audio document.
 *
 * This function ensures the referenced audio exists in the database using the provided `audioId`.
 * If the audio document is not found, it throws an `AppError` with a 404 status code.
 * If found, it performs an atomic increment on the `meta.noOfMemoryUse` field to reflect
 * that this audio has been used in a memory. The operation is executed within the
 * provided MongoDB transaction session.
 *
 * @param {string} audioId - The unique identifier of the audio document to update.
 * @param {ClientSession} session - The MongoDB session used for transactional safety.
 * @returns {Promise<void>} - Resolves when the update operation is complete.
 * @throws {AppError} If the audio document is not found in the database.
 * @throws Will re-throw any unexpected errors encountered during the update process.
 */
export async function updateAudioMemoryUse(
	audioId: string,
	session: ClientSession
): Promise<void> {
	try {
		// Check if the audio document exists in the collection
		const audioInfo = await getAudioById(audioId);
		if (!audioInfo) {
			// Throw a 404 error if the audio is not found
			throw new AppError("Failed to upload", HttpStatusCodes.NOT_FOUND);
		}

		// Perform an atomic update to increment the memory usage count
		await audioCollection.updateOne(
			{ _id: new ObjectId(audioId) }, // Match audio document by its ObjectId
			{ $inc: { "meta.noOfMemoryUse": 1 } }, // Increment the usage count
			{ session } // Ensure this happens within a transaction
		);
	} catch (error) {
		// Propagate the error so it can be handled by the calling context
		throw error;
	}
}

/**
 * Increments the number of times the audio has been shared.
 *
 * @param {string} audioId - The ID of the audio document to update.
 * @param {ClientSession} session - The MongoDB session for transactional safety.
 * @returns {Promise<void>} A promise that resolves once the update is complete.
 * @throws {Error} If the database update fails.
 */
export const updateAudioShares = async (
	audioId: string,
	session: ClientSession
): Promise<void> => {
	try {
		const audioInfo = await getAudioById(audioId);
		if (!audioInfo) {
			throw new AppError("Failed to upload", HttpStatusCodes.NOT_FOUND);
		}
		await audioCollection.updateOne(
			{ _id: new ObjectId(audioId) },
			{ $inc: { "meta.noOfShares": 1 } }, // Increment share count
			{ session }
		);
	} catch (error) {
		throw error;
	}
};
