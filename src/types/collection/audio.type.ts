import { ObjectId } from "mongodb";
import { AudioSaveList, Photo } from "../util.type";

type Audio = {
	url: string;
	duration: number;
	createdAt: Date;
	isDeleted: boolean;
	isAvailable: boolean;
	title: string;
	poster: Photo;
	meta: {
		noOfPhotoUse: number;
		noOfMomentUse: number;
		noOfMemoryUse: number;
		noOfVisits: number;
		noOfSearches: number;
		noOfShares: number;
		noOfSaves: number;
	};
};

export type MusicAudio = {
	artists: string;
	genres?: string[];
	bestSections?: { from: number; to: number; count: number }[];
	audioApiId: string;
	status: "PROCESSING" | "SUCCESSFULL" | "FAILED";
} & Audio;

export type OriginalAudio = {
	associatedAccountId: ObjectId;
	status: "PROCESSING" | "SUCCESSFULL" | "FAILED";
} & Audio;

export type NewAudio = {
	audioApiId: string;
};

export type TrendingAudio = {
	audioApiId: ObjectId;
	date: Date;
};

export type AudioSave = {
	audioIdList: AudioSaveList[];
	savedBy: ObjectId;
};

export type AudioUse = {
	audioId: ObjectId;
	date: Date;
	count: number;
};
