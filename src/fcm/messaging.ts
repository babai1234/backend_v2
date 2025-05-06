import * as admin from "firebase-admin";
import * as serviceAccount from "../../swarnendu-dcdcc-firebase-adminsdk-qcm0n-dca555f962.json";

admin.initializeApp({
	credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
});

export const getMessaging = admin.messaging;

export type FCMMessaging = admin.messaging.Message;
export type MulticastMessage = admin.messaging.MulticastMessage;

export enum NotificationChannelId {
	DIRECT_MESSAGE = "DIRECT_MESSAGE",
	POST_LIKE = "POST_LIKE",
	POST_COMMENT = "POST_COMMENT",
	POST_UPLOAD = "POST_UPLOAD",
	MEMORY_UPLOAD = "MEMORY_UPLOAD",
	FOLLOW = "FOLLOW",
}

export enum NotificationAction {
	MESSAGE_REQUEST = "MESSAGE_REQUEST",
	MESSAGE_INBOX = "MESSAGE_INBOX",
	MEMORY = "MEMORY",
	POST = "POST",
}

export enum NotificationPriority {
	MAX = "max",
	HIGH = "high",
	DEFAULT = "default",
	LOW = "low",
	MIN = "min",
}

export enum NotificationVisibility {
	PRIVATE = "private",
	PUBLIC = "public",
	SECRET = "secret",
}

export enum MessagePriority {
	HIGH = "high",
	LOW = "low",
}
