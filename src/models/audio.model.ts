import { ClientSession, ObjectId, WithId } from "mongodb";
import { Account } from "../types/collection/account.type";
import {
	MusicAudio,
	NewAudio,
	OriginalAudio,
	TrendingAudio,
} from "../types/collection/audio.type";
import { urlGenerator } from "../utils/functions";
import {
	audioNewCollection,
	audioSaveCollection,
	audioTrendingCollection,
	audioUseCollection,
	musicAudioCollection,
	originalAudioCollection,
} from "./index.model";
import { AppError } from "../constants/appError";
import HttpStatusCodes from "../constants/HttpStatusCodes";
import { AudioSaveList } from "../types/util.type";
import {
	FullMusicApiResponseParams,
	MusicApiResponseResult,
} from "../types/response/audio.type";

export async function uploadMusicAudio(
	musicAudioMetadata: MusicApiResponseResult,
	session: ClientSession,
	usedSection?: [number, number]
): Promise<string> {
	const audioInfo: MusicAudio = {
		createdAt: new Date(),
		url: musicAudioMetadata.url,
		duration: musicAudioMetadata.duration,
		isDeleted: false,
		isAvailable: true,
		title: musicAudioMetadata.name,
		poster: {
			url: musicAudioMetadata.image[0].url,
			width: Number(musicAudioMetadata.image[0].quality.split("x")[0]), // Default width for the poster
			height: Number(musicAudioMetadata.image[0].quality.split("x")[1]), // Default height for the poster
		},
		meta: {
			noOfPhotoUse: 0,
			noOfMomentUse: 0,
			noOfMemoryUse: 0,
			noOfVisits: 0,
			noOfSearches: 0,
			noOfShares: 0,
			noOfSaves: 0,
		},
		audioApiId: musicAudioMetadata.id, // Store the API ID for reference
		artists: musicAudioMetadata.artists.primary
			.map((artist) => artist.name)
			.join(", "), // Join artists into a string
		bestSections: usedSection
			? [{ from: usedSection[0], to: usedSection[1], count: 1 }]
			: undefined,
		status: "PROCESSING", // Initial status of the audio
	};

	try {
		const audioId = await musicAudioCollection.insertOne(audioInfo, { session });
		return audioId.insertedId.toString();
	} catch (error) {
		throw error;
	}
}

export async function updateMusicAudioUsedSection(
	audioId: string,
	usedSection: [number, number],
	session: ClientSession
): Promise<void> {
	const TOLERANCE = 1.0; // seconds

	try {
		const audioInfo = await getMusicAudioById(audioId);
		if (!audioInfo) {
			throw new AppError("No audio found!", HttpStatusCodes.NOT_FOUND);
		}

		const bestSections = audioInfo.bestSections || [];
		const [usedFrom, usedTo] = usedSection;

		// Find if there's already a similar section (within tolerance)
		const existingSectionIndex = bestSections.findIndex(({ from, to }) => {
			return (
				Math.abs(from - usedFrom) <= TOLERANCE &&
				Math.abs(to - usedTo) <= TOLERANCE
			);
		});

		if (existingSectionIndex !== -1) {
			// Increment count for the matched section
			bestSections[existingSectionIndex].count += 1;
		} else {
			// Add new section with count = 1
			bestSections.push({ from: usedFrom, to: usedTo, count: 1 });
		}

		await musicAudioCollection.updateOne(
			{ _id: new ObjectId(audioId) },
			{ $set: { bestSections } },
			{ session }
		);
	} catch (error) {
		throw error;
	}
}

/**
 * Retrieves an audio document by its ID.
 *
 * @param {string} audioId - The ID of the audio document to retrieve.
 * @returns {Promise<WithId<MusicAudio> | null>} A promise resolving with the audio document, or null if not found.
 * @throws {Error} If the database query fails.
 */
export async function getMusicAudioById(
	audioId: string
): Promise<WithId<MusicAudio> | null> {
	try {
		const audioInfo = await musicAudioCollection.findOne({
			_id: new ObjectId(audioId),
		});
		return audioInfo;
	} catch (error) {
		throw error;
	}
}

/**
 * Retrieves an audio document by its Api Id.
 *
 * @param {string} audioApiId - The Api Id in the audio document to retrieve.
 * @returns {Promise<WithId<MusicAudio> | null>} A promise resolving with the audio document, or null if not found.
 * @throws {Error} If the database query fails.
 */
export async function getMusicAudioByApiId(
	audioApiId: string
): Promise<WithId<MusicAudio> | null> {
	try {
		const audioInfo = await musicAudioCollection.findOne({
			audioApiId: audioApiId,
		});
		return audioInfo;
	} catch (error) {
		throw error;
	}
}

/**
 * Retrieves an audio document by its ID.
 *
 * @param {string} audioApiId - The Api Id of the audio document to retrieve.
 * @returns {Promise<WithId<MusicAudio> | null>} A promise resolving with the audio document, or null if not found.
 * @throws {Error} If the database query fails.
 */
export async function getMusicAudioApiResultById(
	audioApiId: string
): Promise<MusicApiResponseResult | null> {
	try {
		const fullAudioData = await fetch(
			process.env.MUSIC_API_BASE_URL + `/songs?ids=${audioApiId}`
		);
		let musicData: MusicApiResponseResult | null = null;
		fullAudioData.json().then(async (data: FullMusicApiResponseParams) => {
			if (!data.success) {
				throw new AppError(
					"Something went wrong!",
					HttpStatusCodes.INTERNAL_SERVER_ERROR
				);
			}
			musicData = data.data.results[0];
		});
		return musicData;
	} catch (error) {
		throw error;
	}
}

/**
 * Increments the number of times the audio has been used in a photo.
 *
 * @param {string} audioId - The ID of the audio to update.
 * @param {ClientSession} session - The MongoDB session for transactional safety.
 * @returns {Promise<void>} A promise that resolves once the update is complete.
 * @throws {Error} If the database update fails.
 */
export async function updateMusicAudioPhotoUse(
	audioId: string,
	session: ClientSession
): Promise<void> {
	try {
		const audioInfo = await getMusicAudioById(audioId);
		if (!audioInfo) {
			throw new AppError("No audio found!", HttpStatusCodes.NOT_FOUND);
		}
		await musicAudioCollection.updateOne(
			{ _id: new ObjectId(audioId) },
			{ $inc: { "meta.noOfPhotoUse": 1 } }, // Increment post usage count
			{ session }
		);
		await updateMusicAudioUse(audioId, session); // Update audio use collection
	} catch (error) {
		throw error;
	}
}

/**
 * Increments the number of times the audio has been used in a moment.
 *
 * @param {string} audioId - The ID of the audio to update.
 * @param {ClientSession} session - The MongoDB session for transactional safety.
 * @returns {Promise<void>} A promise that resolves once the update is complete.
 * @throws {Error} If the database update fails.
 */
export async function updateMusicAudioMomentUse(
	audioId: string,
	session: ClientSession
): Promise<void> {
	try {
		const audioInfo = await getMusicAudioById(audioId);
		if (!audioInfo) {
			throw new AppError("No audio found!", HttpStatusCodes.NOT_FOUND);
		}
		await musicAudioCollection.updateOne(
			{ _id: new ObjectId(audioId) },
			{ $inc: { "meta.noOfMomentUse": 1 } }, // Increment post usage count
			{ session }
		);
		await updateMusicAudioUse(audioId, session); // Update audio use collection
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
export async function updateMusicAudioMemoryUse(
	audioId: string,
	session: ClientSession
): Promise<void> {
	try {
		// Check if the audio document exists in the collection
		const audioInfo = await getMusicAudioById(audioId);
		if (!audioInfo) {
			// Throw a 404 error if the audio is not found
			throw new AppError("No audio found!", HttpStatusCodes.NOT_FOUND);
		}

		// Perform an atomic update to increment the memory usage count
		await musicAudioCollection.updateOne(
			{ _id: audioInfo._id }, // Match audio document by its ObjectId
			{ $inc: { "meta.noOfMemoryUse": 1 } }, // Increment the usage count
			{ session } // Ensure this happens within a transaction
		);
		await updateMusicAudioUse(audioId, session); // Update the audio use collection
	} catch (error) {
		// Propagate the error so it can be handled by the calling context
		throw error;
	}
}

export async function updateMusicAudioUse(audioId: string, session: ClientSession) {
	try {
		const today = new Date(new Date().toISOString().split("T")[0]); // Get today's date at midnight UTC

		const usedAudioInfo = await audioUseCollection.findOne({
			audioId: new ObjectId(audioId),
			date: today, // Use the prepared Date object
		});

		if (usedAudioInfo) {
			// If an entry for today's date exists, increment the count
			await audioUseCollection.updateOne(
				{ audioId: usedAudioInfo.audioId, date: usedAudioInfo.date },
				{ $inc: { count: 1 } },
				{ session }
			);
		} else {
			// Otherwise, create a new entry for today's date
			await audioUseCollection.insertOne(
				{
					audioId: new ObjectId(audioId),
					date: today, // Use the prepared Date object to ensure it's a BSON Date type
					count: 1,
				},
				{ session }
			);
		}
	} catch (error) {
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
export const updateMusicAudioShares = async (
	audioId: string,
	session: ClientSession
): Promise<void> => {
	try {
		const audioInfo = await getMusicAudioById(audioId);
		if (!audioInfo) {
			throw new AppError("Failed to upload", HttpStatusCodes.NOT_FOUND);
		}
		await musicAudioCollection.updateOne(
			{ _id: audioInfo._id },
			{ $inc: { "meta.noOfShares": 1 } }, // Increment share count
			{ session }
		);
	} catch (error) {
		throw error;
	}
};

/**
 * Retrieves the latest audio data from the database.
 *
 * @returns {Promise<WithId<NewAudio>[] | null>} A promise that resolves with an array of audio documents.
 * @throws {Error} If the database query fails.
 */

export async function getNewAudioData(): Promise<WithId<NewAudio>[] | null> {
	try {
		const newAudioData = await audioNewCollection
			.find({ audioApiId: { $exists: true } })
			.toArray();
		return newAudioData;
	} catch (error) {
		throw error;
	}
}

/**
 * Retrieves the latest audio data from the database.
 *
 * @returns {Promise<WithId<TrendingAudio>[] | null>} A promise that resolves with an array of audio documents.
 * @throws {Error} If the database query fails.
 */

export async function getTrendingAudioData(
	today: Date
): Promise<WithId<TrendingAudio>[] | null> {
	try {
		const trendingAudioData = await audioTrendingCollection
			.find({ date: today })
			.toArray();
		return trendingAudioData;
	} catch (error) {
		throw error;
	}
}

export async function getSavedAudioList(userId: string): Promise<AudioSaveList[] | null> {
	try {
		const savedAudioList = await audioSaveCollection.findOne({
			savedBy: new ObjectId(userId),
		});
		if (!savedAudioList) {
			return null; // No saved audio found for this user
		}
		return savedAudioList.audioIdList;
	} catch (error) {
		throw error;
	}
}

export async function isAudioSaved(audioId: string, userId: string): Promise<boolean> {
	try {
		const savedAudioList = await audioSaveCollection.findOne({
			savedBy: new ObjectId(userId),
		});
		if (!savedAudioList) {
			return false; // No saved audio found for this user
		}
		return savedAudioList.audioIdList.some((savedAudio) => {
			if (savedAudio.type === "music") {
				savedAudio.audioId === audioId;
				return true; // Audio is saved
			} else {
				savedAudio.audioId.toString() === audioId;
				return true; // Audio is saved
			}
		});
	} catch (error) {
		throw error;
	}
}

// ------------------------------------------------ Original Audio ------------------------------------------------

/**
 * Uploads a new audio record to the database.
 *
 * @param {string} file - The filename or file path of the uploaded audio.
 * @param {number} duration - The duration of the audio in seconds.
 * @param {WithId<Account>} clientAccountInfo - The account information of the uploading user.
 * @returns {Promise<string>} A promise that resolves with the ID of the inserted audio document.
 * @throws {Error} If the database insertion fails.
 */
export async function uploadOriginalAudio(
	file: string,
	duration: number,
	clientAccountInfo: WithId<Account>,
	session: ClientSession,
	title?: string
): Promise<string> {
	const audioInfo: OriginalAudio = {
		createdAt: new Date(),
		url: urlGenerator(file, "moment", "audio"), // Generate a URL for the audio file
		duration: duration,
		isDeleted: false,
		isAvailable: true,
		associatedAccountId: clientAccountInfo._id,
		title: title ? title : `Original_Audio_${clientAccountInfo.userId}`, // Title includes uploader's userId
		poster: {
			url: urlGenerator(file, "moment", "thumbnail"),
			width: 72, // Default width for the poster
			height: 72, // Default height for the poster
		},
		meta: {
			noOfPhotoUse: 0,
			noOfMomentUse: 0,
			noOfMemoryUse: 0,
			noOfVisits: 0,
			noOfSearches: 0,
			noOfShares: 0,
			noOfSaves: 0,
		},
		status: "PROCESSING", // Audio is in processing state initially
	};
	try {
		const audioId = await originalAudioCollection.insertOne(audioInfo, { session }); // Insert audio metadata into DB
		return audioId.insertedId.toString(); // Return the ID of the inserted document
	} catch (error) {
		throw error; // Propagate errors
	}
}

/**
 * Retrieves an audio document by its ID.
 *
 * @param {string} audioId - The ID of the audio document to retrieve.
 * @returns {Promise<WithId<OriginalAudio> | null>} A promise resolving with the audio document, or null if not found.
 * @throws {Error} If the database query fails.
 */
export async function getOriginalAudioById(
	audioId: string
): Promise<WithId<OriginalAudio> | null> {
	try {
		const audioInfo = await originalAudioCollection.findOne({
			_id: new ObjectId(audioId),
		});
		return audioInfo;
	} catch (error) {
		throw error;
	}
}

export async function saveOriginalAudio(
	audioId: string,
	userId: string,
	session: ClientSession
): Promise<void> {
	try {
		const savedAudioList = await audioSaveCollection.findOne({
			savedBy: new ObjectId(userId),
		});
		if (!savedAudioList) {
			// If no saved audio list exists for the user, create a new one
			await audioSaveCollection.insertOne(
				{
					savedBy: new ObjectId(userId),
					audioIdList: [
						{
							audioId: new ObjectId(audioId),
							type: "original",
							savedAt: new Date(),
						},
					],
				},
				{ session }
			);
		} else {
			// If the saved audio list exists, check if the audio is already saved
			const isAudioAlreadySaved = savedAudioList.audioIdList.some(
				(savedAudio) =>
					savedAudio.audioId.toString() === audioId &&
					savedAudio.type === "original"
			);
			if (!isAudioAlreadySaved) {
				// If not already saved, add the new audio to the list
				await audioSaveCollection.updateOne(
					{ savedBy: new ObjectId(userId) },
					{
						$push: {
							audioIdList: {
								audioId: new ObjectId(audioId),
								type: "original",
								savedAt: new Date(),
							},
						},
					},
					{ session }
				);
			}
		}
	} catch (error) {
		throw error;
	}
}

export const updateOriginalAudioShares = async (
	audioId: string,
	session: ClientSession
): Promise<void> => {
	try {
		const audioInfo = await getOriginalAudioById(audioId);
		if (!audioInfo) {
			throw new AppError("Failed to upload", HttpStatusCodes.NOT_FOUND);
		}
		await originalAudioCollection.updateOne(
			{ _id: audioInfo._id },
			{ $inc: { "meta.noOfShares": 1 } }, // Increment share count
			{ session }
		);
	} catch (error) {
		throw error;
	}
};

// export async function updateOriginalAudioUse(audioId: string, session: ClientSession) {
// 	try {
// 		const usedAudioInfo = await audioUseCollection.findOne({
// 			_id: new ObjectId(audioId),
// 			type: "original",
// 			date: new Date().toISOString().split("T")[0],
// 		});
// 		if (usedAudioInfo) {
// 			// If an entry for today's date exists, increment the count
// 			await audioUseCollection.updateOne(
// 				{ _id: usedAudioInfo._id },
// 				{ $inc: { count: 1 } },
// 				{ session }
// 			);
// 		} else {
// 			// Otherwise, create a new entry for today's date
// 			await audioUseCollection.insertOne(
// 				{
// 					_id: new ObjectId(audioId),
// 					type: "original",
// 					date: new Date().toISOString().split("T")[0],
// 					count: 1,
// 				},
// 				{ session }
// 			);
// 		}
// 	} catch (error) {
// 		throw error;
// 	}
// }
