import { ObjectId } from "mongodb";
import { AccountTag, PhotoWithPreview, PostVideoParams } from "../util.type";

type Post = {
	createdAt: Date;
	caption?: string;
	meta?: {
		mentions?: string[];
		keywords?: string[];
		hashtags?: string[];
		emojis?: string[];
		topics?: string[];
	};
	taggedLocation?: {
		id: ObjectId;
		name: string;
		osmId: string;
	};
	engagementSummary: {
		noOfLikes: number;
		noOfComments: number;
		noOfViews: number;
		noOfShares: number;
	};
	advancedSettings: {
		commentDisabled: boolean;
		hideLikesAndViewsCount: boolean;
	};
	author: ObjectId;
	status: "PROCESSING" | "SUCCESSFULL" | "FAILED";
};

export type PhotoPost = {
	photos: PhotoWithPreview[];
	usedAudio?: {
		id: ObjectId;
		usedSection: [number, number];
	};
	taggedAccounts?: AccountTag[];
} & Post;

export type MomentPost = {
	video: PostVideoParams;
	taggedAccounts?: ObjectId[];
	usedAudio?: {
		id: ObjectId;
		usedSection: [number, number];
	};
} & Post;

export type ClipPost = {
	video: PostVideoParams;
	taggedAccounts?: ObjectId[];
} & Post;

export type Comment = {
	createdAt: Date;
	author: ObjectId;
	text: string;
	postId: ObjectId;
	repliedTo?: ObjectId;
	mentions?: string[];
	keywords?: string[];
	meta: {
		noOfLikes: number;
		noOfReplies: number;
	};
};
