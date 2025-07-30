import { ObjectId } from "mongodb";
import { AppError } from "../../constants/appError";
import HttpStatusCodes from "../../constants/HttpStatusCodes";
import { getAccountById } from "../../models/account.model";
import {
	getMusicAudioByApiId,
	getMusicAudioById,
	getNewAudioData,
	getOriginalAudioById,
	getSavedAudioList,
	getTrendingAudioData,
	isAudioSaved,
} from "../../models/audio.model";
import { audioTrendingCollection, audioUseCollection } from "../../models/index.model";
import {
	FullMusicApiResponseParams,
	MusicAudioResponseParams,
	SavedAudioResponseParams,
} from "../../types/response/audio.type";
import { isAccountBlocked, isAccountFollower } from "../../utils/dbUtils";
import { TrendingAudio } from "../../types/collection/audio.type";

/**
 * Fetches new audio data from the database and returns a list of music response parameters.
 *
 * @returns {Promise<MusicResponseParams[]>} A promise that resolves to an array of music response parameters.
 * @throws {AppError} If there is an error fetching the audio data or if the data is empty.
 */
export const getNewAudioService = async (
	clientAccountId: string
): Promise<MusicAudioResponseParams[]> => {
	try {
		// Simulate fetching new audio data
		const newAudioData = await getNewAudioData();
		if (!newAudioData || newAudioData.length === 0) {
			throw new AppError(
				"Something went wrong!",
				HttpStatusCodes.INTERNAL_SERVER_ERROR
			);
		}
		const audioIdList = newAudioData.map((audio) => audio.audioApiId);
		const fullAudioData = await fetch(
			process.env.MUSIC_API_BASE_URL + `/songs?ids=${audioIdList.join(",")}`
		);
		let musicData: MusicAudioResponseParams[] = [];
		const data: FullMusicApiResponseParams = await fullAudioData.json();
		if (!data.success) {
			throw new AppError(
				"Something went wrong!",
				HttpStatusCodes.INTERNAL_SERVER_ERROR
			);
		}
		for (const item of data.data.results) {
			const audioSongData = await getMusicAudioByApiId(item.id);
			if (!audioSongData) {
				musicData.push({
					id: item.id,
					title: item.name,
					artists: item.artists.primary.map((artist) => artist.name).join(", "),
					poster: {
						url: item.image[0].url,
						width: Number(item.image[0].quality.split("x")[0]),
						height: Number(item.image[0].quality.split("x")[1]),
					},
					duration: item.duration,
					audioUrl: item.downloadUrl[2].url,
					isSaved: false,
					noOfMomentUse: 0,
				});
			} else {
				// Check for audio save status
				const isSaved = await isAudioSaved(clientAccountId, item.id);
				musicData.push({
					id: item.id,
					title: audioSongData.title,
					artists: audioSongData.artists,
					poster: audioSongData.poster,
					duration: audioSongData.duration,
					audioUrl: audioSongData.url,
					isSaved: isSaved,
					noOfMomentUse: audioSongData.meta.noOfMomentUse,
					mostUsedSection: audioSongData.bestSections
						? {
								from: audioSongData.bestSections[0].from,
								to: audioSongData.bestSections[0].to,
						  }
						: undefined,
				});
			}
		}
		return musicData;
	} catch (error) {
		console.error("Error fetching new audio data:", error);
		throw error; // Propagate the error to be handled by the controller
	}
};

export const getTrendingAudioService = async (
	clientAccountId: string
): Promise<MusicAudioResponseParams[]> => {
	try {
		const today = new Date(new Date().toISOString().split("T")[0]);
		// Simulate fetching new audio data
		const trendingAudioData = await getTrendingAudioData(today);
		if (!trendingAudioData || trendingAudioData.length === 0) {
			throw new AppError(
				"Something went wrong!",
				HttpStatusCodes.INTERNAL_SERVER_ERROR
			);
		}
		const audioIdList = trendingAudioData.map((audio) => audio.audioApiId);
		const fullAudioData = await fetch(
			process.env.MUSIC_API_BASE_URL + `/songs?ids=${audioIdList.join(", ")}`
		);
		let musicData: MusicAudioResponseParams[] = [];
		const data: FullMusicApiResponseParams = await fullAudioData.json();
		if (!data.success) {
			throw new AppError(
				"Something went wrong!",
				HttpStatusCodes.INTERNAL_SERVER_ERROR
			);
		}
		for (const item of data.data.results) {
			const audioSongData = await getMusicAudioByApiId(item.id);
			if (!audioSongData) {
				musicData.push({
					id: item.id,
					title: item.name,
					artists: item.artists.primary.map((artist) => artist.name).join(", "),
					poster: {
						url: item.image[0].url,
						width: Number(item.image[0].quality.split("x")[0]),
						height: Number(item.image[0].quality.split("x")[1]),
					},
					duration: item.duration,
					audioUrl: item.downloadUrl[2].url,
					isSaved: false,
					noOfMomentUse: 0,
				});
			} else {
				// Check for audio save status
				const isSaved = await isAudioSaved(clientAccountId, item.id);
				musicData.push({
					id: item.id,
					title: audioSongData.title,
					artists: audioSongData.artists,
					poster: audioSongData.poster,
					duration: audioSongData.duration,
					audioUrl: audioSongData.url,
					isSaved: isSaved,
					noOfMomentUse: audioSongData.meta.noOfMomentUse,
					mostUsedSection: audioSongData.bestSections
						? {
								from: audioSongData.bestSections[0].from,
								to: audioSongData.bestSections[0].to,
						  }
						: undefined,
				});
			}
		}
		return musicData;
	} catch (error) {
		console.error("Error fetching new audio data:", error);
		throw error; // Propagate the error to be handled by the controller
	}
};

export const searchMusicAudioService = async (
	clientAccountId: string,
	query: string,
	page: number = 1,
	limit: number = 10
): Promise<MusicAudioResponseParams[]> => {
	try {
		const fullAudioData = await fetch(
			process.env.MUSIC_API_BASE_URL +
				`/search/songs?query=${query}&page=${page}&limit=${limit}`
		);
		const data: FullMusicApiResponseParams = await fullAudioData.json();
		if (!data.success) {
			throw new AppError(
				"Something went wrong!",
				HttpStatusCodes.INTERNAL_SERVER_ERROR
			);
		}
		let musicData: MusicAudioResponseParams[] = [];
		for (const item of data.data.results) {
			const audioSongData = await getMusicAudioByApiId(item.id);
			if (!audioSongData) {
				musicData.push({
					id: item.id,
					title: item.name,
					artists: item.artists.primary.map((artist) => artist.name).join(", "),
					poster: {
						url: item.image[0].url,
						width: Number(item.image[0].quality.split("x")[0]),
						height: Number(item.image[0].quality.split("x")[1]),
					},
					duration: item.duration,
					audioUrl: item.downloadUrl[2].url,
					isSaved: false,
					noOfMomentUse: 0,
				});
			} else {
				// Check for audio save status
				const isSaved = await isAudioSaved(
					clientAccountId,
					audioSongData._id.toString()
				);
				musicData.push({
					id: item.id,
					title: audioSongData.title,
					artists: audioSongData.artists,
					poster: audioSongData.poster,
					duration: audioSongData.duration,
					audioUrl: audioSongData.url,
					isSaved: isSaved,
					noOfMomentUse: audioSongData.meta.noOfMomentUse,
					mostUsedSection: audioSongData.bestSections
						? {
								from: audioSongData.bestSections[0].from,
								to: audioSongData.bestSections[0].to,
						  }
						: undefined,
				});
			}
		}
		if (musicData.length === 0) {
			throw new AppError(
				"No audio found for the given query",
				HttpStatusCodes.NOT_FOUND
			);
		}
		return musicData;
	} catch (error) {
		console.error("Error fetching audio data:", error);
		throw error; // Propagate the error to be handled by the controller
	}
};

export const getSavedAudioService = async (
	clientAccountId: string
): Promise<SavedAudioResponseParams[] | null> => {
	try {
		const savedAudioList = await getSavedAudioList(clientAccountId);
		if (!savedAudioList || savedAudioList.length === 0) {
			return null; // No saved audio found
		}
		const audioData: SavedAudioResponseParams[] = [];
		for (const savedAudio of savedAudioList) {
			if (savedAudio.type === "music") {
				const musicAudio = await getMusicAudioById(savedAudio.audioId);
				if (musicAudio) {
					audioData.push({
						id: musicAudio.audioApiId,
						type: "music",
						title: musicAudio.title,
						artist: musicAudio.artists,
						poster: musicAudio.poster,
						duration: musicAudio.duration,
						audioUrl: musicAudio.url,
						isSaved: true,
						noOfMomentUse: musicAudio.meta.noOfMomentUse,
					}); // Attach the full audio data
				}
			} else {
				const originalAudio = await getOriginalAudioById(
					savedAudio.audioId.toString()
				);
				if (originalAudio) {
					const accountInfo = await getAccountById(
						originalAudio.associatedAccountId.toString()
					);
					if (
						accountInfo &&
						(!accountInfo.isDeleted || !accountInfo.isDeActivated)
					) {
						const isFollower = (await isAccountFollower(
							accountInfo._id.toString(),
							clientAccountId
						))
							? true
							: false;
						const isBlocked = (await isAccountBlocked(
							accountInfo._id.toString(),
							clientAccountId
						))
							? true
							: false;
						if (
							!isBlocked &&
							(!accountInfo.isPrivate ||
								(accountInfo.isPrivate && isFollower))
						) {
							audioData.push({
								id: originalAudio._id.toString(),
								type: "original",
								title: originalAudio.title,
								poster: originalAudio.poster,
								duration: originalAudio.duration,
								audioUrl: originalAudio.url,
								isSaved: true,
								noOfMomentUse: originalAudio.meta.noOfMomentUse,
								associatedAccountInfo: {
									id: accountInfo._id.toString(),
									userId: accountInfo.userId,
									profilePictureUri: accountInfo.profilePictureUri,
								},
							}); // Attach the full audio data
						}
					}
				}
			}
		}
		return audioData;
	} catch (error) {
		console.error("Error saving original audio:", error);
		throw error; // Propagate the error to be handled by the controller
	}
};

const recaliberateTrendingAudio = async (): Promise<void> => {
	try {
		const today = new Date(new Date().toISOString().split("T")[0]);
		const trendingAudioData = await audioUseCollection
			.aggregate([
				{
					$match: {
						date: {
							$gte: new Date(new Date().setDate(new Date().getDate() - 7)),
						},
					},
				},
				{
					$group: {
						_id: "$audioId",
						totalUses: { $sum: "$count" },
					},
				},
				{
					$sort: { totalUses: -1 },
				},
				{
					$limit: 20,
				},
				{
					$project: {
						_id: 0,
						audioId: "$_id",
					},
				},
			])
			.toArray();
		const trendingAudioIds: ObjectId[] = trendingAudioData.map(
			(audio) => audio.audioId
		);
		// 1. Clear previous trending audios for today (or the last recalibration run)
		//    This prevents duplicate entries if the job runs multiple times on the same day.
		await audioTrendingCollection.deleteMany({ date: today });

		// 2. Prepare documents for insertion into trendingAudioCollection
		const trendingAudioDocuments: TrendingAudio[] = trendingAudioIds.map(
			(audioId) => ({
				audioApiId: audioId,
				date: today, // Store the date when these audios were identified as trending
			})
		);

		// 3. Insert the new trending audios
		if (trendingAudioDocuments.length > 0) {
			await audioTrendingCollection.insertMany(trendingAudioDocuments);
			console.log(
				`Successfully recalibrated ${
					trendingAudioDocuments.length
				} trending audios for ${today.toISOString().split("T")[0]}.`
			);
		} else {
			console.log(
				`No trending audios found for ${today.toISOString().split("T")[0]}.`
			);
		}
	} catch (error) {
		throw error; // Propagate the error to be handled by the controller
	}
};
