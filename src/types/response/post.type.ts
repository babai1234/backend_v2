import {
	AudioWithTitle,
	AudioWithUri,
	PhotoWithPreview,
	PostVideoParams,
} from "../util.type";
import { AccountResponseParams } from "./account.type";

export type PostGeneralParams<T extends {} = {}> = {
	id: string;
	createdAt: string;
	caption?: string;
	taggedLocation?: LocationWithName;
	engagementSummary: {
		noOfLikes: number;
		noOfComments: number;
		noOfViews: number;
	};
	advancedSettings: {
		commentDisabled: boolean;
		hideLikesAndViewsCount: boolean;
	};
	metadata: {
		href: string;
		isLiked: boolean;
		isSaved: boolean;
		isPinned: boolean;
		isViewed: boolean;
		mutualLikes: AccountResponseParams[];
	};
} & T;

export type LocationWithName = {
	id: string;
	name: string;
};

export type PostResponseGeneralParams<T extends {}> = PostGeneralParams<
	{
		author: AccountResponseParams;
	} & T
>;

export type PostPhotoAccountTagResponseParams = {
	account: AccountResponseParams;
	position: {
		index: number;
		coord: {
			x: number;
			y: number;
		};
	}[];
};

export type PhotoPostResponseParams = PostResponseGeneralParams<{
	photos: PhotoWithPreview[];
	usedAudio?: AudioWithUri | null;
	taggedAccounts?: PostPhotoAccountTagResponseParams[];
}>;

export type MomentPostResponseParams = PostResponseGeneralParams<{
	video: PostVideoParams;
	taggedAccounts?: AccountResponseParams[];
	usedAudio?: AudioWithTitle | null;
}>;

export type ClipPostResponseParams = PostResponseGeneralParams<{
	video: PostVideoParams;
	taggedAccounts?: AccountResponseParams[];
}>;

export type PostResponseParams =
	| ({ type: "photo" } & PhotoPostResponseParams)
	| ({ type: "moment" } & MomentPostResponseParams)
	| ({ type: "clip" } & ClipPostResponseParams);
