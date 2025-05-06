import { ObjectId } from "mongodb";
import { AttachmentParams, BannerParams, ReplyAttachmentParams } from "../util.type";

export type OneToOneChat = {
	participants: [
		{
			accountId: ObjectId;
			isDeleted: boolean;
			isMember: boolean;
			joinedAt: Date;
			isPinned: boolean;
			isMuted: boolean;
			lastActiveAt?: Date;
			participantLastMessageSentAt?: Date;
		},
		{
			accountId: ObjectId;
			isDeleted: boolean;
			isMember: boolean;
			joinedAt: Date;
			isPinned: boolean;
			isMuted: boolean;
			lastActiveAt?: Date;
			participantLastMessageSentAt?: Date;
		}
	];
	lastMessageSentAt: Date;
};

export type GroupChat = {
	participants: GroupChatParticipant[];
	lastMessageSentAt: Date;
	displayPicture?: string;
	name: string;
};

export type GroupMessage = {
	sender: ObjectId;
	chatId: ObjectId;
	sentAt: Date;
	reactions?: {
		accountId: ObjectId;
		emoji: string;
		reactedAt: Date;
	}[];
	deletedBy?: ObjectId[];
	seenBy: ObjectId[];
	data:
		| ({
				type: "text";
		  } & {
				content: {
					text: string;
					keyword: string[];
				};
		  })
		| ({
				type: "reply";
		  } & {
				repliedInfo: {
					messageId: ObjectId;
					repliedTo: ObjectId;
				};
				attachment: ReplyAttachmentParams;
				content: {
					text: string;
					keyword: string[];
				};
		  })
		| ({
				type: "attachment";
		  } & {
				attachment: AttachmentParams;
				content?: {
					text: string;
					keyword: string[];
				};
		  })
		| ({
				type: "banner";
		  } & {
				bannerInfo: BannerParams;
		  });
};

export type ChatMessage = {
	sender: ObjectId;
	receiver: ObjectId;
	sentAt: Date;
	reactions?: {
		accountId: ObjectId;
		emoji: string;
		reactedAt: Date;
	}[];
	deletedBy?: ObjectId[];
	seenBy: ObjectId[];
	data:
		| ({
				type: "text";
		  } & {
				content: {
					text: string;
					keyword: string[];
				};
		  })
		| ({
				type: "reply";
		  } & {
				repliedInfo: {
					messageId: ObjectId;
					repliedTo: ObjectId;
				};
				attachment: ReplyAttachmentParams;
				content: {
					text: string;
					keyword: string[];
				};
		  })
		| ({
				type: "attachment";
		  } & {
				attachment: AttachmentParams;
				content?: {
					text: string;
					keyword: string[];
				};
		  });
};

export type GroupChatParticipant = {
	accountId: ObjectId;
	joinedAt: Date;
	isPinned: boolean;
	isMuted: boolean;
	isMember: boolean;
	isAdmin: boolean;
	lastActiveAt?: Date;
	invitedBy?: ObjectId;
};
