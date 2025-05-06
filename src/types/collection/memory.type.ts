import { ObjectId } from "mongodb";
import {
	AppearenceParams,
	Caption,
	Content,
	Link,
	Sticker,
	TransformParams,
} from "../util.type";
export type Memory = {
	createdAt: Date;
	isDeleted: Boolean;
	author: ObjectId;
	expiredAt: Date;
	content: Content;
	usedAfterEffect?: ObjectId;
	usedAudio?: ObjectId;
	captions?: Caption[];
	sticker?: Sticker;
	taggedLocation?: {
		id: ObjectId;
		name: string;
		zIndex: number;
		appearence: AppearenceParams;
		transform: TransformParams;
	};
	link?: {
		zIndex: number;
		appearence: AppearenceParams;
		transform: TransformParams;
	} & Link;
	addedTo?: {
		highlight: ObjectId;
		timestamp: Date;
	}[];
	isBoomerang: boolean;
	advancedOptions: {
		replySetting: "DISABLED" | "DIRECT_MESSAGE" | "ASK_A_QUESTION";
		reactionSetting: "SINGLE" | "MULTIPLE";
	};
	engagementSummary: {
		noOfViews: number;
		noOfLikes: number;
		noOfReplies: number;
		noOfShares: number;
		noOfCirculations: number;
	};
	meta: {
		hashtags?: string[];
		mentions?: string[];
		keywords?: string[];
		emojis?: string[];
	};
};

export type MemoryView = {
	memoryId: ObjectId;
	viewedBy: ObjectId;
	viewedAt: Date;
};

export type MemoryLike = {
	memoryId: ObjectId;
	likedBy: ObjectId;
	likedAt: Date;
};

export type MemoryReply = {
	memoryId: ObjectId;
	text: string;
	repliedBy: ObjectId;
	repliedAt: Date;
};

export type MemoryStickerResponse = {
	memoryId: ObjectId;
	respondedBy: ObjectId;
	respondedAt: Date;
	stickerType: "poll" | "star-rating";
	response: number | string;
};

export type HighLight = {
	name: string;
	poster?: {
		url: string;
		width: number;
		height: number;
	};
	createdBy: ObjectId;
	createdAt: Date;
	noOfMemories: number;
	selectedThumbnailMemoryId?: ObjectId;
};
