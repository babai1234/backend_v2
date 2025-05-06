import { ObjectId } from "mongodb";
import { GeoLocationInfo, Link, TextContent } from "../util.type";

export type ContactInfo = {
	type: "phone-number" | "email-address";
	value: string;
};

export type TwoStepAuthenticationInfo = {
	enabled: boolean;
	mechanism?: ContactInfo;
};

export type SecurityInfo = {
	passwordHash: string;
	twoStepAuthInfo: TwoStepAuthenticationInfo;
	noOfActiveSessions: number;
};

export type PersonalInfo = {
	dateOfBirth?: number;
	gender?: string;
	contactInfo: ContactInfo;
};

export type NotificationSettings = {
	broadcastTopic: string;
	mentions: "all" | "following" | "off";
	postLike: "all" | "following" | "off";
	postComment: "all" | "following" | "off";
	postTags: "all" | "following" | "off";
	taggedPostLike: "all" | "following" | "off";
	taggedPostComment: "all" | "following" | "off";
	commentLike: "all" | "following" | "off";
	commentReplies: "all" | "following" | "off";
	memoryReactions: "all" | "following" | "off";
	memoryReplies: "all" | "following" | "off";
	stickerInterctions: "all" | "following" | "off";
	orginalAudio: "on" | "off";
	remixes: "on" | "off";
	messageRequests: "on" | "off";
	messages: "on" | "off";
	followRequest: "on" | "off";
	followRequestAccepted: "on" | "off";
	startedFollow: "on" | "off";
};

export type PrivacySettings = {
	allowMentions: "everyone" | "following" | "none";
	allowTags: "everyone" | "following" | "none";
	customOffensiveKeywords: string[];
	chatSettings: ChatSettings;
	commentSettings: {
		hideOffensiveComments: boolean;
		noOfBlockedAccounts: number;
	};
	memorySettings: {
		noOfHiddenAccounts: number;
	};
};

export type MessageRequestSettings = {
	others: boolean;
	following: boolean;
	contacts: boolean;
};

export type ChatSettings = {
	messageRequests: MessageRequestSettings;
	groupInvitations: MessageRequestSettings;
	hideOffensiveMessageRequests: boolean;
};

export type SuggestionSettings = {
	noOfNotInterestedAccounts: number;
	customSensetiveKeywords: string[];
};

export type Account = {
	/**
	 * The timestamp indicating when the account was created.
	 * @type {number}
	 */
	createdAt: Date;

	/**
	 * The geolocation information where the account was created.
	 * @type {GeoLocationInfo}
	 */
	createdFrom: GeoLocationInfo;

	/**
	 * The username of the user.
	 * @type {string}
	 */
	userId: string;

	/**
	 * The full name of the user.
	 * @type {string}
	 */
	name: string;

	/**
	 * Optional URL of the user's profile picture.
	 * @type {string | undefined}
	 */
	profilePictureUri: string;

	/**
	 * Optional bio information for the user.
	 * @type {Bio | undefined}
	 */
	bio?: TextContent;

	/**
	 * Optional array of external links associated with the user.
	 * @type {Link[] | undefined}
	 */
	links?: Link[];

	/**
	 * The number of posts the user has made.
	 * @type {number}
	 */
	noOfPosts: number;

	/**
	 * The number of users the user is following.
	 * @type {number}
	 */
	noOfFollowings: number;

	/**
	 * The number of users follow the user.
	 * @type {number}
	 */
	noOfFollowers: number;

	/**
	 * A flag indicating if the user's account is private.
	 * @type {boolean}
	 */
	isPrivate: boolean;
	broadcastTopic: string;
	privacySettings: PrivacySettings;
	isDeleted?: boolean;
	isDeActivated?: boolean;
	suspendedTill?: Date;
	noOfBlockedAccounts: number;
	noOfFavoriteAccounts: number;
	noOfMutedAccounts: number;
	noOfSavedAudios: number;
	personalInfo: PersonalInfo;
	securityInfo: SecurityInfo;
	notificationInfo: NotificationSettings;
	suggestionSettings: SuggestionSettings;
	meta: {
		noOfFollowRequests: number;
		noOfFollowers: number;
		noOfShares: number;
		noOfSearches: number;
		noOfVisits: number;
	};
};

export type AccountContacts = {
	accountId: ObjectId;
	phoneNumber: number;
	contactList: {
		accountId: ObjectId;
		phoneNumber: number;
	}[];
};

export type AccountActivity = {
	accountId: ObjectId;
	timestamp: Date;
	activity: string;
};

export type AccountFollow = {
	accountId: ObjectId;
	followedBy: ObjectId;
	followedAt: Date;
	isRequested: boolean;
	notify: boolean;
};

export type AccountBlock = {
	accountId: ObjectId;
	blockedBy: ObjectId;
	blockedAt: Date;
};

export type AccountFavourite = {
	accountId: ObjectId;
	addedBy: ObjectId;
	addedAt: Date;
};

export type AccountMute = {
	accountId: ObjectId;
	mutedBy: ObjectId;
	mutedAt: Date;
};

export type MemoryHiddenAccount = {
	accountId: ObjectId;
	hiddenBy: ObjectId;
	hiddenAt: Date;
};

export type CommentBlockedAccount = {
	accountId: ObjectId;
	blockedBy: ObjectId;
	blockedAt: Date;
};

export type AccountVisit = {
	accountId: ObjectId;
	visitedBy: ObjectId;
	visitedAt: Date;
};

export type AccountSessions = {
	accountId: ObjectId;
	timestamp: Date;
	ipAddress: string;
	clientName: string;
	clientType: string;
	location: GeoLocationInfo;
	hashedAuthToken: string;
	hashedRefreshToken: string;
};

export type VisitedPlaces = {
	accountId: ObjectId;
	placeId: ObjectId;
	timestamp: Date;
	latitude: number;
	longitude: number;
};
