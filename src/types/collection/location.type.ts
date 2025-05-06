import { ObjectId } from "mongodb";

export type Location = {
	createdAt: Date;
	placeId: string;
	license: string;
	osmType: string;
	osmId: string;
	latitude: number;
	langitude: number;
	type: string;
	category: string;
	addressType: string;
	formattedAddress: string;
	name: string;
	importance: number;
	placeRank: number;
	boundingBox: number[];
	addressComponents: {
		type: string;
		name: string;
	}[];
	meta: {
		noOfVisits: number;
		noOfSearches: number;
		noOfShares: number;
		noOfPostUse: number;
		noOfMemoryUse: number;
	};
};

export type LocationVisit = {
	locationId: ObjectId;
	visitedBy: ObjectId;
	visitedAt: Date;
};
