interface message {
	text?: string; //No limit
	attachment?:
		| ({ type: "photo" } & {
				photoPostId: string;
		  })
		| ({ type: "clip" } & { clipPostId: string })
		| ({ type: "moment" } & { momentPostId: string })
		| ({ type: "account" } & { accountId: string })
		| ({ type: "audio" } & { audioId: string })
		| ({ type: "memory" } & { memoryId: string })
		| ({ type: "highlight" } & {
				highlighInfo: {
					highlightId: string;
					memoryId: string;
				};
		  })
		| ({ type: "file" } & {
				fileBlob: FileBlob[];
				links: MediaInfo[];
		  })
		| ({ type: "text" } & {
				text: string;
		  });
	repliedTo?: string;

	sendTo: string; //Either groupId or recipientId
}
type FileBlob = {};
type MediaInfo = {};

// Expected fields from the memory uplod request handler

type MemoryUploadParams = {
	captions?: CaptionMetadata[];
	taggedLocation?: LocationMetadata;
	link?: LinkMetadata;
	associatedAudio?: string;
	poll?: PollInfo;
	starRating?: StarRating;
	replyMode: boolean;
	media: {
		width: number;
		height: number;
		fileSize: number;
		duration: number | null;
		mute: boolean | null;
	};
};

type CaptionMetadata = {
	text: string;
	color: string;
	style: string;
	fontFamily: string;
	enteringAnimation: string;
} & StickerInfo;

type LocationMetadata = {
	id: string;
	name: string;
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

// Client side memory file processing
// 1. For photo and video the max and min allowed file size will be different
// 2. If only the selected file is in between the range the post processing will be allowed
// 3. Incase of photo the allowed ext is jpg or png
// 4. User will select a filter(Optional) and the post processing will involve applying the filter, changing the resolution of the file
// 	  to fullHd incase the file reslotuion is more than 1080p, and also make necessary adjustments to change the aspect ratio of the
// 	  photo to portrait
// 5. For Photos post-processing will also invlove changing the file extension to jpeg only and use a proper compression
// 	  depending on resulting file size
// 6. Incase of videos only h264, h265 encoded videos are allowed with mp4 extension, the uploaded video file will be transcoded to vp9 encoder
//    in the server
// 7. For both video and photo the selected media file will be merged with a blured out version of the media file, thus forcing the output resolution
//    of the media file to be portrait.
//    NOTE: Incase of photo the blured out background will be the photo itself and incase of videos the background will be the first frame of the video
