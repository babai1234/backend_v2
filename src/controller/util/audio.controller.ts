import { NextFunction, Request, Response } from "express";
import {
	getNewAudioService,
	getSavedAudioService,
	getTrendingAudioService,
	searchMusicAudioService,
} from "../../service/util/audio.service";
import { CustomRequest, SearchRequestParams } from "../../types/util.type";
import { AppError } from "../../constants/appError";
import HttpStatusCodes from "../../constants/HttpStatusCodes";

export const getNewAudioController = async (
	req: CustomRequest,
	res: Response,
	next: NextFunction
): Promise<void> => {
	try {
		const clientAccountInfo = req.clientAccountInfo;
		if (!clientAccountInfo) {
			throw new AppError("Unauthorised", HttpStatusCodes.UNAUTHORIZED);
		}
		const musicAudioData = await getNewAudioService(clientAccountInfo._id.toString());
		res.status(200).json(musicAudioData);
	} catch (error) {
		next(error); // Pass the error to the error handling middleware
	}
};

export const getTrendingAudioController = async (
	req: CustomRequest,
	res: Response,
	next: NextFunction
): Promise<void> => {
	try {
		const clientAccountInfo = req.clientAccountInfo;
		if (!clientAccountInfo) {
			throw new AppError("Unauthorised", HttpStatusCodes.UNAUTHORIZED);
		}
		const musicAudioData = await getTrendingAudioService(
			clientAccountInfo._id.toString()
		);
		res.status(200).json(musicAudioData);
	} catch (error) {
		next(error); // Pass the error to the error handling middleware
	}
};

export const searchMusicAudioController = async (
	req: CustomRequest<{}, {}, {}, qs.ParsedQs & SearchRequestParams>,
	res: Response,
	next: NextFunction
): Promise<void> => {
	try {
		const clientAccountInfo = req.clientAccountInfo;
		if (!clientAccountInfo) {
			throw new AppError("Unauthorised", HttpStatusCodes.UNAUTHORIZED);
		}
		const { keyword, limit, page } = req.query;
		const musicAudioData = await searchMusicAudioService(
			clientAccountInfo._id.toString(),
			keyword,
			page,
			limit
		);
		if (!musicAudioData || musicAudioData.length === 0) {
			res.status(404).json({ message: "No audio found" });
		} else {
			res.status(200).json(musicAudioData);
		}
	} catch (error) {
		next(error); // Pass the error to the error handling middleware
	}
};

export const getSavedAudioController = async (
	req: CustomRequest,
	res: Response,
	next: NextFunction
): Promise<void> => {
	try {
		const clientAccountInfo = req.clientAccountInfo;
		if (!clientAccountInfo) {
			throw new AppError("Unauthorised", HttpStatusCodes.UNAUTHORIZED);
		}
		await getSavedAudioService(clientAccountInfo._id.toString());
		res.status(200);
	} catch (error) {
		next(error); // Pass the error to the error handling middleware
	}
};
