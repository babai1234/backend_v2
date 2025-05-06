import { ChatSettings } from "../collection/account.type";

export type AccountResponseParams = {
	//required properties
	id: string;
	userId: string;
	profilePictureUri: string;
	//optional properties
	name?: string;
	bio?: string;
	broadcastTopic?: string;
	noOfPosts?: number;
	noOfTaggedPosts?: number;
	noOfFollowings?: number;
	noOfFollowers?: number;
	hasFollowedClient?: boolean;
	hasRequestedToFollowClient?: boolean;
	isAvailable?: boolean;
	isMemoryHidden?: boolean;
	isPrivate?: boolean;
	isBlocked?: boolean;
	isFollowed?: boolean;
	isRequestedToFollow?: boolean;
	isFavourite?: boolean;
	memoryInfo?: {
		noOfAvailableMemories: number;
		noOfUnseenMemories: number;
	};
	lastSeenAt?: string;
	chatSettings?: ChatSettings;
	//mute settings if the account is followed by the client
	muteSettings?: {
		post: boolean;
		memory: boolean;
	};
	//notification settings if the account is followed by the client
	notificationSettings?: {
		memory: boolean;
		photo: boolean;
		moment: boolean;
	};

	postMeta?: {
		hasPhotos: boolean;
		hasMoments: boolean;
	};
};

export type AccountAttachmentResponseParams = {
	id: string;
	userId: string;
	profilePictureUri: string;
	name: string;
	noOfPosts: number;
	noOfFollowers: number;
};
