import { ObjectId, WithId } from "mongodb";
import {
	AccountAttachmentResponseParams,
	AccountResponseParams,
} from "./response/account.type";
import { AudioAttachmentResponseParams } from "./response/audio.type";
import {
	ClipPostResponseParams,
	MomentPostResponseParams,
	PhotoPostResponseParams,
} from "./response/post.type";
import {
	HighlightAttachmentResponseParams,
	MemoryAttachmentResponseParams,
} from "./response/memory.type";
import { Request } from "express";
import { Account } from "./collection/account.type";

export type Photo = {
	url: string;
	width: number;
	height: number;
};

export type Video = {
	duration: number;
} & Photo;

type PhotoPostContent = {
	thumbnail: Photo;
	backgroundAudioUrl?: string;
} & Photo;

type VideoPostContent = {
	videoType: "moment" | "clip";
	isMuted: boolean;
	thumbnail: Photo;
} & Video;

export type PostContent = {
	type: "photo" | "video";
	data: PhotoPostContent[] | VideoPostContent;
};

export type GeoLocationInfo = {
	/**
	 * The latitude coordinate of the location.
	 * @type {number}
	 */
	latitude: number;

	/**
	 * The longitude coordinate of the location.
	 * @type {number}
	 */
	longitude: number;

	/**
	 * The country code of the location.
	 * @type {string}
	 */
	countryCode: string;

	/**
	 * The country name of the location.
	 * @type {string}
	 */
	country: string;

	/**
	 * The region or state name of the location.
	 * @type {string}
	 */
	region: string;

	/**
	 * The sub-region or city name of the location.
	 * @type {string}
	 */
	subRegion: string;
};

export type TextContent = {
	hashtags?: string[];
	mentions?: string[];
	keywords?: string[];
	emojis?: string[];
};

export type Link = {
	/**
	 * The title or label for the link.
	 * @type {string}
	 */
	title: string;

	/**
	 * The URL of the external link.
	 * @type {string}
	 */
	url: string;
};

export interface Reports {
	reportedBy: string;
	reportedAt: number;
	reportedOn: "post" | "comment" | "memory" | "account";
	reportedAccountId?: string;
	reportedPostId?: string;
	reportedCommentId?: string;
	reportedMemoryId?: string;
	category: string;
	subCategory?: string;
	description?: string;
}

export type Editables = {
	caption?: string;
	meta?: {
		hashtags?: string[];
		mentions?: string[];
		keywords?: string[];
		emojis?: string[];
	};
	location?: LocationTag;
	tags?: {
		accountId: string;
		coordinates?: { x: number; y: number };
		index?: number;
	}[];
};

export type AccountTag = {
	accountId: ObjectId;
	position: {
		index: number;
		coord: {
			x: number;
			y: number;
		};
	}[];
};

export type LocationTag = {
	id: ObjectId;
	name: string;
};

export type LocationAddressComponent = {
	type: string;
	name: string;
};

export type AudioWithTitle = {
	id: string;
	title: string;
};

export type AudioWithUri = {
	uri: string;
	usedSection: [number, number];
} & AudioWithTitle;

export type PhotoWithHash = {
	uri: string;
	blurhash: string;
	width: number;
	height: number;
};

export type PhotoWithPreview = {
	preview: string;
} & PhotoWithHash;

export type PostVideoParams = {
	uri: string;
	poster: PhotoWithHash;
	preview: string;
	duration: number;
	muted: boolean;
};

export type PageResponse<T> = {
	items: T[];
	hasEndReached: boolean;
	endCursor: string;
};

export type OneToOneChatTextMessageUploadRequestParams = {
	content: string;
	sentTo: string;
	repliedInfo?: MessageReplyInfo;
};

export type OneToOneChatFileAttachmentUploadRequestParams = {
	sentTo: string;
	fileDataList: FileAttachmentInfo[];
	caption?: string;
};

export type FileAttachmentInfo = {
	width: number;
	height: number;
	blurHash: string;
	duration?: number;
	fileName: string;
	mediaType: "image" | "video";
};

export type OneToOneChatPostAttachmentUploadRequestParams = {
	sentTo: string;
	postId: string;
	caption?: string;
};

export type OneToOneChatAccountAttachmentUploadRequestParams = {
	sentTo: string;
	accountId: string;
	caption?: string;
};

export type OneToOneChatAudioAttachmentUploadRequestParams = {
	sentTo: string;
	type: "Original" | "Music";
	audioId: string;
	caption?: string;
};

export type OneToOneChatMemoryAttachmentUploadRequestParams = {
	sentTo: string;
	memoryId: string;
	caption?: string;
};

export type OneToOneChatHighlightAttachmentUploadRequestParams = {
	sentTo: string;
	memoryId: string;
	highlightId: string;
	caption?: string;
};

export type CreateGroupChatRequestParams = {
	name: string;
	participantIdList: string[];
	displayPicture?: string;
};

export type GroupChatTextMessageUploadRequestParams = {
	chatId: string;
	content: string;
	repliedInfo?: MessageReplyInfo;
};

export type GroupChatFileAttachmentUploadRequestParams = {
	chatId: string;
	fileDataList: FileAttachmentInfo[];
	caption?: string;
};

export type GroupChatPostAttachmentUploadRequestParams = {
	chatId: string;
	postId: string;
	caption?: string;
};

export type GroupChatAccountAttachmentUploadRequestParams = {
	chatId: string;
	accountId: string;
	caption?: string;
};

export type GroupChatAudioAttachmentUploadRequestParams = {
	chatId: string;
	type: "Original" | "Music";
	audioId: string;
	caption?: string;
};

export type GroupChatMemoryAttachmentUploadRequestParams = {
	chatId: string;
	memoryId: string;
	caption?: string;
};

export type GroupChatHighlightAttachmentUploadRequestParams = {
	chatId: string;
	memoryId: string;
	highlightId: string;
	caption?: string;
};

export type ImageFile = {
	uri: string;
	width: number;
	height: number;
	placeholder: string;
};

export type VideoFile = {
	duration: number;
	thumbnail: string;
} & ImageFile;

export type TransformParams = {
	scale: number;
	rotation: number;
	translation: { x: number; y: number };
};

export type PollSticker = {
	options: string[];
	responseSummary: {
		totalVotes: number;
		voteCount: {
			option: string;
			voteCount: number;
		}[];
	};
};

export type StarRatingSticker = {
	responseSummary: {
		totalRatings: number;
		ratingCounts: { star: number; vote: number }[];
	};
};

export type Sticker = {
	transform: TransformParams;
	color: string;
	zIndex: number;
	text: string;
} & (({ type: "star-rating" } & StarRatingSticker) | ({ type: "poll" } & PollSticker));

export type Content = {
	type: "photo" | "video";
	thumbnail: Photo;
	url: string;
	width: number;
	height: number;
	duration?: number;
};

export type AppearenceParams = {
	color: string;
	style: string;
};

export type Caption = {
	text: string;
	animation: string;
	fontFamily: string;
	zIndex: number;
	transform: TransformParams;
	appearence: AppearenceParams;
};

export type MessageReplyInfo = {
	repliedTo: string;
	messageId: string;
};

export type AttachmentParams =
	| ({ type: "file" } & {
			file: (ImageFile | VideoFile)[];
	  })
	| ({
			type: "account" | "photo" | "moment" | "clip" | "memory";
	  } & {
			id: ObjectId;
	  })
	| ({
			type: "audio";
	  } & {
			id: ObjectId;
			audioType: "original" | "music";
	  })
	| ({ type: "highlight" } & {
			highlightInfo: {
				highlightId: ObjectId;
				memoryId: ObjectId;
			};
	  });

export type ReplyAttachmentParams =
	| ({ type: "file" } & {
			file: (ImageFile | VideoFile)[];
	  })
	| ({ type: "text" } & {
			content: string;
	  })
	| ({
			type: "account" | "photo" | "moment" | "clip" | "memory";
	  } & {
			id: ObjectId;
	  })
	| ({
			type: "audio";
	  } & {
			id: ObjectId;
			audioType: "Original" | "Music";
	  })
	| ({ type: "highlight" } & {
			highlightInfo: {
				highlightId: ObjectId;
				memoryId: ObjectId;
			};
	  });

export type AttachmentResponseParams =
	| ({ type: "file" } & {
			file: (ImageFile | VideoFile)[];
	  })
	| ({ type: "text" } & {
			content: string;
	  })
	| ({ type: "account" } & {
			accountInfo: AccountAttachmentResponseParams | null;
	  })
	| ({ type: "audio" } & {
			audioInfo: AudioAttachmentResponseParams | null;
	  })
	| ({ type: "photo" } & {
			photoPostInfo: PhotoPostResponseParams | null;
	  })
	| ({ type: "moment" } & {
			momentPostInfo: MomentPostResponseParams | null;
	  })
	| ({ type: "clip" } & {
			clipPostInfo: ClipPostResponseParams | null;
	  })
	| ({ type: "memory" } & {
			memoryInfo: MemoryAttachmentResponseParams | null;
	  })
	| ({ type: "highlight" } & {
			highlightInfo: HighlightAttachmentResponseParams | null;
	  });

export type BannerResponseParams =
	| ({ type: "groupLeave" } & {
			expelledByInfo: AccountResponseParams;
			accountInfo: AccountResponseParams;
	  })
	| ({
			type: "groupMemberAdd";
	  } & {
			invitedByInfo: AccountResponseParams;
			accountInfo: AccountResponseParams;
	  })
	| ({ type: "groupDisplayPictureChange" } & {
			accountInfo: AccountResponseParams;
	  })
	| ({ type: "groupNameChange" } & {
			accountInfo: AccountResponseParams;
	  });

export type BannerParams =
	| ({ type: "groupLeave" } & {
			expelledById: ObjectId;
			accountId: ObjectId;
	  })
	| ({
			type: "groupMemberAdd";
	  } & {
			invitedById: ObjectId;
			accountId: ObjectId;
	  })
	| ({ type: "groupDisplayPictureChange" } & {
			accountId: ObjectId;
	  })
	| ({ type: "groupNameChange" } & {
			accountId: ObjectId;
	  })
	| ({ type: "groupCreate" } & {
			accountId: ObjectId;
	  });

export type PhotoPayloadParams = {
	type: "photo";
	id: string;
	caption?: string;
};

export type MomentPayloadParams = {
	type: "moment";
	id: string;
	caption?: string;
};

export type ClipPayloadParams = {
	type: "clip";
	id: string;
	caption?: string;
};

export type AccountPayloadParams = {
	type: "account";
	id: string;
	caption?: string;
};

export type AudioPayloadParams = {
	type: "audio";
	id: string;
	audioType: "original" | "music";
	caption?: string;
};

export type MemoryPayloadParams = {
	type: "memory";
	id: string;
	caption?: string;
};

export type HighlightPayloadParams = {
	type: "highlight";
	highlightId: string;
	memoryId: string;
	caption?: string;
};

export type TextPayloadParams = {
	type: "text";
	content: string;
};

export type FilePayloadParams = {
	type: "file";
	file: (ImageFile | VideoFile)[];
	caption?: string;
};

export type AttachmentPayloadParams =
	| PhotoPayloadParams
	| MomentPayloadParams
	| ClipPayloadParams
	| AccountPayloadParams
	| AudioPayloadParams
	| MemoryPayloadParams
	| HighlightPayloadParams
	| FilePayloadParams;

export type PayloadParams = AttachmentPayloadParams | TextPayloadParams;

export type FileMetadata = {
	width: number;
	height: number;
	duration?: number;
	videoBitrate?: number;
	frameRate?: number;
	audioBitrate?: number;
	size?: number;
};

export type FileProcessingProps = {
	width: number;
	height: number;
	bitrate?: number;
};

export type ValidSchemaFields = { body?: string[]; params?: string[]; query?: string[] };

export type MemoryUploadParams = {
	captions?: CaptionMetadata[];
	addedHighlights?: string[];
	taggedLocation?: LocationMetadata;
	link?: LinkMetadata;
	usedAudioId?: string;
	poll?: PollInfo;
	starRating?: StarRating;
	usedAfterEffect?: string;
	isBoomerang: boolean;
	reactionMode: "SINGLE" | "MULTIPLE";
	replyMode: "DISABLED" | "DIRECT_MESSAGE" | "ASK_A_QUESTION";
	media: {
		width: number;
		height: number;
		thumbnailWidth: number;
		thumbnailHeight: number;
		fileSize: number;
		duration: number | null;
		mute: boolean | null;
		fileName: string;
		blurHash: string | null;
		type: "video" | "image";
	};
};

export type LocationData = {
	locationId: string;
	name: string;
	coord: {
		latitude: number;
		longitude: number;
	};
	fullAddress: string;
};

type CaptionMetadata = {
	text: string;
	color: string;
	style: string;
	fontFamily: string;
	enteringAnimation: string;
} & StickerInfo;

type LocationMetadata = {
	name: string;
	osmId: string;
	style: string;
	color: string;
} & StickerInfo;

type LinkMetadata = {
	title: string;
	href: string;
	style: string;
	color: string;
} & StickerInfo;

type StickerInfo = {
	position: {
		x: number;
		y: number;
	};
	scale: number;
	rotation: number;
	zIndex: number;
};

type PollInfo = {
	color: string;
	options: string[];
	title: string;
} & StickerInfo;

type StarRating = {
	color: string;
	title: string;
} & StickerInfo;

export type AdvancedVideoMetaData = {
	width: number;
	height: number;
	duration: number;
	videoBitrate: number;
	audioBitrate: number;
	videoCodec: string;
	audioCodec: string;
};

export type PostPresignRequestParams = {
	postFileName: string[];
};

export type FilePresignRequestParams = {
	mediaType: "video" | "image";
	fileName: string;
};

export type AttchmentPresignRequestParams = {
	attachmentPresignParams: FilePresignRequestParams[];
	sentTo: string;
};

export type PresignResponseParams = { original: string; thumbnail: string };

export type PostFileParams = {
	fileName: string;
	width: number;
	height: number;
	hash: string;
	duration?: number;
	videoBitrate?: number;
	audioBitrate?: number;
	frameRate?: number;
};

export type PostCommentUploadParams = {
	postId: string;
	comment: string;
	repliedTo?: string;
};

export type PhotoPostUploadParams = {
	caption?: string; // 400 characters word limit
	taggedLocation?: {
		osmId: string;
		name: string;
	};
	usedAudio?: {
		id: string;
		usedSection: [number, number];
	};
	taggedAccounts?: {
		accountId: string;
		position: {
			index: number;
			coord: {
				x: number;
				y: number;
			};
		}[];
	}[];
	topics?: string[];
	postFileInfo: PostFileParams[];
	advancedOptions: {
		commentDisabled: boolean;
		hideEngagement: boolean;
	};
};

export type MomentPostUploadParams = {
	caption?: string; // 400 characters word limit
	taggedLocation?: {
		osmId: string;
		name: string;
	};
	usedAudio?: {
		type: "music" | "original";
		id: string;
		usedSection: [number, number];
	};
	taggedAccounts?: string[];
	topics?: string[];
	postFileInfo: PostFileParams;
	advancedOptions: {
		commentDisabled: boolean;
		hideEngagement: boolean;
	};
	videoCategory?: string;
	isMute: boolean;
};

export type PostRetryUploadParams = {
	jobId: string;
};

export type ClipPostUploadParams = {
	caption?: string; // 400 characters word limit
	taggedLocation?: {
		osmId: string;
		name: string;
	};
	taggedAccounts?: string[];
	topics?: string[];
	postFileInfo: PostFileParams;
	advancedOptions: {
		commentDisabled: boolean;
		hideEngagement: boolean;
	};
	videoCategory?: string;
	isMute: boolean;
};

export type PostUploadRequestParams<T> = {
	metadata: T;
};

type VideoMetaData = {
	duration: number;
	size: number;
	width: number;
	height: number;
	isMute: boolean;
};

export type CustomRequest<
	Params = {},
	ResBody = any,
	ReqBody = any,
	ReqQuery = any,
	Locals extends Record<string, any> = Record<string, any>
> = Request<Params, ResBody, ReqBody, ReqQuery, Locals> & {
	clientAccountInfo?: WithId<Account>;
};

export type MediaFile = {
	mimetype: string;
	filename: string;
};

export type PostProcessLambdaEvent = {
	bucketName: string;
	client: WithId<Account>;
	postUploadInfo:
		| ({ postType: "photo" } & {
				metaData: PhotoPostUploadParams;
				file: MediaFile[];
		  })
		| ({ postType: "moment" } & {
				metaData: MomentPostUploadParams;
				file: MediaFile;
		  })
		| ({ postType: "clip" } & { metaData: ClipPostUploadParams; file: MediaFile })
		| ({ postType: "memory" } & {
				metaData: MemoryUploadParams[];
				file: MediaFile[];
		  })
		| ({ postType: "attachment" } & {
				metaData: any;
				file: MediaFile[];
		  });
};

export type SearchRequestParams = {
	keyword: string;
	page: number;
	limit: number;
};

export type AudioSaveList = { savedAt: Date } & (
	| { type: "music"; audioId: string }
	| { type: "original"; audioId: ObjectId }
);
