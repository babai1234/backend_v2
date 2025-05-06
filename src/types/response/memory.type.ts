import {
	AppearenceParams,
	Caption,
	Content,
	Link,
	Photo,
	Sticker,
	TransformParams,
} from "../util.type";
import { AccountResponseParams } from "./account.type";

export type MemoryResponseParams = {
	id: string;
	createdAt: string;
	isDeleted?: boolean;
	author: AccountResponseParams;
	expiredAt: string;
	content: Content;
	usedAfterEffect?: string;
	usedAudio?: string;
	captions?: Caption[];
	sticker?: Sticker;
	taggedLocation?: {
		id: string;
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
		highlight: string;
		timestamp: Date;
	}[];
	usedCameraTool?: "boomarang" | "layout";
	advancedOptions: {
		replySetting: "disabled" | "following" | "all";
		disableCirculation: boolean;
		disableSharing: boolean;
	};
	engagementSummary: {
		noOfViews: number;
		noOfLikes: number;
		noOfReplies: number;
		noOfShares: number;
		noOfCirculations: number;
	};
	isViewed: boolean;
	isLiked: boolean;
};

export type HighlightMemoryResponseParams = {
	id: string;
	name: string;
	poster?: Photo;
	selectedThumbnailMemoryInfo?: Photo;
	memoryInfo: MemoryResponseParams;
};

export type HighlightResponseParams = {
	id: string;
	name: string;
	poster?: {
		url: string;
		width: number;
		height: number;
	};
	createdBy: string;
	createdAt: string;
	noOfMemories: number;
	selectedThumbnailMemoryInfo?: Photo;
};

export type MemoryAttachmentResponseParams = {
	id: string;
	author: AccountResponseParams;
	thumbnail: Photo;
};

export type HighlightAttachmentResponseParams = {
	id: string;
	name: string;
	memoryInfo: MemoryAttachmentResponseParams;
};
