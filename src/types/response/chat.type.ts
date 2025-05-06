import {
	AttachmentResponseParams,
	BannerResponseParams,
	MessageReplyInfo,
} from "../util.type";

export type MessageResponseParams = {
	id: string;
	author: string;
	sentAt: number;
	seenBy: string[];
	reactions?: {
		accountId: string;
		emoji: string;
		reactedAt: string;
	}[];
	data:
		| ({
				type: "text";
		  } & {
				content: string;
		  })
		| ({
				type: "reply";
		  } & {
				repliedInfo: MessageReplyInfo;
				attachment: AttachmentResponseParams;
				content: string;
		  })
		| ({
				type: "attachment";
		  } & {
				attachment: AttachmentResponseParams;
				caption?: string;
		  })
		| ({
				type: "banner";
		  } & {
				bannerInfo: BannerResponseParams;
		  });
};
