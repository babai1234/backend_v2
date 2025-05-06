import { ObjectId } from "mongodb";
import { Photo } from "../util.type";

export type Audio = {
	url: string;
	duration: number;
	createdAt: Date;
	isDeleted: boolean;
	isAvailable: boolean;
	type: "original" | "song";
	uploadedBy: "admin" | "user";
	associatedAccountId?: ObjectId;
	title?: string;
	artist?: string;
	poster?: Photo;
	preview?: {
		url: string;
		start: number;
		end: number;
	};
	genres?: string[];
	bestSections?: { from: number; to: number }[];
	meta: {
		noOfPostUse: number;
		noOfMemoryUse: number;
		noOfVisits: number;
		noOfSearches: number;
		noOfShares: number;
		noOfSaves: number;
	};
	status: "PROCESSING" | "SUCCESSFULL" | "FAILED";
};

export type AudioSave = {
	audioId: ObjectId;
	savedBy: ObjectId;
	savedAt: Date;
};

export type AudioVisit = {
	audioId: ObjectId;
	visitedBy: ObjectId;
	visitedAt: Date;
};
