import {
	NotificationChannelId,
	FCMMessaging,
	NotificationAction,
	NotificationPriority,
	NotificationVisibility,
	MessagePriority,
} from "../../fcm/messaging";
import { sendMessageToTopic } from "../../fcm/oneToOneMessage";
import {
	oneToOneChatAttachmentMessageUpload,
	oneToOneChatTextMessageUpload,
	createOneToOneChat,
} from "../../models/chat/oneToOneChat.model";
import {
	AttachmentPayloadParams,
	FileAttachmentInfo,
	MessageReplyInfo,
	TextPayloadParams,
} from "../../types/util.type";
import {
	executeTransactionWithRetry,
	getAccountAttachmentResponse,
	getAccountContacts,
	getAudioAttachmentResponse,
	getChatMessageData,
	getChatMessageResponseData,
	getClipPostResponse,
	getHighlightResponse,
	getMemoryResponse,
	getMomentPostResponse,
	getPhotoPostResponse,
	isAccountBlocked,
	isAccountFollower,
	isOneToOneChatAvailable,
} from "../../utils/dbUtils";
import { MessageResponseParams } from "../../types/response/chat.type";
import { fileAttachmentGenerator } from "../../utils/functions";
import { getAccountById, updateAccountShares } from "../../models/account.model";
import { WithId } from "mongodb";
import { Account } from "../../types/collection/account.type";
import { databaseClient } from "../../models/index.model";
import { updateClipPostShares } from "../../models/post/clip.model";
import { updateMomentPostShares } from "../../models/post/moment.model";
import { updatePhotoPostShares } from "../../models/post/photo.model";
import { updateAudioShares } from "../../models/audio.model";
import { updateMemoryShares } from "../../models/memory/memory.model";
import { AppError } from "../../constants/appError";
import HttpStatusCodes from "../../constants/HttpStatusCodes";

/** Function creates a chat document if it doesn't exists and inserts the text message in the database
 * @name oneToOneChatTextUploadService
 * @param userAccountId - AccountId of the user to whom the message is to sent
 * @param clientAccountInfo - Basic information of the client from where the message is being sent
 * @param content - Content of the message
 * @param repliedInfo: Information of the message that is being replied to
 * @returns Promise<void>
 * */

export const oneToOneChatTextUploadService = async (
	userAccountId: string,
	clientAccountInfo: WithId<Account>,
	content: string,
	repliedInfo?: MessageReplyInfo
): Promise<void> => {
	try {
		// Check whether the user account is available or not
		const userAccountInfo = await getAccountById(userAccountId);
		const clientAccountId = clientAccountInfo._id.toString();
		// Check whether there exists a blocking relation between user and client, i.e either user has blocked client, or the client has blocked the user
		const accountBlockedInfo = await isAccountBlocked(userAccountId, clientAccountId);
		// If userAccountInfo is not NULL and accountBlockInfo is NULL, then continue with further checks
		if (userAccountInfo && !accountBlockedInfo) {
			// Check whether chat exists between user and client
			const chatInfo = await isOneToOneChatAvailable(
				userAccountId,
				clientAccountId
			);
			// If Chat document exists, then continue with further checks. Else check if the client has the privilege to start a chat or send a message request to the user
			if (chatInfo) {
				let isClientChatMember = false;
				let hasClientDeletedChat = false;
				let hasRecipientDeletedChat = false;
				for (let participant of chatInfo.participants) {
					if (
						participant.accountId.toString() === clientAccountId &&
						participant.isMember === true
					) {
						isClientChatMember = true;
						hasClientDeletedChat = participant.isDeleted;
					}
					if (participant.accountId.toString() === userAccountId) {
						hasRecipientDeletedChat = participant.isDeleted;
					}
				}
				// If the client is in the participant list of the chat document and is an active member of the chat, then check whether the message is reply or not, else throw an error
				if (isClientChatMember) {
					// If the repliedInfo parameter exists, check whether the message that is being replied to exists for the client or not, else throw an error
					if (repliedInfo) {
						let replySourceChatMessageData = await getChatMessageData(
							repliedInfo.messageId,
							clientAccountId
						);
						// If the replySourceChatMessageData exists then update the database and then send the message to the recipients and senders topic through fcm
						if (replySourceChatMessageData) {
							// oneToOneChatTextMessageUpload function creates the message object and then inserts it into the database and returns the id of the newly inserted message
							let messageId = await executeTransactionWithRetry(
								databaseClient,
								async (session) => {
									return await oneToOneChatTextMessageUpload(
										content,
										clientAccountId,
										userAccountId,
										new Date(),
										session,
										repliedInfo,
										replySourceChatMessageData
									);
								}
							);
							// getChatMessageResponseData function takes input this messageID and generates the response message which will be sent to the user and client through fcm as data message
							let messageResponseData = await getChatMessageResponseData(
								messageId,
								clientAccountId
							);
							// If the messageResponseData exists and its data.type field is reply then send the message to the user and client through fcm, else throw an error
							if (
								messageResponseData &&
								messageResponseData.data.type === "reply"
							) {
								// If the user has not deleted the chat then fcm will send the complete message payload and only the clientAccountId as data message, else it will send the clients basic information along with the message payload as data message
								if (!hasRecipientDeletedChat) {
									let recipientMessage: FCMMessaging = {
										data: {
											messageData: JSON.stringify({
												...messageResponseData,
											}),
											accountId: clientAccountId,
										},
										notification: {
											title: clientAccountInfo.name,
											body: messageResponseData.data.content,
											imageUrl: clientAccountInfo.profilePictureUri,
										},
										android: {
											priority: MessagePriority.HIGH,
											ttl: 86400,
											notification: {
												eventTimestamp: new Date(
													messageResponseData.sentAt
												),
												channelId:
													NotificationChannelId.DIRECT_MESSAGE,
												priority: NotificationPriority.HIGH,
												visibility:
													NotificationVisibility.PRIVATE,
												clickAction:
													NotificationAction.MESSAGE_INBOX,
											},
										},
										topic: userAccountInfo.broadcastTopic,
									};
									// await sendMessageToTopic(recipientMessage);
								} else {
									let recipientMessage: FCMMessaging = {
										data: {
											messageData: JSON.stringify({
												...messageResponseData,
											}),
											accounInfo: JSON.stringify({
												id: clientAccountId,
												userId: clientAccountInfo.userId,
												profilePictureUri:
													clientAccountInfo.profilePictureUri,
												name: clientAccountInfo.name,
											}),
										},
										notification: {
											title: clientAccountInfo.name,
											body: messageResponseData.data.content,
											imageUrl: clientAccountInfo.profilePictureUri,
										},
										android: {
											priority: MessagePriority.HIGH,
											ttl: 86400,
											notification: {
												eventTimestamp: new Date(
													messageResponseData.sentAt
												),
												channelId:
													NotificationChannelId.DIRECT_MESSAGE,
												priority: NotificationPriority.HIGH,
												visibility:
													NotificationVisibility.PRIVATE,
												clickAction:
													NotificationAction.MESSAGE_INBOX,
											},
										},
										topic: userAccountInfo.broadcastTopic,
									};
									// await sendMessageToTopic(recipientMessage);
								}
								// If the client has not deleted the chat then fcm will send the complete message payload and only the userAccountId as data message, else it will send the users basic information along with the message payload as data message
								if (!hasClientDeletedChat) {
									let clientMessage: FCMMessaging = {
										data: {
											messageData: JSON.stringify({
												...messageResponseData,
											}),

											accountId: userAccountId,
										},
										topic: clientAccountInfo.broadcastTopic,
									};
									// await sendMessageToTopic(clientMessage);
								} else {
									let clientMessage: FCMMessaging = {
										data: {
											messageData: JSON.stringify({
												...messageResponseData,
											}),
											accounInfo: JSON.stringify({
												id: userAccountInfo._id.toString(),
												userId: userAccountInfo.userId,
												profilePictureUri:
													userAccountInfo.profilePictureUri,
												name: userAccountInfo.name,
											}),
										},
										topic: clientAccountInfo.broadcastTopic,
									};
									// await sendMessageToTopic(clientMessage);
								}
							} else {
								throw new AppError(
									"Failed to send message",
									HttpStatusCodes.NOT_FOUND
								);
							}
						} else {
							throw new AppError(
								"Failed to send message",
								HttpStatusCodes.NOT_FOUND
							);
						}
					} else {
						// If the message is not a reply then insert the message in the database, get the response message from the inserted messageId and send the message to the user and client through fcm
						let messageId = await executeTransactionWithRetry(
							databaseClient,
							async (session) => {
								return await oneToOneChatTextMessageUpload(
									content,
									clientAccountId,
									userAccountId,
									new Date(),
									session
								);
							}
						);
						let messageResponseData = await getChatMessageResponseData(
							messageId,
							clientAccountId
						);
						// If the messageResponseData exists and data.type field is text send the message as data message through fcm, else throw an error
						if (
							messageResponseData &&
							messageResponseData.data.type === "text"
						) {
							// If the user has not deleted the chat then fcm will send the complete message payload and only the clientAccountId as data message, else it will send the clients basic information along with the message payload as data message
							if (!hasRecipientDeletedChat) {
								let recipientMessage: FCMMessaging = {
									data: {
										messageData: JSON.stringify({
											...messageResponseData,
										}),
										accountId: clientAccountId,
									},
									notification: {
										title: clientAccountInfo.name,
										body: messageResponseData.data.content,
										imageUrl: clientAccountInfo.profilePictureUri,
									},
									android: {
										priority: MessagePriority.HIGH,
										ttl: 86400,
										notification: {
											eventTimestamp: new Date(),
											channelId:
												NotificationChannelId.DIRECT_MESSAGE,
											priority: NotificationPriority.HIGH,
											visibility: NotificationVisibility.PRIVATE,
											clickAction: NotificationAction.MESSAGE_INBOX,
										},
									},
									topic: userAccountInfo.broadcastTopic,
								};
								// await sendMessageToTopic(recipientMessage);
							} else {
								let recipientMessage: FCMMessaging = {
									data: {
										messageData: JSON.stringify({
											...messageResponseData,
										}),
										accounInfo: JSON.stringify({
											id: clientAccountId,
											userId: clientAccountInfo.userId,
											profilePictureUri:
												clientAccountInfo.profilePictureUri,
											name: clientAccountInfo.name,
										}),
									},
									notification: {
										title: clientAccountInfo.name,
										body: messageResponseData.data.content,
										imageUrl: clientAccountInfo.profilePictureUri,
									},
									android: {
										priority: MessagePriority.HIGH,
										ttl: 86400,
										notification: {
											eventTimestamp: new Date(),
											channelId:
												NotificationChannelId.DIRECT_MESSAGE,
											priority: NotificationPriority.HIGH,
											visibility: NotificationVisibility.PRIVATE,
											clickAction: NotificationAction.MESSAGE_INBOX,
										},
									},
									topic: userAccountInfo.broadcastTopic,
								};
								// await sendMessageToTopic(recipientMessage);
							}
							// If the client has not deleted the chat then fcm will send the complete message payload and only the userAccountId as data message, else it will send the users basic information along with the message payload as data message
							if (!hasClientDeletedChat) {
								let clientMessage: FCMMessaging = {
									data: {
										messageData: JSON.stringify({
											...messageResponseData,
										}),
										accountId: userAccountId,
									},
									topic: clientAccountInfo.broadcastTopic,
								};
								// await sendMessageToTopic(clientMessage);
							} else {
								let clientMessage: FCMMessaging = {
									data: {
										messageData: JSON.stringify({
											...messageResponseData,
										}),
										accounInfo: JSON.stringify({
											id: userAccountInfo._id.toString(),
											userId: userAccountInfo.userId,
											profilePictureUri:
												userAccountInfo.profilePictureUri,
											name: userAccountInfo.name,
										}),
									},
									topic: clientAccountInfo.broadcastTopic,
								};
								// await sendMessageToTopic(clientMessage);
							}
						} else {
							throw new AppError(
								"Failed to send message",
								HttpStatusCodes.NOT_FOUND
							);
						}
					}
				} else {
					throw new AppError(
						"Failed to send message",
						HttpStatusCodes.FORBIDDEN
					);
				}
			} else {
				const [clientFollowingInfo, userFollowingInfo, userContactInfo] =
					await Promise.all([
						isAccountFollower(userAccountId, clientAccountId),
						isAccountFollower(clientAccountId, userAccountId),
						getAccountContacts(userAccountId, clientAccountId),
					]);
				// Check if the client can initiate a chat with the user or not, based on users chat settings
				if (
					(userAccountInfo.isPrivate &&
						clientFollowingInfo &&
						((userAccountInfo.privacySettings.chatSettings.messageRequests
							.following &&
							userFollowingInfo) ||
							(userAccountInfo.privacySettings.chatSettings.messageRequests
								.contacts &&
								userContactInfo) ||
							userAccountInfo.privacySettings.chatSettings.messageRequests
								.others)) ||
					(userAccountInfo.isPrivate === false &&
						((userAccountInfo.privacySettings.chatSettings.messageRequests
							.following &&
							userFollowingInfo) ||
							(userAccountInfo.privacySettings.chatSettings.messageRequests
								.contacts &&
								userContactInfo) ||
							userAccountInfo.privacySettings.chatSettings.messageRequests
								.others))
				) {
					// If the user follows the client then the client can send messages directly to the inbox, else the message will as message request
					if (userFollowingInfo) {
						// Create a new chat document in the database and then send the message to the recipients and senders topic through fcm
						let textPayload: TextPayloadParams = {
							type: "text",
							content: content,
						};
						// Create the chat document in the database between client and user and then insert the message document for the chat in the database
						let messageId = await executeTransactionWithRetry(
							databaseClient,
							async (session) => {
								return await createOneToOneChat(
									clientAccountId,
									userAccountId,
									false,
									textPayload,
									new Date(),
									session
								);
							}
						);
						// Generate the messageResponseData from the inserted message document id
						let messageResponseData = await getChatMessageResponseData(
							messageId,
							clientAccountId
						);
						// If the messageResponseData exists and the data.type field is text, send the message to the client and user through fcm, else throw an error
						if (
							messageResponseData &&
							messageResponseData.data.type === "text"
						) {
							//  Send the message data and basic account information of the client as data message to the user
							let recipientMessage: FCMMessaging = {
								data: {
									messageData: JSON.stringify({
										...messageResponseData,
									}),
									accounInfo: JSON.stringify({
										id: clientAccountId,
										userId: clientAccountInfo.userId,
										profilePictureUri:
											clientAccountInfo.profilePictureUri,
										name: clientAccountInfo.name,
									}),
								},
								notification: {
									title: clientAccountInfo.name,
									body: messageResponseData.data.content,
									imageUrl: clientAccountInfo.profilePictureUri,
								},
								android: {
									priority: MessagePriority.HIGH,
									ttl: 86400,
									notification: {
										eventTimestamp: new Date(
											messageResponseData.sentAt
										),
										channelId: NotificationChannelId.DIRECT_MESSAGE,
										priority: NotificationPriority.HIGH,
										visibility: NotificationVisibility.PRIVATE,
										clickAction: NotificationAction.MESSAGE_INBOX,
									},
								},
								topic: userAccountInfo.broadcastTopic,
							};
							// await sendMessageToTopic(recipientMessage);
							//  Send the message data and basic account information of the user as data message to the client
							let clientMessage: FCMMessaging = {
								data: {
									messageData: JSON.stringify({
										...messageResponseData,
									}),
									accounInfo: JSON.stringify({
										id: userAccountInfo._id.toString(),
										userId: userAccountInfo.userId,
										profilePictureUri:
											userAccountInfo.profilePictureUri,
										name: userAccountInfo.name,
									}),
								},
								topic: clientAccountInfo.broadcastTopic,
							};
							// await sendMessageToTopic(clientMessage);
						} else {
							throw new AppError(
								"Failed to send message",
								HttpStatusCodes.NOT_FOUND
							);
						}
					} else {
						// Create a new chat document in the database send the message to the recipients and senders topic through fcm to the recipient as a message request
						let textPayload: TextPayloadParams = {
							type: "text",
							content: content,
						};
						// Create the chat document in the database between client and user and then insert the message document for the chat in the database
						let messageId = await executeTransactionWithRetry(
							databaseClient,
							async (session) => {
								return await createOneToOneChat(
									clientAccountId,
									userAccountId,
									true,
									textPayload,
									new Date(),
									session
								);
							}
						);
						let messageResponseData = await getChatMessageResponseData(
							messageId,
							clientAccountId
						);
						// If the messageResponseData exists and the data.type field is text, send the message to the client and user through fcm, else throw an error
						if (
							messageResponseData &&
							messageResponseData.data.type === "text"
						) {
							//  Send the message data and basic account information of the client as data message to the user
							let recipientMessage: FCMMessaging = {
								data: {
									messageData: JSON.stringify({
										...messageResponseData,
									}),
									accounInfo: JSON.stringify({
										id: clientAccountId,
										userId: clientAccountInfo.userId,
										profilePictureUri:
											clientAccountInfo.profilePictureUri,
										name: clientAccountInfo.name,
									}),
								},
								notification: {
									title: clientAccountInfo.name,
									body: "Sent you a message request",
									imageUrl: clientAccountInfo.profilePictureUri,
								},
								android: {
									priority: MessagePriority.HIGH,
									ttl: 86400,
									notification: {
										eventTimestamp: new Date(
											messageResponseData.sentAt
										),
										channelId: NotificationChannelId.DIRECT_MESSAGE,
										priority: NotificationPriority.HIGH,
										visibility: NotificationVisibility.PRIVATE,
										clickAction: NotificationAction.MESSAGE_REQUEST,
									},
								},
								topic: userAccountInfo.broadcastTopic,
							};
							// await sendMessageToTopic(recipientMessage);
							//  Send the message data and basic account information of the user as data message to the client
							let clientMessage: FCMMessaging = {
								data: {
									messageData: JSON.stringify({
										...messageResponseData,
									}),
									accounInfo: JSON.stringify({
										id: userAccountInfo._id.toString(),
										userId: userAccountInfo.userId,
										profilePictureUri:
											userAccountInfo.profilePictureUri,
										name: userAccountInfo.name,
									}),
								},
								topic: clientAccountInfo.broadcastTopic,
							};
							// await sendMessageToTopic(clientMessage);
						} else {
							throw new AppError(
								"Failed to send message",
								HttpStatusCodes.NOT_FOUND
							);
						}
					}
				} else {
					throw new AppError(
						"Failed to send message",
						HttpStatusCodes.FORBIDDEN
					);
				}
			}
		}
		// If either userAccountInfo or clientAccountInfo is NULL or if there exists a blocking relation between them then sending message will not be possible between them, throw an Error
		else {
			throw new AppError("Failed to send message", HttpStatusCodes.FORBIDDEN);
		}
	} catch (error) {
		throw error;
	}
};

/** Function creates a chat document if it doesn't exists and inserts the photo-post attachment message in the database
 * @name oneToOneChatPhotoPostAttachmentService
 * @param userAccountId - AccountId of the user to whom the message is to sent
 * @param clientAccountInfo - Basic information of the client from where the message is being sent
 * @param postId - Id of the post which is being sent as an attachment
 * @param caption - Caption of the message
 * @returns Promise<void>
 * */

export const oneToOneChatPhotoPostAttachmentService = async (
	userAccountId: string,
	clientAccountInfo: WithId<Account>,
	postId: string,
	caption?: string
): Promise<void> => {
	try {
		// Check whether the user account is available or not
		const userAccountInfo = await getAccountById(userAccountId);
		const clientAccountId = clientAccountInfo._id.toString();
		// Check whether there exists a blocking relation between user and client, i.e either user has blocked client, or the client has blocked the user
		const accountBlockedInfo = await isAccountBlocked(userAccountId, clientAccountId);
		// Check whether the post exists or not, if not throw an error
		const postInfo = await getPhotoPostResponse(postId, clientAccountId);
		if (postInfo) {
			// Check whether the author of the post is available or not
			const authorInfo = await getAccountById(postInfo.author.id);
			// If the authorInfo is not NULL then contiue with further checks
			if (authorInfo) {
				const authorId = authorInfo._id.toString();
				// Check whether the client has the privilege to send the attachment based on any blocking relationship between the client and aurthor or if the author is a private account and whether the client follows the author or not
				const hasClientSendingPrivilege =
					!(await isAccountBlocked(authorId, clientAccountId)) &&
					((authorInfo.isPrivate &&
						(await isAccountFollower(authorId, clientAccountId))) ||
						!authorInfo.isPrivate)
						? true
						: false;
				// Check whether the user has the privilege to receive the attachment based on any blocking relationship between the author and user or if the author is a private account and whether the user follows the author or not
				const hasRecipientReceivingPrivilege =
					!(await isAccountBlocked(authorId, userAccountId)) &&
					((authorInfo.isPrivate &&
						(await isAccountFollower(authorId, userAccountId))) ||
						!authorInfo.isPrivate)
						? true
						: false;
				// If userAccountInfo is not NULL and client has the privilege to send the attachment and accountBlockInfo is NULL, then continue with further checks
				if (userAccountInfo && hasClientSendingPrivilege && !accountBlockedInfo) {
					// Check whether chat exists between user and client
					const chatInfo = await isOneToOneChatAvailable(
						userAccountId,
						clientAccountId
					);
					// If Chat document exists, then continue with further checks. Else check if the client has the privilege to start a chat or send a message request to the user
					if (chatInfo) {
						let isClientChatMember = false;
						let hasClientDeletedChat = false;
						let hasRecipientDeletedChat = false;
						for (let participant of chatInfo.participants) {
							if (
								participant.accountId.toString() === clientAccountId &&
								participant.isMember === true
							) {
								isClientChatMember = true;
								hasClientDeletedChat = participant.isDeleted;
							}
							if (participant.accountId.toString() === userAccountId) {
								hasRecipientDeletedChat = participant.isDeleted;
							}
						}
						// If the client is in the participant list of the chat document and is an active member of the chat, else throw an error
						if (isClientChatMember) {
							let attachment: AttachmentPayloadParams = {
								type: "photo",
								id: postId,
								caption: caption,
							};
							// Insert the message in the database, get the response message from the inserted messageId and send the message to the user and client through fcm
							const messageId = await executeTransactionWithRetry(
								databaseClient,
								async (session) => {
									const messageId =
										await oneToOneChatAttachmentMessageUpload(
											clientAccountId,
											userAccountId,
											attachment,
											new Date(),
											session
										);
									await updatePhotoPostShares(attachment.id, session);
									return messageId;
								}
							);
							let messageResponseData = await getChatMessageResponseData(
								messageId,
								clientAccountId
							);
							// If the messageResponseData exists and data.type field is attachment send the message as data message through fcm, else throw an error
							if (
								messageResponseData &&
								messageResponseData.data.type === "attachment"
							) {
								// If the user has not deleted the chat then fcm will send the complete message payload and only the clientAccountId as data message, else it will send the clients basic information along with the message payload as data message
								if (!hasRecipientDeletedChat) {
									let recipientMessage: FCMMessaging = {
										data: {
											messageData: JSON.stringify({
												id: messageResponseData.id,
												author: messageResponseData.author,
												sentAt: messageResponseData.sentAt,
												seenBy: messageResponseData.seenBy,
												reactions: messageResponseData.reactions,
												data: {
													type: "attachment",
													attachment:
														hasRecipientReceivingPrivilege
															? messageResponseData.data
																	.attachment
															: null,
													caption:
														messageResponseData.data.caption,
												},
											} as MessageResponseParams),
											accountId: clientAccountId,
										},
										notification: {
											title: clientAccountInfo.name,
											body: `Sent you a photo of ${authorInfo.name}`,
											imageUrl: clientAccountInfo.profilePictureUri,
										},
										android: {
											priority: MessagePriority.HIGH,
											ttl: 86400,
											notification: {
												eventTimestamp: new Date(),
												channelId:
													NotificationChannelId.DIRECT_MESSAGE,
												priority: NotificationPriority.HIGH,
												visibility:
													NotificationVisibility.PRIVATE,
												clickAction:
													NotificationAction.MESSAGE_INBOX,
											},
										},
										topic: userAccountInfo.broadcastTopic,
									};
									// await sendMessageToTopic(recipientMessage);
								} else {
									let recipientMessage: FCMMessaging = {
										data: {
											messageData: JSON.stringify({
												id: messageResponseData.id,
												author: messageResponseData.author,
												sentAt: messageResponseData.sentAt,
												seenBy: messageResponseData.seenBy,
												reactions: messageResponseData.reactions,
												data: {
													type: "attachment",
													attachment:
														hasRecipientReceivingPrivilege
															? messageResponseData.data
																	.attachment
															: null,
													caption:
														messageResponseData.data.caption,
												},
											} as MessageResponseParams),
											accounInfo: JSON.stringify({
												id: clientAccountId,
												userId: clientAccountInfo.userId,
												profilePictureUri:
													clientAccountInfo.profilePictureUri,
												name: clientAccountInfo.name,
											}),
										},
										notification: {
											title: clientAccountInfo.name,
											body: `Sent you a photo of ${authorInfo.name}`,
											imageUrl: clientAccountInfo.profilePictureUri,
										},
										android: {
											priority: MessagePriority.HIGH,
											ttl: 86400,
											notification: {
												eventTimestamp: new Date(),
												channelId:
													NotificationChannelId.DIRECT_MESSAGE,
												priority: NotificationPriority.HIGH,
												visibility:
													NotificationVisibility.PRIVATE,
												clickAction:
													NotificationAction.MESSAGE_INBOX,
											},
										},
										topic: userAccountInfo.broadcastTopic,
									};
									// await sendMessageToTopic(recipientMessage);
								}
								// If the client has not deleted the chat then fcm will send the complete message payload and only the userAccountId as data message, else it will send the users basic information along with the message payload as data message
								if (!hasClientDeletedChat) {
									let clientMessage: FCMMessaging = {
										data: {
											messageData: JSON.stringify({
												...messageResponseData,
											}),
											accountId: userAccountId,
										},
										topic: clientAccountInfo.broadcastTopic,
									};
									// await sendMessageToTopic(clientMessage);
								} else {
									let clientMessage: FCMMessaging = {
										data: {
											messageData: JSON.stringify({
												...messageResponseData,
											}),
											accounInfo: JSON.stringify({
												id: userAccountInfo._id.toString(),
												userId: userAccountInfo.userId,
												profilePictureUri:
													userAccountInfo.profilePictureUri,
												name: userAccountInfo.name,
											}),
										},
										topic: clientAccountInfo.broadcastTopic,
									};
									// await sendMessageToTopic(clientMessage);
								}
							} else {
								throw new AppError(
									"Failed to send message",
									HttpStatusCodes.NOT_FOUND
								);
							}
						} else {
							throw new AppError(
								"Failed to send message",
								HttpStatusCodes.FORBIDDEN
							);
						}
					} else {
						const [clientFollowingInfo, userFollowingInfo, userContactInfo] =
							await Promise.all([
								isAccountFollower(userAccountId, clientAccountId),
								isAccountFollower(clientAccountId, userAccountId),
								getAccountContacts(userAccountId, clientAccountId),
							]);
						// Check if the client can initiate a chat with the user or not, based on users chat settings
						if (
							(userAccountInfo.isPrivate &&
								clientFollowingInfo &&
								((userAccountInfo.privacySettings.chatSettings
									.messageRequests.following &&
									userFollowingInfo) ||
									(userAccountInfo.privacySettings.chatSettings
										.messageRequests.contacts &&
										userContactInfo) ||
									userAccountInfo.privacySettings.chatSettings
										.messageRequests.others)) ||
							(userAccountInfo.isPrivate === false &&
								((userAccountInfo.privacySettings.chatSettings
									.messageRequests.following &&
									userFollowingInfo) ||
									(userAccountInfo.privacySettings.chatSettings
										.messageRequests.contacts &&
										userContactInfo) ||
									userAccountInfo.privacySettings.chatSettings
										.messageRequests.others))
						) {
							// If the user follows the client then the client can send messages directly to the inbox, else the message will as message request
							if (userFollowingInfo) {
								// Create a new chat document in the database and then send the message to the recipients and senders topic through fcm to the recipients inbox
								let attachment: AttachmentPayloadParams = {
									type: "photo",
									id: postId,
									caption: caption,
								};
								// Create the chat document in the database between client and user and then insert the message document for the chat in the database
								let messageId = await executeTransactionWithRetry(
									databaseClient,
									async (session) => {
										return await createOneToOneChat(
											clientAccountId,
											userAccountId,
											false,
											attachment,
											new Date(),
											session
										);
									}
								);
								// Generate the messageResponseData from the inserted message document id
								let messageResponseData =
									await getChatMessageResponseData(
										messageId,
										clientAccountId
									);
								// If the messageResponseData exists and the data.type field is text, send the message to the client and user through fcm, else throw an error
								if (
									messageResponseData &&
									messageResponseData.data.type === "attachment"
								) {
									//  Send the message data and basic account information of the client as data message to the user
									let recipientMessage: FCMMessaging = {
										data: {
											messageData: JSON.stringify({
												id: messageResponseData.id,
												author: messageResponseData.author,
												sentAt: messageResponseData.sentAt,
												seenBy: messageResponseData.seenBy,
												reactions: messageResponseData.reactions,
												data: {
													type: "attachment",
													attachment:
														hasRecipientReceivingPrivilege
															? messageResponseData.data
																	.attachment
															: null,
													caption:
														messageResponseData.data.caption,
												},
											} as MessageResponseParams),
											accounInfo: JSON.stringify({
												id: clientAccountInfo._id.toString(),
												userId: clientAccountInfo.userId,
												profilePictureUri:
													clientAccountInfo.profilePictureUri,
												name: clientAccountInfo.name,
											}),
										},
										notification: {
											title: clientAccountInfo.name,
											body: `Sent you a photo of ${authorInfo.name}`,
											imageUrl: clientAccountInfo.profilePictureUri,
										},
										android: {
											priority: MessagePriority.HIGH,
											ttl: 86400,
											notification: {
												eventTimestamp: new Date(),
												channelId:
													NotificationChannelId.DIRECT_MESSAGE,
												priority: NotificationPriority.HIGH,
												visibility:
													NotificationVisibility.PRIVATE,
												clickAction:
													NotificationAction.MESSAGE_INBOX,
											},
										},
										topic: userAccountInfo.broadcastTopic,
									};
									// await sendMessageToTopic(recipientMessage);
									//  Send the message data and basic account information of the user as data message to the client
									let clientMessage: FCMMessaging = {
										data: {
											messageData: JSON.stringify({
												...messageResponseData,
											}),
											accounInfo: JSON.stringify({
												id: userAccountInfo._id.toString(),
												userId: userAccountInfo.userId,
												profilePictureUri:
													userAccountInfo.profilePictureUri,
												name: userAccountInfo.name,
											}),
										},
										topic: clientAccountInfo.broadcastTopic,
									};
									// await sendMessageToTopic(clientMessage);
								} else {
									throw new AppError(
										"Failed to send message",
										HttpStatusCodes.NOT_FOUND
									);
								}
							} else {
								// Create a new chat document in the database and then send the message to the recipients and senders topic through fcm to the recipient as a message request
								let attachment: AttachmentPayloadParams = {
									type: "photo",
									id: postId,
									caption: caption,
								};
								// Create the chat document in the database between client and user and then insert the message document for the chat in the database
								let messageId = await executeTransactionWithRetry(
									databaseClient,
									async (session) => {
										return await createOneToOneChat(
											clientAccountId,
											userAccountId,
											true,
											attachment,
											new Date(),
											session
										);
									}
								);
								let messageResponseData =
									await getChatMessageResponseData(
										messageId,
										clientAccountId
									);
								// If the messageResponseData exists and the data.type field is attachment, send the message to the client and user through fcm, else throw an error
								if (
									messageResponseData &&
									messageResponseData.data.type === "attachment"
								) {
									//  Send the message data and basic account information of the client as data message to the user
									let recipientMessage: FCMMessaging = {
										data: {
											messageData: JSON.stringify({
												id: messageResponseData.id,
												author: messageResponseData.author,
												sentAt: messageResponseData.sentAt,
												seenBy: messageResponseData.seenBy,
												reactions: messageResponseData.reactions,
												data: {
													type: "attachment",
													attachment:
														hasRecipientReceivingPrivilege
															? messageResponseData.data
																	.attachment
															: null,
													caption:
														messageResponseData.data.caption,
												},
											} as MessageResponseParams),
											accounInfo: JSON.stringify({
												id: clientAccountId,
												userId: clientAccountInfo.userId,
												profilePictureUri:
													clientAccountInfo.profilePictureUri,
												name: clientAccountInfo.name,
											}),
										},
										notification: {
											title: clientAccountInfo.name,
											body: "Sent you a message request",
											imageUrl: clientAccountInfo.profilePictureUri,
										},
										android: {
											priority: MessagePriority.HIGH,
											ttl: 86400,
											notification: {
												eventTimestamp: new Date(),
												channelId:
													NotificationChannelId.DIRECT_MESSAGE,
												priority: NotificationPriority.HIGH,
												visibility:
													NotificationVisibility.PRIVATE,
												clickAction:
													NotificationAction.MESSAGE_REQUEST,
											},
										},
										topic: userAccountInfo.broadcastTopic,
									};
									// await sendMessageToTopic(recipientMessage);
									//  Send the message data and basic account information of the user as data message to the client
									let clientMessage: FCMMessaging = {
										data: {
											messageData: JSON.stringify({
												...messageResponseData,
											}),
											accounInfo: JSON.stringify({
												id: userAccountInfo._id.toString(),
												userId: userAccountInfo.userId,
												profilePictureUri:
													userAccountInfo.profilePictureUri,
												name: userAccountInfo.name,
											}),
										},
										topic: clientAccountInfo.broadcastTopic,
									};
									// await sendMessageToTopic(clientMessage);
								} else {
									throw new AppError(
										"Failed to send message",
										HttpStatusCodes.NOT_FOUND
									);
								}
							}
						} else {
							throw new AppError(
								"Failed to send message",
								HttpStatusCodes.FORBIDDEN
							);
						}
					}
				} else {
					throw new AppError(
						"Failed to send message",
						HttpStatusCodes.FORBIDDEN
					);
				}
			}
			// If either userAccountInfo or clientAccountInfo is NULL or if there exists a blocking relation between them then sending message will not be possible between them, throw an Error
			else {
				throw new AppError("Failed to send message", HttpStatusCodes.NOT_FOUND);
			}
		} else {
			throw new AppError("Failed to send message", HttpStatusCodes.NOT_FOUND);
		}
	} catch (error) {
		throw error;
	}
};

/** Function creates a chat document if it doesn't exists and inserts the moment-post attachment message in the database
 * @name oneToOneChatMomentPostAttachmentService
 * @param userAccountId - AccountId of the user to whom the message is to sent
 * @param clientAccountInfo - Basic information of the client from where the message is being sent
 * @param postId - Id of the post which is being sent as an attachment
 * @param caption - Caption of the message
 * @returns Promise<void>
 * */

export const oneToOneChatMomentPostAttachmentService = async (
	userAccountId: string,
	clientAccountInfo: WithId<Account>,
	postId: string,
	caption?: string
): Promise<void> => {
	try {
		// Check whether the user account is available or not
		const userAccountInfo = await getAccountById(userAccountId);
		const clientAccountId = clientAccountInfo._id.toString();
		// Check whether there exists a blocking relation between user and client, i.e either user has blocked client, or the client has blocked the user
		const accountBlockedInfo = await isAccountBlocked(userAccountId, clientAccountId);
		// Check whether the post exists or not, if not throw an error
		const postInfo = await getMomentPostResponse(postId, clientAccountId);
		if (postInfo) {
			// Check whether the author of the post is available or not
			const authorInfo = await getAccountById(postInfo.author.id);
			// If the authorInfo is not NULL then contiue with further checks
			if (authorInfo) {
				const authorId = authorInfo._id.toString();
				// Check whether the client has the privilege to send the attachment based on any blocking relationship between the client and aurthor or if the author is a private account and whether the client follows the author or not
				const hasClientSendingPrivilege =
					!(await isAccountBlocked(authorId, clientAccountId)) &&
					((authorInfo.isPrivate &&
						(await isAccountFollower(authorId, clientAccountId))) ||
						!authorInfo.isPrivate)
						? true
						: false;
				// Check whether the user has the privilege to receive the attachment based on any blocking relationship between the author and user or if the author is a private account and whether the user follows the author or not
				const hasRecipientReceivingPrivilege =
					!(await isAccountBlocked(authorId, userAccountId)) &&
					((authorInfo.isPrivate &&
						(await isAccountFollower(authorId, userAccountId))) ||
						!authorInfo.isPrivate)
						? true
						: false;
				// If userAccountInfo is not NULL and client has the privilege to send the attachment and accountBlockInfo is NULL, then continue with further checks
				if (userAccountInfo && hasClientSendingPrivilege && !accountBlockedInfo) {
					// Check whether chat exists between user and client
					const chatInfo = await isOneToOneChatAvailable(
						userAccountId,
						clientAccountId
					);
					// If Chat document exists, then continue with further checks. Else check if the client has the privilege to start a chat or send a message request to the user
					if (chatInfo) {
						let isClientChatMember = false;
						let hasClientDeletedChat = false;
						let hasRecipientDeletedChat = false;
						for (let participant of chatInfo.participants) {
							if (
								participant.accountId.toString() === clientAccountId &&
								participant.isMember === true
							) {
								isClientChatMember = true;
								hasClientDeletedChat = participant.isDeleted;
							}
							if (participant.accountId.toString() === userAccountId) {
								hasRecipientDeletedChat = participant.isDeleted;
							}
						}
						// If the client is in the participant list of the chat document and is an active member of the chat, else throw an error
						if (isClientChatMember) {
							let attachment: AttachmentPayloadParams = {
								type: "moment",
								id: postId,
								caption: caption,
							};
							// Insert the message in the database, get the response message from the inserted messageId and send the message to the user and client through fcm
							const messageId = await executeTransactionWithRetry(
								databaseClient,
								async (session) => {
									const messageId =
										await oneToOneChatAttachmentMessageUpload(
											clientAccountId,
											userAccountId,
											attachment,
											new Date(),
											session
										);
									await updateMomentPostShares(attachment.id, session);
									return messageId;
								}
							);
							let messageResponseData = await getChatMessageResponseData(
								messageId,
								clientAccountId
							);
							// If the messageResponseData exists and data.type field is attachment send the message as data message through fcm, else throw an error
							if (
								messageResponseData &&
								messageResponseData.data.type === "attachment"
							) {
								// If the user has not deleted the chat then fcm will send the complete message payload and only the clientAccountId as data message, else it will send the clients basic information along with the message payload as data message
								if (!hasRecipientDeletedChat) {
									let recipientMessage: FCMMessaging = {
										data: {
											messageData: JSON.stringify({
												id: messageResponseData.id,
												author: messageResponseData.author,
												sentAt: messageResponseData.sentAt,
												seenBy: messageResponseData.seenBy,
												reactions: messageResponseData.reactions,
												data: {
													type: "attachment",
													attachment:
														hasRecipientReceivingPrivilege
															? messageResponseData.data
																	.attachment
															: null,
													caption:
														messageResponseData.data.caption,
												},
											} as MessageResponseParams),
											accountId: clientAccountId,
										},
										notification: {
											title: clientAccountInfo.name,
											body: `Sent you a moment of ${authorInfo.name}`,
											imageUrl: clientAccountInfo.profilePictureUri,
										},
										android: {
											priority: MessagePriority.HIGH,
											ttl: 86400,
											notification: {
												eventTimestamp: new Date(),
												channelId:
													NotificationChannelId.DIRECT_MESSAGE,
												priority: NotificationPriority.HIGH,
												visibility:
													NotificationVisibility.PRIVATE,
												clickAction:
													NotificationAction.MESSAGE_INBOX,
											},
										},
										topic: userAccountInfo.broadcastTopic,
									};
									// await sendMessageToTopic(recipientMessage);
								} else {
									let recipientMessage: FCMMessaging = {
										data: {
											messageData: JSON.stringify({
												id: messageResponseData.id,
												author: messageResponseData.author,
												sentAt: messageResponseData.sentAt,
												seenBy: messageResponseData.seenBy,
												reactions: messageResponseData.reactions,
												data: {
													type: "attachment",
													attachment:
														hasRecipientReceivingPrivilege
															? messageResponseData.data
																	.attachment
															: null,
													caption:
														messageResponseData.data.caption,
												},
											} as MessageResponseParams),
											accounInfo: JSON.stringify({
												id: clientAccountId,
												userId: clientAccountInfo.userId,
												profilePictureUri:
													clientAccountInfo.profilePictureUri,
												name: clientAccountInfo.name,
											}),
										},
										notification: {
											title: clientAccountInfo.name,
											body: `Sent you a moment of ${authorInfo.name}`,
											imageUrl: clientAccountInfo.profilePictureUri,
										},
										android: {
											priority: MessagePriority.HIGH,
											ttl: 86400,
											notification: {
												eventTimestamp: new Date(),
												channelId:
													NotificationChannelId.DIRECT_MESSAGE,
												priority: NotificationPriority.HIGH,
												visibility:
													NotificationVisibility.PRIVATE,
												clickAction:
													NotificationAction.MESSAGE_INBOX,
											},
										},
										topic: userAccountInfo.broadcastTopic,
									};
									// await sendMessageToTopic(recipientMessage);
								}
								// If the client has not deleted the chat then fcm will send the complete message payload and only the userAccountId as data message, else it will send the users basic information along with the message payload as data message
								if (!hasClientDeletedChat) {
									let clientMessage: FCMMessaging = {
										data: {
											messageData: JSON.stringify({
												...messageResponseData,
											}),
											accountId: userAccountId,
										},
										topic: clientAccountInfo.broadcastTopic,
									};
									// await sendMessageToTopic(clientMessage);
								} else {
									let clientMessage: FCMMessaging = {
										data: {
											messageData: JSON.stringify({
												...messageResponseData,
											}),
											accounInfo: JSON.stringify({
												id: userAccountInfo._id.toString(),
												userId: userAccountInfo.userId,
												profilePictureUri:
													userAccountInfo.profilePictureUri,
												name: userAccountInfo.name,
											}),
										},
										topic: clientAccountInfo.broadcastTopic,
									};
									// await sendMessageToTopic(clientMessage);
								}
							} else {
								throw new AppError(
									"Failed to send message",
									HttpStatusCodes.NOT_FOUND
								);
							}
						} else {
							throw new AppError(
								"Failed to send message",
								HttpStatusCodes.FORBIDDEN
							);
						}
					} else {
						const [clientFollowingInfo, userFollowingInfo, userContactInfo] =
							await Promise.all([
								isAccountFollower(userAccountId, clientAccountId),
								isAccountFollower(clientAccountId, userAccountId),
								getAccountContacts(userAccountId, clientAccountId),
							]);
						// Check if the client can initiate a chat with the user or not, based on users chat settings
						if (
							(userAccountInfo.isPrivate &&
								clientFollowingInfo &&
								((userAccountInfo.privacySettings.chatSettings
									.messageRequests.following &&
									userFollowingInfo) ||
									(userAccountInfo.privacySettings.chatSettings
										.messageRequests.contacts &&
										userContactInfo) ||
									userAccountInfo.privacySettings.chatSettings
										.messageRequests.others)) ||
							(userAccountInfo.isPrivate === false &&
								((userAccountInfo.privacySettings.chatSettings
									.messageRequests.following &&
									userFollowingInfo) ||
									(userAccountInfo.privacySettings.chatSettings
										.messageRequests.contacts &&
										userContactInfo) ||
									userAccountInfo.privacySettings.chatSettings
										.messageRequests.others))
						) {
							// If the user follows the client then the client can send messages directly to the inbox, else the message will as message request
							if (userFollowingInfo) {
								// Create a new chat document in the database and then send the message to the recipients and senders topic through fcm to the recipients inbox
								let attachment: AttachmentPayloadParams = {
									type: "moment",
									id: postId,
									caption: caption,
								};
								// Create the chat document in the database between client and user and then insert the message document for the chat in the database
								let messageId = await executeTransactionWithRetry(
									databaseClient,
									async (session) => {
										return await createOneToOneChat(
											clientAccountId,
											userAccountId,
											false,
											attachment,
											new Date(),
											session
										);
									}
								);
								// Generate the messageResponseData from the inserted message document id
								let messageResponseData =
									await getChatMessageResponseData(
										messageId,
										clientAccountId
									);
								// If the messageResponseData exists and the data.type field is text, send the message to the client and user through fcm, else throw an error
								if (
									messageResponseData &&
									messageResponseData.data.type === "attachment"
								) {
									//  Send the message data and basic account information of the client as data message to the user
									let recipientMessage: FCMMessaging = {
										data: {
											messageData: JSON.stringify({
												id: messageResponseData.id,
												author: messageResponseData.author,
												sentAt: messageResponseData.sentAt,
												seenBy: messageResponseData.seenBy,
												reactions: messageResponseData.reactions,
												data: {
													type: "attachment",
													attachment:
														hasRecipientReceivingPrivilege
															? messageResponseData.data
																	.attachment
															: null,
													caption:
														messageResponseData.data.caption,
												},
											} as MessageResponseParams),
											accounInfo: JSON.stringify({
												id: clientAccountId,
												userId: clientAccountInfo.userId,
												profilePictureUri:
													clientAccountInfo.profilePictureUri,
												name: clientAccountInfo.name,
											}),
										},
										notification: {
											title: clientAccountInfo.name,
											body: `Sent you a moment of ${authorInfo.name}`,
											imageUrl: clientAccountInfo.profilePictureUri,
										},
										android: {
											priority: MessagePriority.HIGH,
											ttl: 86400,
											notification: {
												eventTimestamp: new Date(),
												channelId:
													NotificationChannelId.DIRECT_MESSAGE,
												priority: NotificationPriority.HIGH,
												visibility:
													NotificationVisibility.PRIVATE,
												clickAction:
													NotificationAction.MESSAGE_INBOX,
											},
										},
										topic: userAccountInfo.broadcastTopic,
									};
									// await sendMessageToTopic(recipientMessage);
									//  Send the message data and basic account information of the user as data message to the client
									let clientMessage: FCMMessaging = {
										data: {
											messageData: JSON.stringify({
												...messageResponseData,
											}),
											accounInfo: JSON.stringify({
												id: userAccountInfo._id.toString(),
												userId: userAccountInfo.userId,
												profilePictureUri:
													userAccountInfo.profilePictureUri,
												name: userAccountInfo.name,
											}),
										},
										topic: clientAccountInfo.broadcastTopic,
									};
									// await sendMessageToTopic(clientMessage);
								} else {
									throw new AppError(
										"Failed to send message",
										HttpStatusCodes.NOT_FOUND
									);
								}
							} else {
								// Create a new chat document in the database and then send the message to the recipients and senders topic through fcm to the recipient as a message request
								let attachment: AttachmentPayloadParams = {
									type: "moment",
									id: postId,
									caption: caption,
								};
								// Create the chat document in the database between client and user and then insert the message document for the chat in the database
								let messageId = await executeTransactionWithRetry(
									databaseClient,
									async (session) => {
										return await createOneToOneChat(
											clientAccountId,
											userAccountId,
											true,
											attachment,
											new Date(),
											session
										);
									}
								);
								let messageResponseData =
									await getChatMessageResponseData(
										messageId,
										clientAccountId
									);
								// If the messageResponseData exists and the data.type field is attachment, send the message to the client and user through fcm, else throw an error
								if (
									messageResponseData &&
									messageResponseData.data.type === "attachment"
								) {
									//  Send the message data and basic account information of the client as data message to the user
									let recipientMessage: FCMMessaging = {
										data: {
											messageData: JSON.stringify({
												id: messageResponseData.id,
												author: messageResponseData.author,
												sentAt: messageResponseData.sentAt,
												seenBy: messageResponseData.seenBy,
												reactions: messageResponseData.reactions,
												data: {
													type: "attachment",
													attachment:
														hasRecipientReceivingPrivilege
															? messageResponseData.data
																	.attachment
															: null,
													caption:
														messageResponseData.data.caption,
												},
											} as MessageResponseParams),
											accounInfo: JSON.stringify({
												id: clientAccountId,
												userId: clientAccountInfo.userId,
												profilePictureUri:
													clientAccountInfo.profilePictureUri,
												name: clientAccountInfo.name,
											}),
										},
										notification: {
											title: clientAccountInfo.name,
											body: "Sent you a message request",
											imageUrl: clientAccountInfo.profilePictureUri,
										},
										android: {
											priority: MessagePriority.HIGH,
											ttl: 86400,
											notification: {
												eventTimestamp: new Date(),
												channelId:
													NotificationChannelId.DIRECT_MESSAGE,
												priority: NotificationPriority.HIGH,
												visibility:
													NotificationVisibility.PRIVATE,
												clickAction:
													NotificationAction.MESSAGE_REQUEST,
											},
										},
										topic: userAccountInfo.broadcastTopic,
									};
									// await sendMessageToTopic(recipientMessage);
									//  Send the message data and basic account information of the user as data message to the client
									let clientMessage: FCMMessaging = {
										data: {
											messageData: JSON.stringify({
												...messageResponseData,
											}),
											accounInfo: JSON.stringify({
												id: userAccountInfo._id.toString(),
												userId: userAccountInfo.userId,
												profilePictureUri:
													userAccountInfo.profilePictureUri,
												name: userAccountInfo.name,
											}),
										},
										topic: clientAccountInfo.broadcastTopic,
									};
									// await sendMessageToTopic(clientMessage);
								} else {
									throw new AppError(
										"Failed to send message",
										HttpStatusCodes.NOT_FOUND
									);
								}
							}
						} else {
							throw new AppError(
								"Failed to send message",
								HttpStatusCodes.FORBIDDEN
							);
						}
					}
				} else {
					throw new AppError(
						"Failed to send message",
						HttpStatusCodes.FORBIDDEN
					);
				}
			}
			// If either userAccountInfo or clientAccountInfo is NULL or if there exists a blocking relation between them then sending message will not be possible between them, throw an Error
			else {
				throw new AppError("Failed to send message", HttpStatusCodes.NOT_FOUND);
			}
		} else {
			throw new AppError("Failed to send message", HttpStatusCodes.NOT_FOUND);
		}
	} catch (error) {
		throw error;
	}
};

/** Function creates a chat document if it doesn't exists and inserts the clip-post attachment message in the database
 * @name oneToOneChatClipPostAttachmentService
 * @param userAccountId - AccountId of the user to whom the message is to sent
 * @param clientAccountInfo - Basic information of the client from where the message is being sent
 * @param postId - Id of the post which is being sent as an attachment
 * @param caption - Caption of the message
 * @returns Promise<void>
 * */

export const oneToOneChatClipPostAttachmentService = async (
	userAccountId: string,
	clientAccountInfo: WithId<Account>,
	postId: string,
	caption?: string
): Promise<void> => {
	try {
		// Check whether the user account is available or not
		const userAccountInfo = await getAccountById(userAccountId);
		const clientAccountId = clientAccountInfo._id.toString();
		// Check whether there exists a blocking relation between user and client, i.e either user has blocked client, or the client has blocked the user
		const accountBlockedInfo = await isAccountBlocked(userAccountId, clientAccountId);
		// Check whether the post exists or not, if not throw an error
		const postInfo = await getClipPostResponse(postId, clientAccountId);
		if (postInfo) {
			// Check whether the author of the post is available or not
			const authorInfo = await getAccountById(postInfo.author.id);
			// If the authorInfo is not NULL then contiue with further checks
			if (authorInfo) {
				const authorId = authorInfo._id.toString();
				// Check whether the client has the privilege to send the attachment based on any blocking relationship between the client and aurthor or if the author is a private account and whether the client follows the author or not
				const hasClientSendingPrivilege =
					!(await isAccountBlocked(authorId, clientAccountId)) &&
					((authorInfo.isPrivate &&
						(await isAccountFollower(authorId, clientAccountId))) ||
						!authorInfo.isPrivate)
						? true
						: false;
				// Check whether the user has the privilege to receive the attachment based on any blocking relationship between the author and user or if the author is a private account and whether the user follows the author or not
				const hasRecipientReceivingPrivilege =
					!(await isAccountBlocked(authorId, userAccountId)) &&
					((authorInfo.isPrivate &&
						(await isAccountFollower(authorId, userAccountId))) ||
						!authorInfo.isPrivate)
						? true
						: false;
				// If userAccountInfo and clientAccountInfo is not NULL and client has the privilege to send the attachment and accountBlockInfo is NULL, then continue with further checks
				if (userAccountInfo && hasClientSendingPrivilege && !accountBlockedInfo) {
					// Check whether chat exists between user and client
					const chatInfo = await isOneToOneChatAvailable(
						userAccountId,
						clientAccountId
					);
					// If Chat document exists, then continue with further checks. Else check if the client has the privilege to start a chat or send a message request to the user
					if (chatInfo) {
						let isClientChatMember = false;
						let hasClientDeletedChat = false;
						let hasRecipientDeletedChat = false;
						for (let participant of chatInfo.participants) {
							if (
								participant.accountId.toString() === clientAccountId &&
								participant.isMember === true
							) {
								isClientChatMember = true;
								hasClientDeletedChat = participant.isDeleted;
							}
							if (participant.accountId.toString() === userAccountId) {
								hasRecipientDeletedChat = participant.isDeleted;
							}
						}
						// If the client is in the participant list of the chat document and is an active member of the chat, else throw an error
						if (isClientChatMember) {
							let attachment: AttachmentPayloadParams = {
								type: "clip",
								id: postId,
								caption: caption,
							};
							// Insert the message in the database, get the response message from the inserted messageId and send the message to the user and client through fcm
							const messageId = await executeTransactionWithRetry(
								databaseClient,
								async (session) => {
									const messageId =
										await oneToOneChatAttachmentMessageUpload(
											clientAccountId,
											userAccountId,
											attachment,
											new Date(),
											session
										);
									await updateClipPostShares(attachment.id, session);
									return messageId;
								}
							);
							let messageResponseData = await getChatMessageResponseData(
								messageId,
								clientAccountId
							);
							// If the messageResponseData exists and data.type field is attachment send the message as data message through fcm, else throw an error
							if (
								messageResponseData &&
								messageResponseData.data.type === "attachment"
							) {
								// If the user has not deleted the chat then fcm will send the complete message payload and only the clientAccountId as data message, else it will send the clients basic information along with the message payload as data message
								if (!hasRecipientDeletedChat) {
									let recipientMessage: FCMMessaging = {
										data: {
											messageData: JSON.stringify({
												id: messageResponseData.id,
												author: messageResponseData.author,
												sentAt: messageResponseData.sentAt,
												seenBy: messageResponseData.seenBy,
												reactions: messageResponseData.reactions,
												data: {
													type: "attachment",
													attachment:
														hasRecipientReceivingPrivilege
															? messageResponseData.data
																	.attachment
															: null,
													caption:
														messageResponseData.data.caption,
												},
											} as MessageResponseParams),
											accountId: clientAccountId,
										},
										notification: {
											title: clientAccountInfo.name,
											body: `Sent you a clip of ${authorInfo.name}`,
											imageUrl: clientAccountInfo.profilePictureUri,
										},
										android: {
											priority: MessagePriority.HIGH,
											ttl: 86400,
											notification: {
												eventTimestamp: new Date(),
												channelId:
													NotificationChannelId.DIRECT_MESSAGE,
												priority: NotificationPriority.HIGH,
												visibility:
													NotificationVisibility.PRIVATE,
												clickAction:
													NotificationAction.MESSAGE_INBOX,
											},
										},
										topic: userAccountInfo.broadcastTopic,
									};
									// await sendMessageToTopic(recipientMessage);
								} else {
									let recipientMessage: FCMMessaging = {
										data: {
											messageData: JSON.stringify({
												id: messageResponseData.id,
												author: messageResponseData.author,
												sentAt: messageResponseData.sentAt,
												seenBy: messageResponseData.seenBy,
												reactions: messageResponseData.reactions,
												data: {
													type: "attachment",
													attachment:
														hasRecipientReceivingPrivilege
															? messageResponseData.data
																	.attachment
															: null,
													caption:
														messageResponseData.data.caption,
												},
											} as MessageResponseParams),
											accounInfo: JSON.stringify({
												id: clientAccountId,
												userId: clientAccountInfo.userId,
												profilePictureUri:
													clientAccountInfo.profilePictureUri,
												name: clientAccountInfo.name,
											}),
										},
										notification: {
											title: clientAccountInfo.name,
											body: `Sent you a clip of ${authorInfo.name}`,
											imageUrl: clientAccountInfo.profilePictureUri,
										},
										android: {
											priority: MessagePriority.HIGH,
											ttl: 86400,
											notification: {
												eventTimestamp: new Date(),
												channelId:
													NotificationChannelId.DIRECT_MESSAGE,
												priority: NotificationPriority.HIGH,
												visibility:
													NotificationVisibility.PRIVATE,
												clickAction:
													NotificationAction.MESSAGE_INBOX,
											},
										},
										topic: userAccountInfo.broadcastTopic,
									};
									// await sendMessageToTopic(recipientMessage);
								}
								// If the client has not deleted the chat then fcm will send the complete message payload and only the userAccountId as data message, else it will send the users basic information along with the message payload as data message
								if (!hasClientDeletedChat) {
									let clientMessage: FCMMessaging = {
										data: {
											messageData: JSON.stringify({
												...messageResponseData,
											}),
											accountId: userAccountId,
										},
										topic: clientAccountInfo.broadcastTopic,
									};
									await sendMessageToTopic(clientMessage);
								} else {
									let clientMessage: FCMMessaging = {
										data: {
											messageData: JSON.stringify({
												...messageResponseData,
											}),
											accounInfo: JSON.stringify({
												id: userAccountInfo._id.toString(),
												userId: userAccountInfo.userId,
												profilePictureUri:
													userAccountInfo.profilePictureUri,
												name: userAccountInfo.name,
											}),
										},
										topic: clientAccountInfo.broadcastTopic,
									};
									// await sendMessageToTopic(clientMessage);
								}
							} else {
								throw new AppError(
									"Failed to send message",
									HttpStatusCodes.NOT_FOUND
								);
							}
						} else {
							throw new AppError(
								"Failed to send message",
								HttpStatusCodes.FORBIDDEN
							);
						}
					} else {
						const [clientFollowingInfo, userFollowingInfo, userContactInfo] =
							await Promise.all([
								isAccountFollower(userAccountId, clientAccountId),
								isAccountFollower(clientAccountId, userAccountId),
								getAccountContacts(userAccountId, clientAccountId),
							]);
						// Check if the client can initiate a chat with the user or not, based on users chat settings
						if (
							(userAccountInfo.isPrivate &&
								clientFollowingInfo &&
								((userAccountInfo.privacySettings.chatSettings
									.messageRequests.following &&
									userFollowingInfo) ||
									(userAccountInfo.privacySettings.chatSettings
										.messageRequests.contacts &&
										userContactInfo) ||
									userAccountInfo.privacySettings.chatSettings
										.messageRequests.others)) ||
							(userAccountInfo.isPrivate === false &&
								((userAccountInfo.privacySettings.chatSettings
									.messageRequests.following &&
									userFollowingInfo) ||
									(userAccountInfo.privacySettings.chatSettings
										.messageRequests.contacts &&
										userContactInfo) ||
									userAccountInfo.privacySettings.chatSettings
										.messageRequests.others))
						) {
							// If the user follows the client then the client can send messages directly to the inbox, else the message will as message request
							if (userFollowingInfo) {
								// Create a new chat document in the database and then send the message to the recipients and senders topic through fcm to the recipients inbox
								let attachment: AttachmentPayloadParams = {
									type: "clip",
									id: postId,
									caption: caption,
								};
								// Create the chat document in the database between client and user and then insert the message document for the chat in the database
								let messageId = await executeTransactionWithRetry(
									databaseClient,
									async (session) => {
										return await createOneToOneChat(
											clientAccountId,
											userAccountId,
											false,
											attachment,
											new Date(),
											session
										);
									}
								);
								// Generate the messageResponseData from the inserted message document id
								let messageResponseData =
									await getChatMessageResponseData(
										messageId,
										clientAccountId
									);
								// If the messageResponseData exists and the data.type field is text, send the message to the client and user through fcm, else throw an error
								if (
									messageResponseData &&
									messageResponseData.data.type === "attachment"
								) {
									//  Send the message data and basic account information of the client as data message to the user
									let recipientMessage: FCMMessaging = {
										data: {
											messageData: JSON.stringify({
												id: messageResponseData.id,
												author: messageResponseData.author,
												sentAt: messageResponseData.sentAt,
												seenBy: messageResponseData.seenBy,
												reactions: messageResponseData.reactions,
												data: {
													type: "attachment",
													attachment:
														hasRecipientReceivingPrivilege
															? messageResponseData.data
																	.attachment
															: null,
													caption:
														messageResponseData.data.caption,
												},
											} as MessageResponseParams),
											accounInfo: JSON.stringify({
												id: clientAccountId,
												userId: clientAccountInfo.userId,
												profilePictureUri:
													clientAccountInfo.profilePictureUri,
												name: clientAccountInfo.name,
											}),
										},
										notification: {
											title: clientAccountInfo.name,
											body: `Sent you a clip of ${authorInfo.name}`,
											imageUrl: clientAccountInfo.profilePictureUri,
										},
										android: {
											priority: MessagePriority.HIGH,
											ttl: 86400,
											notification: {
												eventTimestamp: new Date(),
												channelId:
													NotificationChannelId.DIRECT_MESSAGE,
												priority: NotificationPriority.HIGH,
												visibility:
													NotificationVisibility.PRIVATE,
												clickAction:
													NotificationAction.MESSAGE_INBOX,
											},
										},
										topic: userAccountInfo.broadcastTopic,
									};
									// await sendMessageToTopic(recipientMessage);
									//  Send the message data and basic account information of the user as data message to the client
									let clientMessage: FCMMessaging = {
										data: {
											messageData: JSON.stringify({
												...messageResponseData,
											}),
											accounInfo: JSON.stringify({
												id: userAccountInfo._id.toString(),
												userId: userAccountInfo.userId,
												profilePictureUri:
													userAccountInfo.profilePictureUri,
												name: userAccountInfo.name,
											}),
										},
										topic: clientAccountInfo.broadcastTopic,
									};
									// await sendMessageToTopic(clientMessage);
								} else {
									throw new AppError(
										"Failed to send message",
										HttpStatusCodes.NOT_FOUND
									);
								}
							} else {
								// Create a new chat document in the database and then send the message to the recipients and senders topic through fcm to the recipient as a message request
								let attachment: AttachmentPayloadParams = {
									type: "clip",
									id: postId,
									caption: caption,
								};
								// Create the chat document in the database between client and user and then insert the message document for the chat in the database
								let messageId = await executeTransactionWithRetry(
									databaseClient,
									async (session) => {
										return await createOneToOneChat(
											clientAccountId,
											userAccountId,
											true,
											attachment,
											new Date(),
											session
										);
									}
								);
								let messageResponseData =
									await getChatMessageResponseData(
										messageId,
										clientAccountId
									);
								// If the messageResponseData exists and the data.type field is attachment, send the message to the client and user through fcm, else throw an error
								if (
									messageResponseData &&
									messageResponseData.data.type === "attachment"
								) {
									//  Send the message data and basic account information of the client as data message to the user
									let recipientMessage: FCMMessaging = {
										data: {
											messageData: JSON.stringify({
												id: messageResponseData.id,
												author: messageResponseData.author,
												sentAt: messageResponseData.sentAt,
												seenBy: messageResponseData.seenBy,
												reactions: messageResponseData.reactions,
												data: {
													type: "attachment",
													attachment:
														hasRecipientReceivingPrivilege
															? messageResponseData.data
																	.attachment
															: null,
													caption:
														messageResponseData.data.caption,
												},
											} as MessageResponseParams),
											accounInfo: JSON.stringify({
												id: clientAccountId,
												userId: clientAccountInfo.userId,
												profilePictureUri:
													clientAccountInfo.profilePictureUri,
												name: clientAccountInfo.name,
											}),
										},
										notification: {
											title: clientAccountInfo.name,
											body: "Sent you a message request",
											imageUrl: clientAccountInfo.profilePictureUri,
										},
										android: {
											priority: MessagePriority.HIGH,
											ttl: 86400,
											notification: {
												eventTimestamp: new Date(),
												channelId:
													NotificationChannelId.DIRECT_MESSAGE,
												priority: NotificationPriority.HIGH,
												visibility:
													NotificationVisibility.PRIVATE,
												clickAction:
													NotificationAction.MESSAGE_REQUEST,
											},
										},
										topic: userAccountInfo.broadcastTopic,
									};
									// await sendMessageToTopic(recipientMessage);
									//  Send the message data and basic account information of the user as data message to the client
									let clientMessage: FCMMessaging = {
										data: {
											messageData: JSON.stringify({
												...messageResponseData,
											}),
											accounInfo: JSON.stringify({
												id: userAccountInfo._id.toString(),
												userId: userAccountInfo.userId,
												profilePictureUri:
													userAccountInfo.profilePictureUri,
												name: userAccountInfo.name,
											}),
										},
										topic: clientAccountInfo.broadcastTopic,
									};
									await sendMessageToTopic(clientMessage);
								} else {
									throw new AppError(
										"Failed to send message",
										HttpStatusCodes.NOT_FOUND
									);
								}
							}
						} else {
							throw new AppError(
								"Failed to send message",
								HttpStatusCodes.FORBIDDEN
							);
						}
					}
				} else {
					throw new AppError(
						"Failed to send message",
						HttpStatusCodes.FORBIDDEN
					);
				}
			}
			// If either userAccountInfo or clientAccountInfo is NULL or if there exists a blocking relation between them then sending message will not be possible between them, throw an Error
			else {
				throw new AppError("Failed to send message", HttpStatusCodes.NOT_FOUND);
			}
		} else {
			throw new AppError("Failed to send message", HttpStatusCodes.NOT_FOUND);
		}
	} catch (error) {
		throw error;
	}
};

/** Function creates a chat document if it doesn't exists and inserts the account attachment message in the database
 * @name oneToOneChatAccountAttachmentService
 * @param userAccountId - AccountId of the user to whom the message is to sent
 * @param clientAccountInfo - Basic information of the client from where the message is being sent
 * @param accountId - Id of the account which is being sent as an attachment
 * @param caption - Caption of the message
 * @returns Promise<void>
 * */

export const oneToOneChatAccountAttachmentService = async (
	userAccountId: string,
	clientAccountInfo: WithId<Account>,
	accountId: string,
	caption?: string
): Promise<void> => {
	try {
		// Check whether the user account is available or not
		const userAccountInfo = await getAccountById(userAccountId);
		const clientAccountId = clientAccountInfo._id.toString();
		// Check whether there exists a blocking relation between user and client, i.e either user has blocked client, or the client has blocked the user
		const accountBlockedInfo = await isAccountBlocked(userAccountId, clientAccountId);
		// Check whether the post exists or not, if not throw an error
		const accountInfo = await getAccountAttachmentResponse(
			accountId,
			clientAccountId
		);
		if (accountInfo) {
			// Check whether the client has the privilege to send the attachment based on any blocking relationship between the client and account
			const hasClientSendingPrivilege = !(await isAccountBlocked(
				accountId,
				clientAccountId
			));
			// Check whether the user has the privilege to receive the attachment based on any blocking relationship between the author and user or if the author is a private account and whether the user follows the author or not
			const hasRecipientReceivingPrivilege = !(await isAccountBlocked(
				accountId,
				userAccountId
			));
			// If userAccountInfo is not NULL and client has the privilege to send the attachment and accountBlockInfo is NULL, then continue with further checks
			if (userAccountInfo && hasClientSendingPrivilege && !accountBlockedInfo) {
				// Check whether chat exists between user and client
				const chatInfo = await isOneToOneChatAvailable(
					userAccountId,
					clientAccountId
				);
				// If Chat document exists, then continue with further checks. Else check if the client has the privilege to start a chat or send a message request to the user
				if (chatInfo) {
					let isClientChatMember = false;
					let hasClientDeletedChat = false;
					let hasRecipientDeletedChat = false;
					for (let participant of chatInfo.participants) {
						if (
							participant.accountId.toString() === clientAccountId &&
							participant.isMember === true
						) {
							isClientChatMember = true;
							hasClientDeletedChat = participant.isDeleted;
						}
						if (participant.accountId.toString() === userAccountId) {
							hasRecipientDeletedChat = participant.isDeleted;
						}
					}
					// If the client is in the participant list of the chat document and is an active member of the chat, else throw an error
					if (isClientChatMember) {
						let attachment: AttachmentPayloadParams = {
							type: "account",
							id: accountId,
							caption: caption,
						};
						// Insert the message in the database, get the response message from the inserted messageId and send the message to the user and client through fcm
						const messageId = await executeTransactionWithRetry(
							databaseClient,
							async (session) => {
								const messageId =
									await oneToOneChatAttachmentMessageUpload(
										clientAccountId,
										userAccountId,
										attachment,
										new Date(),
										session
									);
								await updateAccountShares(accountId, session);
								return messageId;
							}
						);
						let messageResponseData = await getChatMessageResponseData(
							messageId,
							clientAccountId
						);
						// If the messageResponseData exists and data.type field is attachment send the message as data message through fcm, else throw an error
						if (
							messageResponseData &&
							messageResponseData.data.type === "attachment"
						) {
							// If the user has not deleted the chat then fcm will send the complete message payload and only the clientAccountId as data message, else it will send the clients basic information along with the message payload as data message
							if (!hasRecipientDeletedChat) {
								let recipientMessage: FCMMessaging = {
									data: {
										messageData: JSON.stringify({
											id: messageResponseData.id,
											author: messageResponseData.author,
											sentAt: messageResponseData.sentAt,
											seenBy: messageResponseData.seenBy,
											reactions: messageResponseData.reactions,
											data: {
												type: "attachment",
												attachment: hasRecipientReceivingPrivilege
													? messageResponseData.data.attachment
													: null,
												caption: messageResponseData.data.caption,
											},
										} as MessageResponseParams),
										accountId: clientAccountId,
									},
									notification: {
										title: clientAccountInfo.name,
										body: `Sent you an attachment`,
										imageUrl: clientAccountInfo.profilePictureUri,
									},
									android: {
										priority: MessagePriority.HIGH,
										ttl: 86400,
										notification: {
											eventTimestamp: new Date(),
											channelId:
												NotificationChannelId.DIRECT_MESSAGE,
											priority: NotificationPriority.HIGH,
											visibility: NotificationVisibility.PRIVATE,
											clickAction: NotificationAction.MESSAGE_INBOX,
										},
									},
									topic: userAccountInfo.broadcastTopic,
								};
								// await sendMessageToTopic(recipientMessage);
							} else {
								let recipientMessage: FCMMessaging = {
									data: {
										messageData: JSON.stringify({
											id: messageResponseData.id,
											author: messageResponseData.author,
											sentAt: messageResponseData.sentAt,
											seenBy: messageResponseData.seenBy,
											reactions: messageResponseData.reactions,
											data: {
												type: "attachment",
												attachment: hasRecipientReceivingPrivilege
													? messageResponseData.data.attachment
													: null,
												caption: messageResponseData.data.caption,
											},
										} as MessageResponseParams),
										accounInfo: JSON.stringify({
											id: clientAccountId,
											userId: clientAccountInfo.userId,
											profilePictureUri:
												clientAccountInfo.profilePictureUri,
											name: clientAccountInfo.name,
										}),
									},
									notification: {
										title: clientAccountInfo.name,
										body: `Sent you an attachment`,
										imageUrl: clientAccountInfo.profilePictureUri,
									},
									android: {
										priority: MessagePriority.HIGH,
										ttl: 86400,
										notification: {
											eventTimestamp: new Date(),
											channelId:
												NotificationChannelId.DIRECT_MESSAGE,
											priority: NotificationPriority.HIGH,
											visibility: NotificationVisibility.PRIVATE,
											clickAction: NotificationAction.MESSAGE_INBOX,
										},
									},
									topic: userAccountInfo.broadcastTopic,
								};
								// await sendMessageToTopic(recipientMessage);
							}
							// If the client has not deleted the chat then fcm will send the complete message payload and only the userAccountId as data message, else it will send the users basic information along with the message payload as data message
							if (!hasClientDeletedChat) {
								let clientMessage: FCMMessaging = {
									data: {
										messageData: JSON.stringify({
											...messageResponseData,
										}),
										accountId: userAccountId,
									},
									topic: clientAccountInfo.broadcastTopic,
								};
								// await sendMessageToTopic(clientMessage);
							} else {
								let clientMessage: FCMMessaging = {
									data: {
										messageData: JSON.stringify({
											...messageResponseData,
										}),
										accounInfo: JSON.stringify({
											id: userAccountInfo._id.toString(),
											userId: userAccountInfo.userId,
											profilePictureUri:
												userAccountInfo.profilePictureUri,
											name: userAccountInfo.name,
										}),
									},
									topic: clientAccountInfo.broadcastTopic,
								};
								// await sendMessageToTopic(clientMessage);
							}
						} else {
							throw new AppError(
								"Failed to send message",
								HttpStatusCodes.NOT_FOUND
							);
						}
					} else {
						throw new AppError(
							"Failed to send message",
							HttpStatusCodes.FORBIDDEN
						);
					}
				} else {
					const [clientFollowingInfo, userFollowingInfo, userContactInfo] =
						await Promise.all([
							isAccountFollower(userAccountId, clientAccountId),
							isAccountFollower(clientAccountId, userAccountId),
							getAccountContacts(userAccountId, clientAccountId),
						]);
					// Check if the client can initiate a chat with the user or not, based on users chat settings
					if (
						(userAccountInfo.isPrivate &&
							clientFollowingInfo &&
							((userAccountInfo.privacySettings.chatSettings.messageRequests
								.following &&
								userFollowingInfo) ||
								(userAccountInfo.privacySettings.chatSettings
									.messageRequests.contacts &&
									userContactInfo) ||
								userAccountInfo.privacySettings.chatSettings
									.messageRequests.others)) ||
						(userAccountInfo.isPrivate === false &&
							((userAccountInfo.privacySettings.chatSettings.messageRequests
								.following &&
								userFollowingInfo) ||
								(userAccountInfo.privacySettings.chatSettings
									.messageRequests.contacts &&
									userContactInfo) ||
								userAccountInfo.privacySettings.chatSettings
									.messageRequests.others))
					) {
						// If the user follows the client then the client can send messages directly to the inbox, else the message will as message request
						if (userFollowingInfo) {
							// Create a new chat document in the database and then send the message to the recipients and senders topic through fcm to the recipients inbox
							let attachment: AttachmentPayloadParams = {
								type: "account",
								id: accountId,
								caption: caption,
							};
							// Create the chat document in the database between client and user and then insert the message document for the chat in the database
							const messageId = await executeTransactionWithRetry(
								databaseClient,
								async (session) => {
									const messageId = await createOneToOneChat(
										clientAccountId,
										userAccountId,
										false,
										attachment,
										new Date(),
										session
									);
									await updateAccountShares(accountId, session);
									return messageId;
								}
							);
							// Generate the messageResponseData from the inserted message document id
							let messageResponseData = await getChatMessageResponseData(
								messageId,
								clientAccountId
							);
							// If the messageResponseData exists and the data.type field is text, send the message to the client and user through fcm, else throw an error
							if (
								messageResponseData &&
								messageResponseData.data.type === "attachment"
							) {
								//  Send the message data and basic account information of the client as data message to the user
								let recipientMessage: FCMMessaging = {
									data: {
										messageData: JSON.stringify({
											id: messageResponseData.id,
											author: messageResponseData.author,
											sentAt: messageResponseData.sentAt,
											seenBy: messageResponseData.seenBy,
											reactions: messageResponseData.reactions,
											data: {
												type: "attachment",
												attachment: hasRecipientReceivingPrivilege
													? messageResponseData.data.attachment
													: null,
												caption: messageResponseData.data.caption,
											},
										} as MessageResponseParams),
										accounInfo: JSON.stringify({
											id: clientAccountId,
											userId: clientAccountInfo.userId,
											profilePictureUri:
												clientAccountInfo.profilePictureUri,
											name: clientAccountInfo.name,
										}),
									},
									notification: {
										title: clientAccountInfo.name,
										body: `Sent you an attachment`,
										imageUrl: clientAccountInfo.profilePictureUri,
									},
									android: {
										priority: MessagePriority.HIGH,
										ttl: 86400,
										notification: {
											eventTimestamp: new Date(),
											channelId:
												NotificationChannelId.DIRECT_MESSAGE,
											priority: NotificationPriority.HIGH,
											visibility: NotificationVisibility.PRIVATE,
											clickAction: NotificationAction.MESSAGE_INBOX,
										},
									},
									topic: userAccountInfo.broadcastTopic,
								};
								// await sendMessageToTopic(recipientMessage);
								//  Send the message data and basic account information of the user as data message to the client
								let clientMessage: FCMMessaging = {
									data: {
										messageData: JSON.stringify({
											...messageResponseData,
										}),
										accounInfo: JSON.stringify({
											id: userAccountInfo._id.toString(),
											userId: userAccountInfo.userId,
											profilePictureUri:
												userAccountInfo.profilePictureUri,
											name: userAccountInfo.name,
										}),
									},
									topic: clientAccountInfo.broadcastTopic,
								};
								// await sendMessageToTopic(clientMessage);
							} else {
								throw new AppError(
									"Failed to send message",
									HttpStatusCodes.NOT_FOUND
								);
							}
						} else {
							// Create a new chat document in the database and then send the message to the recipients and senders topic through fcm to the recipient as a message request
							let attachment: AttachmentPayloadParams = {
								type: "account",
								id: accountId,
								caption: caption,
							};
							// Create the chat document in the database between client and user and then insert the message document for the chat in the database
							const messageId = await executeTransactionWithRetry(
								databaseClient,
								async (session) => {
									const messageId = await createOneToOneChat(
										clientAccountId,
										userAccountId,
										true,
										attachment,
										new Date(),
										session
									);
									await updateAccountShares(accountId, session);
									return messageId;
								}
							);
							let messageResponseData = await getChatMessageResponseData(
								messageId,
								clientAccountId
							);
							// If the messageResponseData exists and the data.type field is attachment, send the message to the client and user through fcm, else throw an error
							if (
								messageResponseData &&
								messageResponseData.data.type === "attachment"
							) {
								//  Send the message data and basic account information of the client as data message to the user
								let recipientMessage: FCMMessaging = {
									data: {
										messageData: JSON.stringify({
											id: messageResponseData.id,
											author: messageResponseData.author,
											sentAt: messageResponseData.sentAt,
											seenBy: messageResponseData.seenBy,
											reactions: messageResponseData.reactions,
											data: {
												type: "attachment",
												attachment: hasRecipientReceivingPrivilege
													? messageResponseData.data.attachment
													: null,
												caption: messageResponseData.data.caption,
											},
										} as MessageResponseParams),
										accounInfo: JSON.stringify({
											id: clientAccountInfo._id.toString(),
											userId: clientAccountInfo.userId,
											profilePictureUri:
												clientAccountInfo.profilePictureUri,
											name: clientAccountInfo.name,
										}),
									},
									notification: {
										title: clientAccountInfo.name,
										body: "Sent you a message request",
										imageUrl: clientAccountInfo.profilePictureUri,
									},
									android: {
										priority: MessagePriority.HIGH,
										ttl: 86400,
										notification: {
											eventTimestamp: new Date(),
											channelId:
												NotificationChannelId.DIRECT_MESSAGE,
											priority: NotificationPriority.HIGH,
											visibility: NotificationVisibility.PRIVATE,
											clickAction:
												NotificationAction.MESSAGE_REQUEST,
										},
									},
									topic: userAccountInfo.broadcastTopic,
								};
								// await sendMessageToTopic(recipientMessage);
								//  Send the message data and basic account information of the user as data message to the client
								let clientMessage: FCMMessaging = {
									data: {
										messageData: JSON.stringify({
											...messageResponseData,
										}),
										accounInfo: JSON.stringify({
											id: userAccountInfo._id.toString(),
											userId: userAccountInfo.userId,
											profilePictureUri:
												userAccountInfo.profilePictureUri,
											name: userAccountInfo.name,
										}),
									},
									topic: clientAccountInfo.broadcastTopic,
								};
								// await sendMessageToTopic(clientMessage);
							} else {
								throw new AppError(
									"Failed to send message",
									HttpStatusCodes.NOT_FOUND
								);
							}
						}
					} else {
						throw new AppError(
							"Failed to send message",
							HttpStatusCodes.FORBIDDEN
						);
					}
				}
			} else {
				throw new AppError("Failed to send message", HttpStatusCodes.FORBIDDEN);
			}

			// If either userAccountInfo or clientAccountInfo is NULL or if there exists a blocking relation between them then sending message will not be possible between them, throw an Error
		} else {
			throw new AppError("Failed to send message", HttpStatusCodes.NOT_FOUND);
		}
	} catch (error) {
		throw error;
	}
};

/** Function creates a chat document if it doesn't exists and inserts the audio attachment message in the database
 * @name oneToOneChatAudioAttachmentService
 * @param userAccountId - AccountId of the user to whom the message is to sent
 * @param clientAccountInfo - Basic information of the client from where the message is being sent
 * @param audioId - Id of the audio which is being sent as an attachment
 * @param caption - Caption of the message
 * @returns Promise<void>
 * */

export const oneToOneChatAudioAttachmentService = async (
	userAccountId: string,
	clientAccountInfo: WithId<Account>,
	audioId: string,
	caption?: string
): Promise<void> => {
	try {
		// Check whether the user account is available or not
		const userAccountInfo = await getAccountById(userAccountId);
		const clientAccountId = clientAccountInfo._id.toString();
		// Check whether there exists a blocking relation between user and client, i.e either user has blocked client, or the client has blocked the user
		const accountBlockedInfo = await isAccountBlocked(userAccountId, clientAccountId);
		// Check whether the post exists or not, if not throw an error
		const audioInfo = await getAudioAttachmentResponse(audioId, clientAccountId);
		if (audioInfo) {
			// Check whether the client has the privilege to send the attachment based on any blocking relationship between the client and account
			let hasClientSendingPrivilege: boolean;
			if (audioInfo.associatedAccountInfo) {
				hasClientSendingPrivilege =
					audioInfo.associatedAccountInfo.isAvailable &&
					!audioInfo.associatedAccountInfo.isBlocked &&
					((audioInfo.associatedAccountInfo.isPrivate &&
						(await isAccountFollower(
							audioInfo.associatedAccountInfo.id,
							clientAccountId
						))) ||
						!audioInfo.associatedAccountInfo.isPrivate)
						? true
						: false;
			} else {
				hasClientSendingPrivilege = true;
			}
			// Check whether the user has the privilege to receive the attachment based on any blocking relationship between the author and user or if the author is a private account and whether the user follows the author or not
			let hasRecipientReceivingPrivilege: boolean;
			if (audioInfo.associatedAccountInfo) {
				hasRecipientReceivingPrivilege =
					!(await isAccountBlocked(
						audioInfo.associatedAccountInfo.id,
						userAccountId
					)) &&
					((audioInfo.associatedAccountInfo.isPrivate &&
						(await isAccountFollower(
							audioInfo.associatedAccountInfo.id,
							userAccountId
						))) ||
						!audioInfo.associatedAccountInfo.isPrivate)
						? true
						: false;
			} else {
				hasRecipientReceivingPrivilege = true;
			}
			// If userAccountInfo and clientAccountInfo is not NULL and client has the privilege to send the attachment and accountBlockInfo is NULL, then continue with further checks
			if (userAccountInfo && hasClientSendingPrivilege && !accountBlockedInfo) {
				// Check whether chat exists between user and client
				const chatInfo = await isOneToOneChatAvailable(
					userAccountId,
					clientAccountId
				);
				// If Chat document exists, then continue with further checks. Else check if the client has the privilege to start a chat or send a message request to the user
				if (chatInfo) {
					let isClientChatMember = false;
					let hasClientDeletedChat = false;
					let hasRecipientDeletedChat = false;
					for (let participant of chatInfo.participants) {
						if (
							participant.accountId.toString() === clientAccountId &&
							participant.isMember === true
						) {
							isClientChatMember = true;
							hasClientDeletedChat = participant.isDeleted;
						}
						if (participant.accountId.toString() === userAccountId) {
							hasRecipientDeletedChat = participant.isDeleted;
						}
					}
					// If the client is in the participant list of the chat document and is an active member of the chat, else throw an error
					if (isClientChatMember) {
						let attachment: AttachmentPayloadParams = {
							type: "audio",
							id: audioId,
							caption: caption,
						};
						// Insert the message in the database, get the response message from the inserted messageId and send the message to the user and client through fcm
						const messageId = await executeTransactionWithRetry(
							databaseClient,
							async (session) => {
								const messageId =
									await oneToOneChatAttachmentMessageUpload(
										clientAccountId,
										userAccountId,
										attachment,
										new Date(),
										session
									);
								await updateAudioShares(audioId, session);
								return messageId;
							}
						);
						let messageResponseData = await getChatMessageResponseData(
							messageId,
							clientAccountId
						);
						// If the messageResponseData exists and data.type field is attachment send the message as data message through fcm, else throw an error
						if (
							messageResponseData &&
							messageResponseData.data.type === "attachment"
						) {
							// If the user has not deleted the chat then fcm will send the complete message payload and only the clientAccountId as data message, else it will send the clients basic information along with the message payload as data message
							if (!hasRecipientDeletedChat) {
								let recipientMessage: FCMMessaging = {
									data: {
										messageData: JSON.stringify({
											id: messageResponseData.id,
											author: messageResponseData.author,
											sentAt: messageResponseData.sentAt,
											seenBy: messageResponseData.seenBy,
											reactions: messageResponseData.reactions,
											data: {
												type: "attachment",
												attachment: hasRecipientReceivingPrivilege
													? messageResponseData.data.attachment
													: null,
												caption: messageResponseData.data.caption,
											},
										} as MessageResponseParams),
										accountId: clientAccountId,
									},
									notification: {
										title: clientAccountInfo.name,
										body: `Sent you an attachment`,
										imageUrl: clientAccountInfo.profilePictureUri,
									},
									android: {
										priority: MessagePriority.HIGH,
										ttl: 86400,
										notification: {
											eventTimestamp: new Date(),
											channelId:
												NotificationChannelId.DIRECT_MESSAGE,
											priority: NotificationPriority.HIGH,
											visibility: NotificationVisibility.PRIVATE,
											clickAction: NotificationAction.MESSAGE_INBOX,
										},
									},
									topic: userAccountInfo.broadcastTopic,
								};
								// await sendMessageToTopic(recipientMessage);
							} else {
								let recipientMessage: FCMMessaging = {
									data: {
										messageData: JSON.stringify({
											id: messageResponseData.id,
											author: messageResponseData.author,
											sentAt: messageResponseData.sentAt,
											seenBy: messageResponseData.seenBy,
											reactions: messageResponseData.reactions,
											data: {
												type: "attachment",
												attachment: hasRecipientReceivingPrivilege
													? messageResponseData.data.attachment
													: null,
												caption: messageResponseData.data.caption,
											},
										} as MessageResponseParams),
										accounInfo: JSON.stringify({
											id: clientAccountId,
											userId: clientAccountInfo.userId,
											profilePictureUri:
												clientAccountInfo.profilePictureUri,
											name: clientAccountInfo.name,
										}),
									},
									notification: {
										title: clientAccountInfo.name,
										body: `Sent you an attachment`,
										imageUrl: clientAccountInfo.profilePictureUri,
									},
									android: {
										priority: MessagePriority.HIGH,
										ttl: 86400,
										notification: {
											eventTimestamp: new Date(),
											channelId:
												NotificationChannelId.DIRECT_MESSAGE,
											priority: NotificationPriority.HIGH,
											visibility: NotificationVisibility.PRIVATE,
											clickAction: NotificationAction.MESSAGE_INBOX,
										},
									},
									topic: userAccountInfo.broadcastTopic,
								};
								// await sendMessageToTopic(recipientMessage);
							}
							// If the client has not deleted the chat then fcm will send the complete message payload and only the userAccountId as data message, else it will send the users basic information along with the message payload as data message
							if (!hasClientDeletedChat) {
								let clientMessage: FCMMessaging = {
									data: {
										messageData: JSON.stringify({
											...messageResponseData,
										}),
										accountId: userAccountId,
									},
									topic: clientAccountInfo.broadcastTopic,
								};
								// await sendMessageToTopic(clientMessage);
							} else {
								let clientMessage: FCMMessaging = {
									data: {
										messageData: JSON.stringify({
											...messageResponseData,
										}),
										accounInfo: JSON.stringify({
											id: userAccountInfo._id.toString(),
											userId: userAccountInfo.userId,
											profilePictureUri:
												userAccountInfo.profilePictureUri,
											name: userAccountInfo.name,
										}),
									},
									topic: clientAccountInfo.broadcastTopic,
								};
								// await sendMessageToTopic(clientMessage);
							}
						} else {
							throw new AppError(
								"Failed to send message",
								HttpStatusCodes.NOT_FOUND
							);
						}
					} else {
						throw new AppError(
							"Failed to send message",
							HttpStatusCodes.FORBIDDEN
						);
					}
				} else {
					const [clientFollowingInfo, userFollowingInfo, userContactInfo] =
						await Promise.all([
							isAccountFollower(userAccountId, clientAccountId),
							isAccountFollower(clientAccountId, userAccountId),
							getAccountContacts(userAccountId, clientAccountId),
						]);
					// Check if the client can initiate a chat with the user or not, based on users chat settings
					if (
						(userAccountInfo.isPrivate &&
							clientFollowingInfo &&
							((userAccountInfo.privacySettings.chatSettings.messageRequests
								.following &&
								userFollowingInfo) ||
								(userAccountInfo.privacySettings.chatSettings
									.messageRequests.contacts &&
									userContactInfo) ||
								userAccountInfo.privacySettings.chatSettings
									.messageRequests.others)) ||
						(userAccountInfo.isPrivate === false &&
							((userAccountInfo.privacySettings.chatSettings.messageRequests
								.following &&
								userFollowingInfo) ||
								(userAccountInfo.privacySettings.chatSettings
									.messageRequests.contacts &&
									userContactInfo) ||
								userAccountInfo.privacySettings.chatSettings
									.messageRequests.others))
					) {
						// If the user follows the client then the client can send messages directly to the inbox, else the message will as message request
						if (userFollowingInfo) {
							// Create a new chat document in the database and then send the message to the recipients and senders topic through fcm to the recipients inbox
							let attachment: AttachmentPayloadParams = {
								type: "audio",
								id: audioId,
								caption: caption,
							};
							// Create the chat document in the database between client and user and then insert the message document for the chat in the database
							let messageId = await executeTransactionWithRetry(
								databaseClient,
								async (session) => {
									const messageId = await createOneToOneChat(
										clientAccountId,
										userAccountId,
										false,
										attachment,
										new Date(),
										session
									);
									await updateAudioShares(attachment.id, session);
									return messageId;
								}
							);
							// Generate the messageResponseData from the inserted message document id
							let messageResponseData = await getChatMessageResponseData(
								messageId,
								clientAccountId
							);
							// If the messageResponseData exists and the data.type field is text, send the message to the client and user through fcm, else throw an error
							if (
								messageResponseData &&
								messageResponseData.data.type === "attachment"
							) {
								//  Send the message data and basic account information of the client as data message to the user
								let recipientMessage: FCMMessaging = {
									data: {
										messageData: JSON.stringify({
											id: messageResponseData.id,
											author: messageResponseData.author,
											sentAt: messageResponseData.sentAt,
											seenBy: messageResponseData.seenBy,
											reactions: messageResponseData.reactions,
											data: {
												type: "attachment",
												attachment: hasRecipientReceivingPrivilege
													? messageResponseData.data.attachment
													: null,
												caption: messageResponseData.data.caption,
											},
										} as MessageResponseParams),
										accounInfo: JSON.stringify({
											id: clientAccountId,
											userId: clientAccountInfo.userId,
											profilePictureUri:
												clientAccountInfo.profilePictureUri,
											name: clientAccountInfo.name,
										}),
									},
									notification: {
										title: clientAccountInfo.name,
										body: `Sent you an attachment`,
										imageUrl: clientAccountInfo.profilePictureUri,
									},
									android: {
										priority: MessagePriority.HIGH,
										ttl: 86400,
										notification: {
											eventTimestamp: new Date(),
											channelId:
												NotificationChannelId.DIRECT_MESSAGE,
											priority: NotificationPriority.HIGH,
											visibility: NotificationVisibility.PRIVATE,
											clickAction: NotificationAction.MESSAGE_INBOX,
										},
									},
									topic: userAccountInfo.broadcastTopic,
								};
								// await sendMessageToTopic(recipientMessage);
								//  Send the message data and basic account information of the user as data message to the client
								let clientMessage: FCMMessaging = {
									data: {
										messageData: JSON.stringify({
											...messageResponseData,
										}),
										accounInfo: JSON.stringify({
											id: userAccountInfo._id.toString(),
											userId: userAccountInfo.userId,
											profilePictureUri:
												userAccountInfo.profilePictureUri,
											name: userAccountInfo.name,
										}),
									},
									topic: clientAccountInfo.broadcastTopic,
								};
								// await sendMessageToTopic(clientMessage);
							} else {
								throw new AppError(
									"Failed to send message",
									HttpStatusCodes.NOT_FOUND
								);
							}
						} else {
							// Create a new chat document in the database and then send the message to the recipients and senders topic through fcm to the recipient as a message request
							let attachment: AttachmentPayloadParams = {
								type: "audio",
								id: audioId,
								caption: caption,
							};
							// Create the chat document in the database between client and user and then insert the message document for the chat in the database
							let messageId = await executeTransactionWithRetry(
								databaseClient,
								async (session) => {
									const messageId = await createOneToOneChat(
										clientAccountId,
										userAccountId,
										true,
										attachment,
										new Date(),
										session
									);
									await updateAudioShares(attachment.id, session);
									return messageId;
								}
							);
							let messageResponseData = await getChatMessageResponseData(
								messageId,
								clientAccountId
							);
							// If the messageResponseData exists and the data.type field is attachment, send the message to the client and user through fcm, else throw an error
							if (
								messageResponseData &&
								messageResponseData.data.type === "attachment"
							) {
								//  Send the message data and basic account information of the client as data message to the user
								let recipientMessage: FCMMessaging = {
									data: {
										messageData: JSON.stringify({
											id: messageResponseData.id,
											author: messageResponseData.author,
											sentAt: messageResponseData.sentAt,
											seenBy: messageResponseData.seenBy,
											reactions: messageResponseData.reactions,
											data: {
												type: "attachment",
												attachment: hasRecipientReceivingPrivilege
													? messageResponseData.data.attachment
													: null,
												caption: messageResponseData.data.caption,
											},
										} as MessageResponseParams),
										accounInfo: JSON.stringify({
											id: clientAccountId,
											userId: clientAccountInfo.userId,
											profilePictureUri:
												clientAccountInfo.profilePictureUri,
											name: clientAccountInfo.name,
										}),
									},
									notification: {
										title: clientAccountInfo.name,
										body: "Sent you a message request",
										imageUrl: clientAccountInfo.profilePictureUri,
									},
									android: {
										priority: MessagePriority.HIGH,
										ttl: 86400,
										notification: {
											eventTimestamp: new Date(),
											channelId:
												NotificationChannelId.DIRECT_MESSAGE,
											priority: NotificationPriority.HIGH,
											visibility: NotificationVisibility.PRIVATE,
											clickAction:
												NotificationAction.MESSAGE_REQUEST,
										},
									},
									topic: userAccountInfo.broadcastTopic,
								};
								// await sendMessageToTopic(recipientMessage);
								//  Send the message data and basic account information of the user as data message to the client
								let clientMessage: FCMMessaging = {
									data: {
										messageData: JSON.stringify({
											...messageResponseData,
										}),
										accounInfo: JSON.stringify({
											id: userAccountInfo._id.toString(),
											userId: userAccountInfo.userId,
											profilePictureUri:
												userAccountInfo.profilePictureUri,
											name: userAccountInfo.name,
										}),
									},
									topic: clientAccountInfo.broadcastTopic,
								};
								// await sendMessageToTopic(clientMessage);
							} else {
								throw new AppError(
									"Failed to send message",
									HttpStatusCodes.NOT_FOUND
								);
							}
						}
					} else {
						throw new AppError(
							"Failed to send message",
							HttpStatusCodes.NOT_FOUND
						);
					}
				}
			} else {
				throw new AppError("Failed to send message", HttpStatusCodes.FORBIDDEN);
			}

			// If either userAccountInfo or clientAccountInfo is NULL or if there exists a blocking relation between them then sending message will not be possible between them, throw an Error
		} else {
			throw new AppError("Failed to send message", HttpStatusCodes.NOT_FOUND);
		}
	} catch (error) {
		throw error;
	}
};

/** Function creates a chat document if it doesn't exists and inserts the memory attachment message in the database
 * @name oneToOneChatMemoryAttachmentService
 * @param userAccountId - AccountId of the user to whom the message is to sent
 * @param clientAccountInfo - Basic information of the client from where the message is being sent
 * @param memoryId - Id of the memory which is being sent as an attachment
 * @param caption - Caption of the message
 * @returns Promise<void>
 * */

export const oneToOneChatMemoryAttachmentService = async (
	userAccountId: string,
	clientAccountInfo: WithId<Account>,
	memoryId: string,
	caption?: string
): Promise<void> => {
	try {
		// Check whether the user account is available or not
		const userAccountInfo = await getAccountById(userAccountId);
		const clientAccountId = clientAccountInfo._id.toString();
		// Check whether there exists a blocking relation between user and client, i.e either user has blocked client, or the client has blocked the user
		const accountBlockedInfo = await isAccountBlocked(userAccountId, clientAccountId);
		// Check whether the memory exists or not, if not throw an error
		const memoryInfo = await getMemoryResponse(memoryId, clientAccountId);
		if (memoryInfo) {
			// Check whether the author of the memory is available or not
			const authorInfo = await getAccountById(memoryInfo.author.id);
			// If the authorInfo is not NULL and also check that sharing is not disabled for the memory
			if (authorInfo) {
				const authorId = authorInfo._id.toString();
				// Check whether the client has the privilege to send the attachment based on any blocking relationship between the client and aurthor or if the author is a private account and whether the client follows the author or not
				const hasClientSendingPrivilege =
					!memoryInfo.author.isBlocked && memoryInfo.author.isAvailable
						? true
						: false;
				// Check whether the user has the privilege to receive the attachment based on any blocking relationship between the author and user or if the author is a private account and whether the user follows the author or not
				const hasRecipientReceivingPrivilege =
					!(await isAccountBlocked(authorId, userAccountId)) &&
					((authorInfo.isPrivate &&
						(await isAccountFollower(authorId, userAccountId))) ||
						!authorInfo.isPrivate)
						? true
						: false;
				// If userAccountInfo is not NULL and client has the privilege to send the attachment and accountBlockInfo is NULL, then continue with further checks
				if (
					userAccountInfo &&
					hasClientSendingPrivilege &&
					!memoryInfo.advancedOptions.disableSharing &&
					!accountBlockedInfo
				) {
					// Check whether chat exists between user and client
					const chatInfo = await isOneToOneChatAvailable(
						userAccountId,
						clientAccountId
					);
					// If Chat document exists, then continue with further checks. Else check if the client has the privilege to start a chat or send a message request to the user
					if (chatInfo) {
						let isClientChatMember = false;
						let hasClientDeletedChat = false;
						let hasRecipientDeletedChat = false;
						for (let participant of chatInfo.participants) {
							if (
								participant.accountId.toString() === clientAccountId &&
								participant.isMember === true
							) {
								isClientChatMember = true;
								hasClientDeletedChat = participant.isDeleted;
							}
							if (participant.accountId.toString() === userAccountId) {
								hasRecipientDeletedChat = participant.isDeleted;
							}
						}
						// If the client is in the participant list of the chat document and is an active member of the chat, else throw an error
						if (isClientChatMember) {
							let attachment: AttachmentPayloadParams = {
								type: "memory",
								id: memoryId,
								caption: caption,
							};
							// Insert the message in the database, get the response message from the inserted messageId and send the message to the user and client through fcm
							let messageId = await executeTransactionWithRetry(
								databaseClient,
								async (session) => {
									const messageId =
										await oneToOneChatAttachmentMessageUpload(
											clientAccountId,
											userAccountId,
											attachment,
											new Date(),
											session
										);
									await updateMemoryShares(memoryId, session);
									return messageId;
								}
							);
							let messageResponseData = await getChatMessageResponseData(
								messageId,
								clientAccountId
							);
							// If the messageResponseData exists and data.type field is attachment send the message as data message through fcm, else throw an error
							if (
								messageResponseData &&
								messageResponseData.data.type === "attachment"
							) {
								// If the user has not deleted the chat then fcm will send the complete message payload and only the clientAccountId as data message, else it will send the clients basic information along with the message payload as data message
								if (!hasRecipientDeletedChat) {
									let recipientMessage: FCMMessaging = {
										data: {
											messageData: JSON.stringify({
												id: messageResponseData.id,
												author: messageResponseData.author,
												sentAt: messageResponseData.sentAt,
												seenBy: messageResponseData.seenBy,
												reactions: messageResponseData.reactions,
												data: {
													type: "attachment",
													attachment:
														hasRecipientReceivingPrivilege
															? messageResponseData.data
																	.attachment
															: null,
													caption:
														messageResponseData.data.caption,
												},
											} as MessageResponseParams),
											accountId: clientAccountId,
										},
										notification: {
											title: clientAccountInfo.name,
											body: `Sent you a memory of ${authorInfo.name}`,
											imageUrl: clientAccountInfo.profilePictureUri,
										},
										android: {
											priority: MessagePriority.HIGH,
											ttl: 86400,
											notification: {
												eventTimestamp: new Date(),
												channelId:
													NotificationChannelId.DIRECT_MESSAGE,
												priority: NotificationPriority.HIGH,
												visibility:
													NotificationVisibility.PRIVATE,
												clickAction:
													NotificationAction.MESSAGE_INBOX,
											},
										},
										topic: userAccountInfo.broadcastTopic,
									};
									// await sendMessageToTopic(recipientMessage);
								} else {
									let recipientMessage: FCMMessaging = {
										data: {
											messageData: JSON.stringify({
												id: messageResponseData.id,
												author: messageResponseData.author,
												sentAt: messageResponseData.sentAt,
												seenBy: messageResponseData.seenBy,
												reactions: messageResponseData.reactions,
												data: {
													type: "attachment",
													attachment:
														hasRecipientReceivingPrivilege
															? messageResponseData.data
																	.attachment
															: null,
													caption:
														messageResponseData.data.caption,
												},
											} as MessageResponseParams),
											accounInfo: JSON.stringify({
												id: clientAccountInfo._id.toString(),
												userId: clientAccountInfo.userId,
												profilePictureUri:
													clientAccountInfo.profilePictureUri,
												name: clientAccountInfo.name,
											}),
										},
										notification: {
											title: clientAccountInfo.name,
											body: `Sent you a memory of ${authorInfo.name}`,
											imageUrl: clientAccountInfo.profilePictureUri,
										},
										android: {
											priority: MessagePriority.HIGH,
											ttl: 86400,
											notification: {
												eventTimestamp: new Date(),
												channelId:
													NotificationChannelId.DIRECT_MESSAGE,
												priority: NotificationPriority.HIGH,
												visibility:
													NotificationVisibility.PRIVATE,
												clickAction:
													NotificationAction.MESSAGE_INBOX,
											},
										},
										topic: userAccountInfo.broadcastTopic,
									};
									// await sendMessageToTopic(recipientMessage);
								}
								// If the client has not deleted the chat then fcm will send the complete message payload and only the userAccountId as data message, else it will send the users basic information along with the message payload as data message
								if (!hasClientDeletedChat) {
									let clientMessage: FCMMessaging = {
										data: {
											messageData: JSON.stringify({
												...messageResponseData,
											}),
											accountId: userAccountId,
										},
										topic: clientAccountInfo.broadcastTopic,
									};
									// await sendMessageToTopic(clientMessage);
								} else {
									let clientMessage: FCMMessaging = {
										data: {
											messageData: JSON.stringify({
												...messageResponseData,
											}),
											accounInfo: JSON.stringify({
												id: userAccountInfo._id.toString(),
												userId: userAccountInfo.userId,
												profilePictureUri:
													userAccountInfo.profilePictureUri,
												name: userAccountInfo.name,
											}),
										},
										topic: clientAccountInfo.broadcastTopic,
									};
									// await sendMessageToTopic(clientMessage);
								}
							} else {
								throw new AppError(
									"Failed to send message",
									HttpStatusCodes.NOT_FOUND
								);
							}
						} else {
							throw new AppError(
								"Failed to send message",
								HttpStatusCodes.FORBIDDEN
							);
						}
					} else {
						const [clientFollowingInfo, userFollowingInfo, userContactInfo] =
							await Promise.all([
								isAccountFollower(userAccountId, clientAccountId),
								isAccountFollower(clientAccountId, userAccountId),
								getAccountContacts(userAccountId, clientAccountId),
							]);
						// Check if the client can initiate a chat with the user or not, based on users chat settings
						if (
							(userAccountInfo.isPrivate &&
								clientFollowingInfo &&
								((userAccountInfo.privacySettings.chatSettings
									.messageRequests.following &&
									userFollowingInfo) ||
									(userAccountInfo.privacySettings.chatSettings
										.messageRequests.contacts &&
										userContactInfo) ||
									userAccountInfo.privacySettings.chatSettings
										.messageRequests.others)) ||
							(userAccountInfo.isPrivate === false &&
								((userAccountInfo.privacySettings.chatSettings
									.messageRequests.following &&
									userFollowingInfo) ||
									(userAccountInfo.privacySettings.chatSettings
										.messageRequests.contacts &&
										userContactInfo) ||
									userAccountInfo.privacySettings.chatSettings
										.messageRequests.others))
						) {
							// If the user follows the client then the client can send messages directly to the inbox, else the message will as message request
							if (userFollowingInfo) {
								// Create a new chat document in the database and then send the message to the recipients and senders topic through fcm to the recipients inbox
								let attachment: AttachmentPayloadParams = {
									type: "memory",
									id: memoryId,
									caption: caption,
								};
								// Create the chat document in the database between client and user and then insert the message document for the chat in the database
								const messageId = await executeTransactionWithRetry(
									databaseClient,
									async (session) => {
										const messageId = await createOneToOneChat(
											clientAccountId,
											userAccountId,
											false,
											attachment,
											new Date(),
											session
										);
										await updateMemoryShares(memoryId, session);
										return messageId;
									}
								);
								// Generate the messageResponseData from the inserted message document id
								let messageResponseData =
									await getChatMessageResponseData(
										messageId,
										clientAccountId
									);
								// If the messageResponseData exists and the data.type field is text, send the message to the client and user through fcm, else throw an error
								if (
									messageResponseData &&
									messageResponseData.data.type === "attachment"
								) {
									//  Send the message data and basic account information of the client as data message to the user
									let recipientMessage: FCMMessaging = {
										data: {
											messageData: JSON.stringify({
												id: messageResponseData.id,
												author: messageResponseData.author,
												sentAt: messageResponseData.sentAt,
												seenBy: messageResponseData.seenBy,
												reactions: messageResponseData.reactions,
												data: {
													type: "attachment",
													attachment:
														hasRecipientReceivingPrivilege
															? messageResponseData.data
																	.attachment
															: null,
													caption:
														messageResponseData.data.caption,
												},
											} as MessageResponseParams),
											accounInfo: JSON.stringify({
												id: clientAccountInfo._id.toString(),
												userId: clientAccountInfo.userId,
												profilePictureUri:
													clientAccountInfo.profilePictureUri,
												name: clientAccountInfo.name,
											}),
										},
										notification: {
											title: clientAccountInfo.name,
											body: `Sent you a memory of ${authorInfo.name}`,
											imageUrl: clientAccountInfo.profilePictureUri,
										},
										android: {
											priority: MessagePriority.HIGH,
											ttl: 86400,
											notification: {
												eventTimestamp: new Date(),
												channelId:
													NotificationChannelId.DIRECT_MESSAGE,
												priority: NotificationPriority.HIGH,
												visibility:
													NotificationVisibility.PRIVATE,
												clickAction:
													NotificationAction.MESSAGE_INBOX,
											},
										},
										topic: userAccountInfo.broadcastTopic,
									};
									// await sendMessageToTopic(recipientMessage);
									//  Send the message data and basic account information of the user as data message to the client
									let clientMessage: FCMMessaging = {
										data: {
											messageData: JSON.stringify({
												...messageResponseData,
											}),
											accounInfo: JSON.stringify({
												id: userAccountInfo._id.toString(),
												userId: userAccountInfo.userId,
												profilePictureUri:
													userAccountInfo.profilePictureUri,
												name: userAccountInfo.name,
											}),
										},
										topic: clientAccountInfo.broadcastTopic,
									};
									// await sendMessageToTopic(clientMessage);
								} else {
									throw new AppError(
										"Failed to send message",
										HttpStatusCodes.NOT_FOUND
									);
								}
							} else {
								// Create a new chat document in the database and then send the message to the recipients and senders topic through fcm to the recipient as a message request
								let attachment: AttachmentPayloadParams = {
									type: "memory",
									id: memoryId,
									caption: caption,
								};
								// Create the chat document in the database between client and user and then insert the message document for the chat in the database
								let messageId = await executeTransactionWithRetry(
									databaseClient,
									async (session) => {
										const messageId = await createOneToOneChat(
											clientAccountId,
											userAccountId,
											true,
											attachment,
											new Date(),
											session
										);
										await updateMemoryShares(memoryId, session);
										return messageId;
									}
								);
								let messageResponseData =
									await getChatMessageResponseData(
										messageId,
										clientAccountId
									);
								// If the messageResponseData exists and the data.type field is attachment, send the message to the client and user through fcm, else throw an error
								if (
									messageResponseData &&
									messageResponseData.data.type === "attachment"
								) {
									//  Send the message data and basic account information of the client as data message to the user
									let recipientMessage: FCMMessaging = {
										data: {
											messageData: JSON.stringify({
												id: messageResponseData.id,
												author: messageResponseData.author,
												sentAt: messageResponseData.sentAt,
												seenBy: messageResponseData.seenBy,
												reactions: messageResponseData.reactions,
												data: {
													type: "attachment",
													attachment:
														hasRecipientReceivingPrivilege
															? messageResponseData.data
																	.attachment
															: null,
													caption:
														messageResponseData.data.caption,
												},
											} as MessageResponseParams),
											accounInfo: JSON.stringify({
												id: clientAccountInfo._id.toString(),
												userId: clientAccountInfo.userId,
												profilePictureUri:
													clientAccountInfo.profilePictureUri,
												name: clientAccountInfo.name,
											}),
										},
										notification: {
											title: clientAccountInfo.name,
											body: "Sent you a message request",
											imageUrl: clientAccountInfo.profilePictureUri,
										},
										android: {
											priority: MessagePriority.HIGH,
											ttl: 86400,
											notification: {
												eventTimestamp: new Date(),
												channelId:
													NotificationChannelId.DIRECT_MESSAGE,
												priority: NotificationPriority.HIGH,
												visibility:
													NotificationVisibility.PRIVATE,
												clickAction:
													NotificationAction.MESSAGE_REQUEST,
											},
										},
										topic: userAccountInfo.broadcastTopic,
									};
									// await sendMessageToTopic(recipientMessage);
									//  Send the message data and basic account information of the user as data message to the client
									let clientMessage: FCMMessaging = {
										data: {
											messageData: JSON.stringify({
												...messageResponseData,
											}),
											accounInfo: JSON.stringify({
												id: userAccountInfo._id.toString(),
												userId: userAccountInfo.userId,
												profilePictureUri:
													userAccountInfo.profilePictureUri,
												name: userAccountInfo.name,
											}),
										},
										topic: clientAccountInfo.broadcastTopic,
									};
									// await sendMessageToTopic(clientMessage);
								} else {
									throw new AppError(
										"Failed to send message",
										HttpStatusCodes.NOT_FOUND
									);
								}
							}
						} else {
							throw new AppError(
								"Failed to send message",
								HttpStatusCodes.FORBIDDEN
							);
						}
					}
				} else {
					throw new AppError(
						"Failed to send message",
						HttpStatusCodes.FORBIDDEN
					);
				}
			}
			// If either userAccountInfo or clientAccountInfo is NULL or if there exists a blocking relation between them then sending message will not be possible between them, throw an Error
			else {
				throw new AppError("Failed to send message", HttpStatusCodes.NOT_FOUND);
			}
		} else {
			throw new AppError("Failed to send message", HttpStatusCodes.NOT_FOUND);
		}
	} catch (error) {
		throw error;
	}
};

/** Function creates a chat document if it doesn't exists and inserts the memory reply message in the database
 * @name oneToOneChatMemoryReplyService
 * @param userAccountId - AccountId of the user to whom the message is to sent
 * @param clientAccountInfo - Basic information of the client from where the message is being sent
 * @param memoryId - Id of the memory which is being replied to
 * @param Caption - Caption of the message
 * @returns Promise<void>
 * */

export const oneToOneChatMemoryReplyService = async (
	userAccountId: string,
	clientAccountInfo: WithId<Account>,
	memoryId: string,
	caption: string
): Promise<void> => {
	try {
		// Check whether the user account is available or not
		const userAccountInfo = await getAccountById(userAccountId);
		const clientAccountId = clientAccountInfo._id.toString();
		// Check whether there exists a blocking relation between user and client, i.e either user has blocked client, or the client has blocked the user
		const accountBlockedInfo = await isAccountBlocked(userAccountId, clientAccountId);
		// Check whether the memory exists or not, if not throw an error
		const memoryInfo = await getMemoryResponse(memoryId, clientAccountId);
		if (memoryInfo) {
			// Check whether the author of the memory is available or not
			const authorInfo = await getAccountById(memoryInfo.author.id);
			// If the authorInfo is not NULL then contiue with further checks
			if (authorInfo) {
				const authorId = authorInfo._id.toString();
				// Check whether the client has the privilege to send the attachment based on any blocking relationship between the client and aurthor or if the author is a private account and whether the client follows the author or not
				const hasClientSendingPrivilege =
					!memoryInfo.author.isBlocked && memoryInfo.author.isAvailable
						? true
						: false;
				// If userAccountInfo is not NULL and client has the privilege to send the attachment and accountBlockInfo is NULL, then continue with further checks
				if (
					userAccountInfo &&
					authorId === userAccountId &&
					(memoryInfo.advancedOptions.replySetting === "all" ||
						(memoryInfo.advancedOptions.replySetting === "following" &&
							(await isAccountFollower(authorId, clientAccountId)))) &&
					hasClientSendingPrivilege &&
					!accountBlockedInfo
				) {
					// Check whether chat exists between user and client
					const chatInfo = await isOneToOneChatAvailable(
						userAccountId,
						clientAccountId
					);
					// If Chat document exists, then continue with further checks. Else check if the client has the privilege to start a chat or send a message request to the user
					if (chatInfo) {
						let isClientChatMember = false;
						let hasClientDeletedChat = false;
						let hasRecipientDeletedChat = false;
						for (let participant of chatInfo.participants) {
							if (
								participant.accountId.toString() === clientAccountId &&
								participant.isMember === true
							) {
								isClientChatMember = true;
								hasClientDeletedChat = participant.isDeleted;
							}
							if (participant.accountId.toString() === userAccountId) {
								hasRecipientDeletedChat = participant.isDeleted;
							}
						}
						// If the client is in the participant list of the chat document and is an active member of the chat, else throw an error
						if (isClientChatMember) {
							let attachment: AttachmentPayloadParams = {
								type: "memory",
								id: memoryId,
								caption: caption,
							};
							// Insert the message in the database, get the response message from the inserted messageId and send the message to the user and client through fcm
							let messageId = await executeTransactionWithRetry(
								databaseClient,
								async (session) => {
									return await oneToOneChatAttachmentMessageUpload(
										clientAccountId,
										userAccountId,
										attachment,
										new Date(),
										session
									);
								}
							);
							let messageResponseData = await getChatMessageResponseData(
								messageId,
								clientAccountId
							);
							// If the messageResponseData exists and data.type field is attachment send the message as data message through fcm, else throw an error
							if (
								messageResponseData &&
								messageResponseData.data.type === "attachment"
							) {
								// If the user has not deleted the chat then fcm will send the complete message payload and only the clientAccountId as data message, else it will send the clients basic information along with the message payload as data message
								if (!hasRecipientDeletedChat) {
									let recipientMessage: FCMMessaging = {
										data: {
											messageData: JSON.stringify({
												id: messageResponseData.id,
												author: messageResponseData.author,
												sentAt: messageResponseData.sentAt,
												seenBy: messageResponseData.seenBy,
												reactions: messageResponseData.reactions,
												data: {
													type: "attachment",
													attachment:
														messageResponseData.data
															.attachment,
													caption:
														messageResponseData.data.caption,
												},
											} as MessageResponseParams),
											accountid: clientAccountInfo._id.toString(),
										},
										notification: {
											title: clientAccountInfo.name,
											body: `Replied to your memory`,
											imageUrl: clientAccountInfo.profilePictureUri,
										},
										android: {
											priority: MessagePriority.HIGH,
											ttl: 86400,
											notification: {
												eventTimestamp: new Date(),
												channelId:
													NotificationChannelId.DIRECT_MESSAGE,
												priority: NotificationPriority.HIGH,
												visibility:
													NotificationVisibility.PRIVATE,
												clickAction:
													NotificationAction.MESSAGE_INBOX,
											},
										},
										topic: userAccountInfo.broadcastTopic,
									};
									// await sendMessageToTopic(recipientMessage);
								} else {
									let recipientMessage: FCMMessaging = {
										data: {
											messageData: JSON.stringify({
												id: messageResponseData.id,
												author: messageResponseData.author,
												sentAt: messageResponseData.sentAt,
												seenBy: messageResponseData.seenBy,
												reactions: messageResponseData.reactions,
												data: {
													type: "attachment",
													attachment:
														messageResponseData.data
															.attachment,
													caption:
														messageResponseData.data.caption,
												},
											} as MessageResponseParams),
											accounInfo: JSON.stringify({
												id: clientAccountInfo._id.toString(),
												userId: clientAccountInfo.userId,
												profilePictureUri:
													clientAccountInfo.profilePictureUri,
												name: clientAccountInfo.name,
											}),
										},
										notification: {
											title: clientAccountInfo.name,
											body: `Replied to your memory`,
											imageUrl: clientAccountInfo.profilePictureUri,
										},
										android: {
											priority: MessagePriority.HIGH,
											ttl: 86400,
											notification: {
												eventTimestamp: new Date(),
												channelId:
													NotificationChannelId.DIRECT_MESSAGE,
												priority: NotificationPriority.HIGH,
												visibility:
													NotificationVisibility.PRIVATE,
												clickAction:
													NotificationAction.MESSAGE_INBOX,
											},
										},
										topic: userAccountInfo.broadcastTopic,
									};
									// await sendMessageToTopic(recipientMessage);
								}
								// If the client has not deleted the chat then fcm will send the complete message payload and only the userAccountId as data message, else it will send the users basic information along with the message payload as data message
								if (!hasClientDeletedChat) {
									let clientMessage: FCMMessaging = {
										data: {
											messageData: JSON.stringify({
												...messageResponseData,
											}),
											accountId: userAccountId,
										},
										topic: clientAccountInfo.broadcastTopic,
									};
									// await sendMessageToTopic(clientMessage);
								} else {
									let clientMessage: FCMMessaging = {
										data: {
											messageData: JSON.stringify({
												...messageResponseData,
											}),
											accounInfo: JSON.stringify({
												id: userAccountInfo._id.toString(),
												userId: userAccountInfo.userId,
												profilePictureUri:
													userAccountInfo.profilePictureUri,
												name: userAccountInfo.name,
											}),
										},
										topic: clientAccountInfo.broadcastTopic,
									};
									// await sendMessageToTopic(clientMessage);
								}
							} else {
								throw new AppError(
									"Failed to send message",
									HttpStatusCodes.NOT_FOUND
								);
							}
						} else {
							throw new AppError(
								"Failed to send message",
								HttpStatusCodes.FORBIDDEN
							);
						}
					} else {
						const [clientFollowingInfo, userFollowingInfo, userContactInfo] =
							await Promise.all([
								isAccountFollower(userAccountId, clientAccountId),
								isAccountFollower(clientAccountId, userAccountId),
								getAccountContacts(userAccountId, clientAccountId),
							]);
						// Check if the client can initiate a chat with the user or not, based on users chat settings
						if (
							(userAccountInfo.isPrivate &&
								clientFollowingInfo &&
								((userAccountInfo.privacySettings.chatSettings
									.messageRequests.following &&
									userFollowingInfo) ||
									(userAccountInfo.privacySettings.chatSettings
										.messageRequests.contacts &&
										userContactInfo) ||
									userAccountInfo.privacySettings.chatSettings
										.messageRequests.others)) ||
							(userAccountInfo.isPrivate === false &&
								((userAccountInfo.privacySettings.chatSettings
									.messageRequests.following &&
									userFollowingInfo) ||
									(userAccountInfo.privacySettings.chatSettings
										.messageRequests.contacts &&
										userContactInfo) ||
									userAccountInfo.privacySettings.chatSettings
										.messageRequests.others))
						) {
							// If the user follows the client then the client can send messages directly to the inbox, else the message will as message request
							if (userFollowingInfo) {
								// Create a new chat document in the database and then send the message to the recipients and senders topic through fcm to the recipients inbox
								let attachment: AttachmentPayloadParams = {
									type: "memory",
									id: memoryId,
									caption: caption,
								};
								// Create the chat document in the database between client and user and then insert the message document for the chat in the database
								let messageId = await executeTransactionWithRetry(
									databaseClient,
									async (session) => {
										const messageId = await createOneToOneChat(
											clientAccountId,
											userAccountId,
											false,
											attachment,
											new Date(),
											session
										);
										await updateMemoryShares(memoryId, session);
										return messageId;
									}
								);
								// Generate the messageResponseData from the inserted message document id
								let messageResponseData =
									await getChatMessageResponseData(
										messageId,
										clientAccountId
									);
								// If the messageResponseData exists and the data.type field is text, send the message to the client and user through fcm, else throw an error
								if (
									messageResponseData &&
									messageResponseData.data.type === "attachment"
								) {
									//  Send the message data and basic account information of the client as data message to the user
									let recipientMessage: FCMMessaging = {
										data: {
											messageData: JSON.stringify({
												id: messageResponseData.id,
												author: messageResponseData.author,
												sentAt: messageResponseData.sentAt,
												seenBy: messageResponseData.seenBy,
												reactions: messageResponseData.reactions,
												data: {
													type: "attachment",
													attachment:
														messageResponseData.data
															.attachment,
													caption:
														messageResponseData.data.caption,
												},
											} as MessageResponseParams),
											accounInfo: JSON.stringify({
												id: clientAccountInfo._id.toString(),
												userId: clientAccountInfo.userId,
												profilePictureUri:
													clientAccountInfo.profilePictureUri,
												name: clientAccountInfo.name,
											}),
										},
										notification: {
											title: clientAccountInfo.name,
											body: `Replied to your memory`,
											imageUrl: clientAccountInfo.profilePictureUri,
										},
										android: {
											priority: MessagePriority.HIGH,
											ttl: 86400,
											notification: {
												eventTimestamp: new Date(),
												channelId:
													NotificationChannelId.DIRECT_MESSAGE,
												priority: NotificationPriority.HIGH,
												visibility:
													NotificationVisibility.PRIVATE,
												clickAction:
													NotificationAction.MESSAGE_INBOX,
											},
										},
										topic: userAccountInfo.broadcastTopic,
									};
									// await sendMessageToTopic(recipientMessage);
									//  Send the message data and basic account information of the user as data message to the client
									let clientMessage: FCMMessaging = {
										data: {
											messageData: JSON.stringify({
												...messageResponseData,
											}),
											accounInfo: JSON.stringify({
												id: userAccountInfo._id.toString(),
												userId: userAccountInfo.userId,
												profilePictureUri:
													userAccountInfo.profilePictureUri,
												name: userAccountInfo.name,
											}),
										},
										topic: clientAccountInfo.broadcastTopic,
									};
									// await sendMessageToTopic(clientMessage);
								} else {
									throw new AppError(
										"Failed to send message",
										HttpStatusCodes.NOT_FOUND
									);
								}
							} else {
								// Create a new chat document in the database and then send the message to the recipients and senders topic through fcm to the recipient as a message request
								let attachment: AttachmentPayloadParams = {
									type: "memory",
									id: memoryId,
									caption: caption,
								};
								// Create the chat document in the database between client and user and then insert the message document for the chat in the database
								let messageId = await executeTransactionWithRetry(
									databaseClient,
									async (session) => {
										const messageId = await createOneToOneChat(
											clientAccountId,
											userAccountId,
											true,
											attachment,
											new Date(),
											session
										);
										await updateMemoryShares(memoryId, session);
										return messageId;
									}
								);
								let messageResponseData =
									await getChatMessageResponseData(
										messageId,
										clientAccountId
									);
								// If the messageResponseData exists and the data.type field is attachment, send the message to the client and user through fcm, else throw an error
								if (
									messageResponseData &&
									messageResponseData.data.type === "attachment"
								) {
									//  Send the message data and basic account information of the client as data message to the user
									let recipientMessage: FCMMessaging = {
										data: {
											messageData: JSON.stringify({
												id: messageResponseData.id,
												author: messageResponseData.author,
												sentAt: messageResponseData.sentAt,
												seenBy: messageResponseData.seenBy,
												reactions: messageResponseData.reactions,
												data: {
													type: "attachment",
													attachment:
														messageResponseData.data
															.attachment,
													caption:
														messageResponseData.data.caption,
												},
											} as MessageResponseParams),
											accounInfo: JSON.stringify({
												id: clientAccountInfo._id.toString(),
												userId: clientAccountInfo.userId,
												profilePictureUri:
													clientAccountInfo.profilePictureUri,
												name: clientAccountInfo.name,
											}),
										},
										notification: {
											title: clientAccountInfo.name,
											body: "Sent you a message request",
											imageUrl: clientAccountInfo.profilePictureUri,
										},
										android: {
											priority: MessagePriority.HIGH,
											ttl: 86400,
											notification: {
												eventTimestamp: new Date(),
												channelId:
													NotificationChannelId.DIRECT_MESSAGE,
												priority: NotificationPriority.HIGH,
												visibility:
													NotificationVisibility.PRIVATE,
												clickAction:
													NotificationAction.MESSAGE_REQUEST,
											},
										},
										topic: userAccountInfo.broadcastTopic,
									};
									// await sendMessageToTopic(recipientMessage);
									//  Send the message data and basic account information of the user as data message to the client
									let clientMessage: FCMMessaging = {
										data: {
											messageData: JSON.stringify({
												...messageResponseData,
											}),
											accounInfo: JSON.stringify({
												id: userAccountInfo._id.toString(),
												userId: userAccountInfo.userId,
												profilePictureUri:
													userAccountInfo.profilePictureUri,
												name: userAccountInfo.name,
											}),
										},
										topic: clientAccountInfo.broadcastTopic,
									};
									// await sendMessageToTopic(clientMessage);
								} else {
									throw new AppError(
										"Failed to send message",
										HttpStatusCodes.NOT_FOUND
									);
								}
							}
						} else {
							throw new AppError(
								"Failed to send message",
								HttpStatusCodes.FORBIDDEN
							);
						}
					}
				} else {
					throw new AppError(
						"Failed to send message",
						HttpStatusCodes.FORBIDDEN
					);
				}
			}
			// If either userAccountInfo or clientAccountInfo is NULL or if there exists a blocking relation between them then sending message will not be possible between them, throw an Error
			else {
				throw new AppError("Failed to send message", HttpStatusCodes.NOT_FOUND);
			}
		} else {
			throw new AppError("Failed to send message", HttpStatusCodes.NOT_FOUND);
		}
	} catch (error) {
		throw error;
	}
};

/** Function creates a chat document if it doesn't exists and inserts the highlight attachment message in the database
 * @name oneToOneChatHighlightAttachmentService
 * @param userAccountId - AccountId of the user to whom the message is to sent
 * @param clientAccountInfo - Basic information of the client from where the message is being sent
 * @param highlightId - Id of the highlight which is being sent as an attachment
 * @param memoryId - Id of the memory which is a part of the highlight that being sent as an attachment
 * @param caption - Caption of the message
 * @returns Promise<void>
 * */

export const oneToOneChatHighlightAttachmentService = async (
	userAccountId: string,
	clientAccountInfo: WithId<Account>,
	highlightId: string,
	memoryId: string,
	caption?: string
): Promise<void> => {
	try {
		// Check whether the user account is available or not
		const userAccountInfo = await getAccountById(userAccountId);
		const clientAccountId = clientAccountInfo._id.toString();
		// Check whether there exists a blocking relation between user and client, i.e either user has blocked client, or the client has blocked the user
		const accountBlockedInfo = await isAccountBlocked(userAccountId, clientAccountId);
		// Check whether the highlight exists or not, if not throw an error
		const highlightInfo = await getHighlightResponse(
			memoryId,
			highlightId,
			clientAccountId
		);
		if (highlightInfo) {
			// Check whether the author of the memory is available or not
			const authorInfo = await getAccountById(highlightInfo.memoryInfo.author.id);
			// If the authorInfo is not NULL and check that sharing is not disabled for the highlight
			if (authorInfo) {
				const authorId = authorInfo._id.toString();
				// Check whether the client has the privilege to send the attachment based on any blocking relationship between the client and aurthor or if the author is a private account and whether the client follows the author or not
				const hasClientSendingPrivilege =
					!highlightInfo.memoryInfo.author.isBlocked &&
					highlightInfo.memoryInfo.author.isAvailable
						? true
						: false;
				// Check whether the user has the privilege to receive the attachment based on any blocking relationship between the author and user or if the author is a private account and whether the user follows the author or not
				const hasRecipientReceivingPrivilege =
					!(await isAccountBlocked(authorId, userAccountId)) &&
					((authorInfo.isPrivate &&
						(await isAccountFollower(authorId, userAccountId))) ||
						!authorInfo.isPrivate)
						? true
						: false;
				// If userAccountInfo and clientAccountInfo is not NULL and client has the privilege to send the attachment and accountBlockInfo is NULL, then continue with further checks
				if (
					userAccountInfo &&
					hasClientSendingPrivilege &&
					!highlightInfo.memoryInfo.advancedOptions.disableSharing &&
					!accountBlockedInfo
				) {
					// Check whether chat exists between user and client
					const chatInfo = await isOneToOneChatAvailable(
						userAccountId,
						clientAccountId
					);
					// If Chat document exists, then continue with further checks. Else check if the client has the privilege to start a chat or send a message request to the user
					if (chatInfo) {
						let isClientChatMember = false;
						let hasClientDeletedChat = false;
						let hasRecipientDeletedChat = false;
						for (let participant of chatInfo.participants) {
							if (
								participant.accountId.toString() === clientAccountId &&
								participant.isMember === true
							) {
								isClientChatMember = true;
								hasClientDeletedChat = participant.isDeleted;
							}
							if (participant.accountId.toString() === userAccountId) {
								hasRecipientDeletedChat = participant.isDeleted;
							}
						}
						// If the client is in the participant list of the chat document and is an active member of the chat, else throw an error
						if (isClientChatMember) {
							let attachment: AttachmentPayloadParams = {
								type: "highlight",
								highlightId: highlightId,
								memoryId: memoryId,
								caption: caption,
							};
							// Insert the message in the database, get the response message from the inserted messageId and send the message to the user and client through fcm
							const messageId = await executeTransactionWithRetry(
								databaseClient,
								async (session) => {
									const messageId =
										await oneToOneChatAttachmentMessageUpload(
											clientAccountId,
											userAccountId,
											attachment,
											new Date(),
											session
										);
									await updateMemoryShares(memoryId, session);
									return messageId;
								}
							);
							let messageResponseData = await getChatMessageResponseData(
								messageId,
								clientAccountId
							);
							// If the messageResponseData exists and data.type field is attachment send the message as data message through fcm, else throw an error
							if (
								messageResponseData &&
								messageResponseData.data.type === "attachment"
							) {
								// If the user has not deleted the chat then fcm will send the complete message payload and only the clientAccountId as data message, else it will send the clients basic information along with the message payload as data message
								if (!hasRecipientDeletedChat) {
									let recipientMessage: FCMMessaging = {
										data: {
											messageData: JSON.stringify({
												id: messageResponseData.id,
												author: messageResponseData.author,
												sentAt: messageResponseData.sentAt,
												seenBy: messageResponseData.seenBy,
												reactions: messageResponseData.reactions,
												data: {
													type: "attachment",
													attachment:
														hasRecipientReceivingPrivilege
															? messageResponseData.data
																	.attachment
															: null,
													caption:
														messageResponseData.data.caption,
												},
											} as MessageResponseParams),
											accountId: clientAccountId,
										},
										notification: {
											title: clientAccountInfo.name,
											body: `Sent you a highlight of ${authorInfo.name}`,
											imageUrl: clientAccountInfo.profilePictureUri,
										},
										android: {
											priority: MessagePriority.HIGH,
											ttl: 86400,
											notification: {
												eventTimestamp: new Date(),
												channelId:
													NotificationChannelId.DIRECT_MESSAGE,
												priority: NotificationPriority.HIGH,
												visibility:
													NotificationVisibility.PRIVATE,
												clickAction:
													NotificationAction.MESSAGE_INBOX,
											},
										},
										topic: userAccountInfo.broadcastTopic,
									};
									// await sendMessageToTopic(recipientMessage);
								} else {
									let recipientMessage: FCMMessaging = {
										data: {
											messageData: JSON.stringify({
												id: messageResponseData.id,
												author: messageResponseData.author,
												sentAt: messageResponseData.sentAt,
												seenBy: messageResponseData.seenBy,
												reactions: messageResponseData.reactions,
												data: {
													type: "attachment",
													attachment:
														hasRecipientReceivingPrivilege
															? messageResponseData.data
																	.attachment
															: null,
													caption:
														messageResponseData.data.caption,
												},
											} as MessageResponseParams),
											accounInfo: JSON.stringify({
												id: clientAccountInfo._id.toString(),
												userId: clientAccountInfo.userId,
												profilePictureUri:
													clientAccountInfo.profilePictureUri,
												name: clientAccountInfo.name,
											}),
										},
										notification: {
											title: clientAccountInfo.name,
											body: `Sent you a highlight of ${authorInfo.name}`,
											imageUrl: clientAccountInfo.profilePictureUri,
										},
										android: {
											priority: MessagePriority.HIGH,
											ttl: 86400,
											notification: {
												eventTimestamp: new Date(),
												channelId:
													NotificationChannelId.DIRECT_MESSAGE,
												priority: NotificationPriority.HIGH,
												visibility:
													NotificationVisibility.PRIVATE,
												clickAction:
													NotificationAction.MESSAGE_INBOX,
											},
										},
										topic: userAccountInfo.broadcastTopic,
									};
									// await sendMessageToTopic(recipientMessage);
								}
								// If the client has not deleted the chat then fcm will send the complete message payload and only the userAccountId as data message, else it will send the users basic information along with the message payload as data message
								if (!hasClientDeletedChat) {
									let clientMessage: FCMMessaging = {
										data: {
											messageData: JSON.stringify({
												...messageResponseData,
											}),
											accountId: userAccountId,
										},
										topic: clientAccountInfo.broadcastTopic,
									};
									// await sendMessageToTopic(clientMessage);
								} else {
									let clientMessage: FCMMessaging = {
										data: {
											messageData: JSON.stringify({
												...messageResponseData,
											}),
											accounInfo: JSON.stringify({
												id: userAccountInfo._id.toString(),
												userId: userAccountInfo.userId,
												profilePictureUri:
													userAccountInfo.profilePictureUri,
												name: userAccountInfo.name,
											}),
										},
										topic: clientAccountInfo.broadcastTopic,
									};
									// await sendMessageToTopic(clientMessage);
								}
							} else {
								throw new AppError(
									"Failed to send message",
									HttpStatusCodes.NOT_FOUND
								);
							}
						} else {
							throw new AppError(
								"Failed to send message",
								HttpStatusCodes.FORBIDDEN
							);
						}
					} else {
						const [clientFollowingInfo, userFollowingInfo, userContactInfo] =
							await Promise.all([
								isAccountFollower(userAccountId, clientAccountId),
								isAccountFollower(clientAccountId, userAccountId),
								getAccountContacts(userAccountId, clientAccountId),
							]);
						// Check if the client can initiate a chat with the user or not, based on users chat settings
						if (
							(userAccountInfo.isPrivate &&
								clientFollowingInfo &&
								((userAccountInfo.privacySettings.chatSettings
									.messageRequests.following &&
									userFollowingInfo) ||
									(userAccountInfo.privacySettings.chatSettings
										.messageRequests.contacts &&
										userContactInfo) ||
									userAccountInfo.privacySettings.chatSettings
										.messageRequests.others)) ||
							(userAccountInfo.isPrivate === false &&
								((userAccountInfo.privacySettings.chatSettings
									.messageRequests.following &&
									userFollowingInfo) ||
									(userAccountInfo.privacySettings.chatSettings
										.messageRequests.contacts &&
										userContactInfo) ||
									userAccountInfo.privacySettings.chatSettings
										.messageRequests.others))
						) {
							// If the user follows the client then the client can send messages directly to the inbox, else the message will as message request
							if (userFollowingInfo) {
								// Create a new chat document in the database and then send the message to the recipients and senders topic through fcm to the recipients inbox
								let attachment: AttachmentPayloadParams = {
									type: "highlight",
									highlightId: highlightId,
									memoryId: memoryId,
									caption: caption,
								};
								// Create the chat document in the database between client and user and then insert the message document for the chat in the database
								const messageId = await executeTransactionWithRetry(
									databaseClient,
									async (session) => {
										const messageId = await createOneToOneChat(
											clientAccountId,
											userAccountId,
											false,
											attachment,
											new Date(),
											session
										);
										await updateMemoryShares(memoryId, session);
										return messageId;
									}
								);
								// Generate the messageResponseData from the inserted message document id
								let messageResponseData =
									await getChatMessageResponseData(
										messageId,
										clientAccountId
									);
								// If the messageResponseData exists and the data.type field is text, send the message to the client and user through fcm, else throw an error
								if (
									messageResponseData &&
									messageResponseData.data.type === "attachment"
								) {
									//  Send the message data and basic account information of the client as data message to the user
									let recipientMessage: FCMMessaging = {
										data: {
											messageData: JSON.stringify({
												id: messageResponseData.id,
												author: messageResponseData.author,
												sentAt: messageResponseData.sentAt,
												seenBy: messageResponseData.seenBy,
												reactions: messageResponseData.reactions,
												data: {
													type: "attachment",
													attachment:
														hasRecipientReceivingPrivilege
															? messageResponseData.data
																	.attachment
															: null,
													caption:
														messageResponseData.data.caption,
												},
											} as MessageResponseParams),
											accounInfo: JSON.stringify({
												id: clientAccountInfo._id.toString(),
												userId: clientAccountInfo.userId,
												profilePictureUri:
													clientAccountInfo.profilePictureUri,
												name: clientAccountInfo.name,
											}),
										},
										notification: {
											title: clientAccountInfo.name,
											body: `Sent you a highlight of ${authorInfo.name}`,
											imageUrl: clientAccountInfo.profilePictureUri,
										},
										android: {
											priority: MessagePriority.HIGH,
											ttl: 86400,
											notification: {
												eventTimestamp: new Date(),
												channelId:
													NotificationChannelId.DIRECT_MESSAGE,
												priority: NotificationPriority.HIGH,
												visibility:
													NotificationVisibility.PRIVATE,
												clickAction:
													NotificationAction.MESSAGE_INBOX,
											},
										},
										topic: userAccountInfo.broadcastTopic,
									};
									// await sendMessageToTopic(recipientMessage);
									//  Send the message data and basic account information of the user as data message to the client
									let clientMessage: FCMMessaging = {
										data: {
											messageData: JSON.stringify({
												...messageResponseData,
											}),
											accounInfo: JSON.stringify({
												id: userAccountInfo._id.toString(),
												userId: userAccountInfo.userId,
												profilePictureUri:
													userAccountInfo.profilePictureUri,
												name: userAccountInfo.name,
											}),
										},
										topic: clientAccountInfo.broadcastTopic,
									};
									// await sendMessageToTopic(clientMessage);
								} else {
									throw new AppError(
										"Failed to send message",
										HttpStatusCodes.NOT_FOUND
									);
								}
							} else {
								// Create a new chat document in the database and then send the message to the recipients and senders topic through fcm to the recipient as a message request
								let attachment: AttachmentPayloadParams = {
									type: "highlight",
									highlightId: highlightId,
									memoryId: memoryId,
									caption: caption,
								};
								// Create the chat document in the database between client and user and then insert the message document for the chat in the database
								let messageId = await executeTransactionWithRetry(
									databaseClient,
									async (session) => {
										const messageId = await createOneToOneChat(
											clientAccountId,
											userAccountId,
											true,
											attachment,
											new Date(),
											session
										);
										await updateMemoryShares(memoryId, session);
										return messageId;
									}
								);
								let messageResponseData =
									await getChatMessageResponseData(
										messageId,
										clientAccountId
									);
								// If the messageResponseData exists and the data.type field is attachment, send the message to the client and user through fcm, else throw an error
								if (
									messageResponseData &&
									messageResponseData.data.type === "attachment"
								) {
									//  Send the message data and basic account information of the client as data message to the user
									let recipientMessage: FCMMessaging = {
										data: {
											messageData: JSON.stringify({
												id: messageResponseData.id,
												author: messageResponseData.author,
												sentAt: messageResponseData.sentAt,
												seenBy: messageResponseData.seenBy,
												reactions: messageResponseData.reactions,
												data: {
													type: "attachment",
													attachment:
														hasRecipientReceivingPrivilege
															? messageResponseData.data
																	.attachment
															: null,
													caption:
														messageResponseData.data.caption,
												},
											} as MessageResponseParams),
											accounInfo: JSON.stringify({
												id: clientAccountInfo._id.toString(),
												userId: clientAccountInfo.userId,
												profilePictureUri:
													clientAccountInfo.profilePictureUri,
												name: clientAccountInfo.name,
											}),
										},
										notification: {
											title: clientAccountInfo.name,
											body: "Sent you a message request",
											imageUrl: clientAccountInfo.profilePictureUri,
										},
										android: {
											priority: MessagePriority.HIGH,
											ttl: 86400,
											notification: {
												eventTimestamp: new Date(),
												channelId:
													NotificationChannelId.DIRECT_MESSAGE,
												priority: NotificationPriority.HIGH,
												visibility:
													NotificationVisibility.PRIVATE,
												clickAction:
													NotificationAction.MESSAGE_REQUEST,
											},
										},
										topic: userAccountInfo.broadcastTopic,
									};
									// await sendMessageToTopic(recipientMessage);
									//  Send the message data and basic account information of the user as data message to the client
									let clientMessage: FCMMessaging = {
										data: {
											messageData: JSON.stringify({
												...messageResponseData,
											}),
											accounInfo: JSON.stringify({
												id: userAccountInfo._id.toString(),
												userId: userAccountInfo.userId,
												profilePictureUri:
													userAccountInfo.profilePictureUri,
												name: userAccountInfo.name,
											}),
										},
										topic: clientAccountInfo.broadcastTopic,
									};
									// await sendMessageToTopic(clientMessage);
								} else {
									throw new AppError(
										"Failed to send message",
										HttpStatusCodes.NOT_FOUND
									);
								}
							}
						} else {
							throw new AppError(
								"Failed to send message",
								HttpStatusCodes.FORBIDDEN
							);
						}
					}
				} else {
					throw new AppError(
						"Failed to send message",
						HttpStatusCodes.FORBIDDEN
					);
				}
			}
			// If either userAccountInfo or clientAccountInfo is NULL or if there exists a blocking relation between them then sending message will not be possible between them, throw an Error
			else {
				throw new AppError("Failed to send message", HttpStatusCodes.NOT_FOUND);
			}
		} else {
			throw new AppError("Failed to send message", HttpStatusCodes.NOT_FOUND);
		}
	} catch (error) {
		throw error;
	}
};

/** Function creates a chat document if it doesn't exists and inserts the highlight reply message in the database
 * @name oneToOneChatHighlightReplyService
 * @param userAccountId - AccountId of the user to whom the message is to sent
 * @param clientAccountInfo - Basic information of the client from where the message is being sent
 * @param highlightId - Id of the highlight which is being sent
 * @param memoryId - Id of the memory which is a part of the highlight that being sent
 * @param caption - Caption of the message
 * @returns Promise<void>
 * */

export const oneToOneChatHighlightReplyService = async (
	userAccountId: string,
	clientAccountInfo: WithId<Account>,
	highlightId: string,
	memoryId: string,
	caption?: string
): Promise<void> => {
	try {
		// Check whether the user account is available or not
		const userAccountInfo = await getAccountById(userAccountId);
		const clientAccountId = clientAccountInfo._id.toString();
		// Check whether there exists a blocking relation between user and client, i.e either user has blocked client, or the client has blocked the user
		const accountBlockedInfo = await isAccountBlocked(userAccountId, clientAccountId);
		// Check whether the highlight exists or not, if not throw an error
		const highlightInfo = await getHighlightResponse(
			memoryId,
			highlightId,
			clientAccountId
		);
		if (highlightInfo) {
			// Check whether the author of the memory is available or not
			const authorInfo = await getAccountById(highlightInfo.memoryInfo.author.id);
			// If the authorInfo is not NULL then contiue with further checks
			if (authorInfo) {
				const authorId = authorInfo._id.toString();

				// Check whether the client has the privilege to send the attachment based on any blocking relationship between the client and aurthor or if the author is a private account and whether the client follows the author or not
				const hasClientSendingPrivilege =
					!highlightInfo.memoryInfo.author.isBlocked &&
					highlightInfo.memoryInfo.author.isAvailable
						? true
						: false;
				// If userAccountInfo is not NULL and client has the privilege to send the attachment and accountBlockInfo is NULL, then continue with further checks
				if (
					userAccountInfo &&
					authorId === userAccountId &&
					(highlightInfo.memoryInfo.advancedOptions.replySetting === "all" ||
						(highlightInfo.memoryInfo.advancedOptions.replySetting ===
							"following" &&
							(await isAccountFollower(authorId, clientAccountId)))) &&
					hasClientSendingPrivilege &&
					!accountBlockedInfo
				) {
					// Check whether chat exists between user and client
					const chatInfo = await isOneToOneChatAvailable(
						userAccountId,
						clientAccountId
					);
					// If Chat document exists, then continue with further checks. Else check if the client has the privilege to start a chat or send a message request to the user
					if (chatInfo) {
						let isClientChatMember = false;
						let hasClientDeletedChat = false;
						let hasRecipientDeletedChat = false;
						for (let participant of chatInfo.participants) {
							if (
								participant.accountId.toString() === clientAccountId &&
								participant.isMember === true
							) {
								isClientChatMember = true;
								hasClientDeletedChat = participant.isDeleted;
							}
							if (participant.accountId.toString() === userAccountId) {
								hasRecipientDeletedChat = participant.isDeleted;
							}
						}
						// If the client is in the participant list of the chat document and is an active member of the chat, else throw an error
						if (isClientChatMember) {
							let attachment: AttachmentPayloadParams = {
								type: "highlight",
								highlightId: highlightId,
								memoryId: memoryId,
								caption: caption,
							};
							// Insert the message in the database, get the response message from the inserted messageId and send the message to the user and client through fcm
							const messageId = await executeTransactionWithRetry(
								databaseClient,
								async (session) => {
									const messageId =
										await oneToOneChatAttachmentMessageUpload(
											clientAccountId,
											userAccountId,
											attachment,
											new Date(),
											session
										);
									await updateMemoryShares(memoryId, session);
									return messageId;
								}
							);
							let messageResponseData = await getChatMessageResponseData(
								messageId,
								clientAccountId
							);
							// If the messageResponseData exists and data.type field is attachment send the message as data message through fcm, else throw an error
							if (
								messageResponseData &&
								messageResponseData.data.type === "attachment"
							) {
								// If the user has not deleted the chat then fcm will send the complete message payload and only the clientAccountId as data message, else it will send the clients basic information along with the message payload as data message
								if (!hasRecipientDeletedChat) {
									let recipientMessage: FCMMessaging = {
										data: {
											messageData: JSON.stringify({
												id: messageResponseData.id,
												author: messageResponseData.author,
												sentAt: messageResponseData.sentAt,
												seenBy: messageResponseData.seenBy,
												reactions: messageResponseData.reactions,
												data: {
													type: "attachment",
													attachment:
														messageResponseData.data
															.attachment,
													caption:
														messageResponseData.data.caption,
												},
											} as MessageResponseParams),
											accountId: clientAccountId,
										},
										notification: {
											title: clientAccountInfo.name,
											body: `Replied to your highlight`,
											imageUrl: clientAccountInfo.profilePictureUri,
										},
										android: {
											priority: MessagePriority.HIGH,
											ttl: 86400,
											notification: {
												eventTimestamp: new Date(),
												channelId:
													NotificationChannelId.DIRECT_MESSAGE,
												priority: NotificationPriority.HIGH,
												visibility:
													NotificationVisibility.PRIVATE,
												clickAction:
													NotificationAction.MESSAGE_INBOX,
											},
										},
										topic: userAccountInfo.broadcastTopic,
									};
									// await sendMessageToTopic(recipientMessage);
								} else {
									let recipientMessage: FCMMessaging = {
										data: {
											messageData: JSON.stringify({
												id: messageResponseData.id,
												author: messageResponseData.author,
												sentAt: messageResponseData.sentAt,
												seenBy: messageResponseData.seenBy,
												reactions: messageResponseData.reactions,
												data: {
													type: "attachment",
													attachment:
														messageResponseData.data
															.attachment,
													caption:
														messageResponseData.data.caption,
												},
											} as MessageResponseParams),
											accounInfo: JSON.stringify({
												id: clientAccountInfo._id.toString(),
												userId: clientAccountInfo.userId,
												profilePictureUri:
													clientAccountInfo.profilePictureUri,
												name: clientAccountInfo.name,
											}),
										},
										notification: {
											title: clientAccountInfo.name,
											body: `Replied to your highlight`,
											imageUrl: clientAccountInfo.profilePictureUri,
										},
										android: {
											priority: MessagePriority.HIGH,
											ttl: 86400,
											notification: {
												eventTimestamp: new Date(),
												channelId:
													NotificationChannelId.DIRECT_MESSAGE,
												priority: NotificationPriority.HIGH,
												visibility:
													NotificationVisibility.PRIVATE,
												clickAction:
													NotificationAction.MESSAGE_INBOX,
											},
										},
										topic: userAccountInfo.broadcastTopic,
									};
									// await sendMessageToTopic(recipientMessage);
								}
								// If the client has not deleted the chat then fcm will send the complete message payload and only the userAccountId as data message, else it will send the users basic information along with the message payload as data message
								if (!hasClientDeletedChat) {
									let clientMessage: FCMMessaging = {
										data: {
											messageData: JSON.stringify({
												...messageResponseData,
											}),
											accountId: userAccountId,
										},
										topic: clientAccountInfo.broadcastTopic,
									};
									// await sendMessageToTopic(clientMessage);
								} else {
									let clientMessage: FCMMessaging = {
										data: {
											messageData: JSON.stringify({
												...messageResponseData,
											}),
											accounInfo: JSON.stringify({
												id: userAccountInfo._id.toString(),
												userId: userAccountInfo.userId,
												profilePictureUri:
													userAccountInfo.profilePictureUri,
												name: userAccountInfo.name,
											}),
										},
										topic: clientAccountInfo.broadcastTopic,
									};
									// await sendMessageToTopic(clientMessage);
								}
							} else {
								throw new AppError(
									"Failed to send message",
									HttpStatusCodes.NOT_FOUND
								);
							}
						} else {
							throw new AppError(
								"Failed to send message",
								HttpStatusCodes.FORBIDDEN
							);
						}
					} else {
						const [clientFollowingInfo, userFollowingInfo, userContactInfo] =
							await Promise.all([
								isAccountFollower(userAccountId, clientAccountId),
								isAccountFollower(clientAccountId, userAccountId),
								getAccountContacts(userAccountId, clientAccountId),
							]);
						// Check if the client can initiate a chat with the user or not, based on users chat settings
						if (
							(userAccountInfo.isPrivate &&
								clientFollowingInfo &&
								((userAccountInfo.privacySettings.chatSettings
									.messageRequests.following &&
									userFollowingInfo) ||
									(userAccountInfo.privacySettings.chatSettings
										.messageRequests.contacts &&
										userContactInfo) ||
									userAccountInfo.privacySettings.chatSettings
										.messageRequests.others)) ||
							(userAccountInfo.isPrivate === false &&
								((userAccountInfo.privacySettings.chatSettings
									.messageRequests.following &&
									userFollowingInfo) ||
									(userAccountInfo.privacySettings.chatSettings
										.messageRequests.contacts &&
										userContactInfo) ||
									userAccountInfo.privacySettings.chatSettings
										.messageRequests.others))
						) {
							// If the user follows the client then the client can send messages directly to the inbox, else the message will as message request
							if (userFollowingInfo) {
								// Create a new chat document in the database and then send the message to the recipients and senders topic through fcm to the recipients inbox
								let attachment: AttachmentPayloadParams = {
									type: "highlight",
									highlightId: highlightId,
									memoryId: memoryId,
									caption: caption,
								};
								// Create the chat document in the database between client and user and then insert the message document for the chat in the database
								const messageId = await executeTransactionWithRetry(
									databaseClient,
									async (session) => {
										const messageId = await createOneToOneChat(
											clientAccountId,
											userAccountId,
											false,
											attachment,
											new Date(),
											session
										);
										await updateMemoryShares(memoryId, session);
										return messageId;
									}
								);
								// Generate the messageResponseData from the inserted message document id
								let messageResponseData =
									await getChatMessageResponseData(
										messageId,
										clientAccountId
									);
								// If the messageResponseData exists and the data.type field is text, send the message to the client and user through fcm, else throw an error
								if (
									messageResponseData &&
									messageResponseData.data.type === "attachment"
								) {
									//  Send the message data and basic account information of the client as data message to the user
									let recipientMessage: FCMMessaging = {
										data: {
											messageData: JSON.stringify({
												id: messageResponseData.id,
												author: messageResponseData.author,
												sentAt: messageResponseData.sentAt,
												seenBy: messageResponseData.seenBy,
												reactions: messageResponseData.reactions,
												data: {
													type: "attachment",
													attachment:
														messageResponseData.data
															.attachment,
													caption:
														messageResponseData.data.caption,
												},
											} as MessageResponseParams),
											accounInfo: JSON.stringify({
												id: clientAccountInfo._id.toString(),
												userId: clientAccountInfo.userId,
												profilePictureUri:
													clientAccountInfo.profilePictureUri,
												name: clientAccountInfo.name,
											}),
										},
										notification: {
											title: clientAccountInfo.name,
											body: `Replied to your highlight`,
											imageUrl: clientAccountInfo.profilePictureUri,
										},
										android: {
											priority: MessagePriority.HIGH,
											ttl: 86400,
											notification: {
												eventTimestamp: new Date(),
												channelId:
													NotificationChannelId.DIRECT_MESSAGE,
												priority: NotificationPriority.HIGH,
												visibility:
													NotificationVisibility.PRIVATE,
												clickAction:
													NotificationAction.MESSAGE_INBOX,
											},
										},
										topic: userAccountInfo.broadcastTopic,
									};
									// await sendMessageToTopic(recipientMessage);
									//  Send the message data and basic account information of the user as data message to the client
									let clientMessage: FCMMessaging = {
										data: {
											messageData: JSON.stringify({
												...messageResponseData,
											}),
											accounInfo: JSON.stringify({
												id: userAccountInfo._id.toString(),
												userId: userAccountInfo.userId,
												profilePictureUri:
													userAccountInfo.profilePictureUri,
												name: userAccountInfo.name,
											}),
										},
										topic: clientAccountInfo.broadcastTopic,
									};
									// await sendMessageToTopic(clientMessage);
								} else {
									throw new AppError(
										"Failed to send message",
										HttpStatusCodes.NOT_FOUND
									);
								}
							} else {
								// Create a new chat document in the database and then send the message to the recipients and senders topic through fcm to the recipient as a message request
								let attachment: AttachmentPayloadParams = {
									type: "highlight",
									highlightId: highlightId,
									memoryId: memoryId,
									caption: caption,
								};
								// Create the chat document in the database between client and user and then insert the message document for the chat in the database
								const messageId = await executeTransactionWithRetry(
									databaseClient,
									async (session) => {
										const messageId = await createOneToOneChat(
											clientAccountId,
											userAccountId,
											true,
											attachment,
											new Date(),
											session
										);
										await updateMemoryShares(memoryId, session);
										return messageId;
									}
								);
								let messageResponseData =
									await getChatMessageResponseData(
										messageId,
										clientAccountId
									);
								// If the messageResponseData exists and the data.type field is attachment, send the message to the client and user through fcm, else throw an error
								if (
									messageResponseData &&
									messageResponseData.data.type === "attachment"
								) {
									//  Send the message data and basic account information of the client as data message to the user
									let recipientMessage: FCMMessaging = {
										data: {
											messageData: JSON.stringify({
												id: messageResponseData.id,
												author: messageResponseData.author,
												sentAt: messageResponseData.sentAt,
												seenBy: messageResponseData.seenBy,
												reactions: messageResponseData.reactions,
												data: {
													type: "attachment",
													attachment:
														messageResponseData.data
															.attachment,
													caption:
														messageResponseData.data.caption,
												},
											} as MessageResponseParams),
											accounInfo: JSON.stringify({
												id: clientAccountInfo._id.toString(),
												userId: clientAccountInfo.userId,
												profilePictureUri:
													clientAccountInfo.profilePictureUri,
												name: clientAccountInfo.name,
											}),
										},
										notification: {
											title: clientAccountInfo.name,
											body: "Sent you a message request",
											imageUrl: clientAccountInfo.profilePictureUri,
										},
										android: {
											priority: MessagePriority.HIGH,
											ttl: 86400,
											notification: {
												eventTimestamp: new Date(),
												channelId:
													NotificationChannelId.DIRECT_MESSAGE,
												priority: NotificationPriority.HIGH,
												visibility:
													NotificationVisibility.PRIVATE,
												clickAction:
													NotificationAction.MESSAGE_REQUEST,
											},
										},
										topic: userAccountInfo.broadcastTopic,
									};
									// await sendMessageToTopic(recipientMessage);
									//  Send the message data and basic account information of the user as data message to the client
									let clientMessage: FCMMessaging = {
										data: {
											messageData: JSON.stringify({
												...messageResponseData,
											}),
											accounInfo: JSON.stringify({
												id: userAccountInfo._id.toString(),
												userId: userAccountInfo.userId,
												profilePictureUri:
													userAccountInfo.profilePictureUri,
												name: userAccountInfo.name,
											}),
										},
										topic: clientAccountInfo.broadcastTopic,
									};
									// await sendMessageToTopic(clientMessage);
								} else {
									throw new AppError(
										"Failed to send message",
										HttpStatusCodes.NOT_FOUND
									);
								}
							}
						} else {
							throw new AppError(
								"Failed to send message",
								HttpStatusCodes.FORBIDDEN
							);
						}
					}
				} else {
					throw new AppError(
						"Failed to send message",
						HttpStatusCodes.FORBIDDEN
					);
				}
			}
			// If either userAccountInfo or clientAccountInfo is NULL or if there exists a blocking relation between them then sending message will not be possible between them, throw an Error
			else {
				throw new AppError("Failed to send message", HttpStatusCodes.NOT_FOUND);
			}
		} else {
			throw new AppError("Failed to send message", HttpStatusCodes.NOT_FOUND);
		}
	} catch (error) {
		throw error;
	}
};

/** Function creates a chat document if it doesn't exists and inserts the file attachment message in the database
 * @name oneToOneChatFileAttachmentService
 * @param userAccountId - AccountId of the user to whom the message is to sent
 * @param clientAccountInfo - Basic information of the client from where the message is being sent
 * @param files - Files which is being sent as an attachment
 * @param caption - Caption of the message
 * @returns Promise<void>
 * */

export const oneToOneChatFileAttachmentService = async (
	userAccountId: string,
	clientAccountInfo: WithId<Account>,
	fileDataList: FileAttachmentInfo[],
	caption?: string
): Promise<void> => {
	try {
		// Fetch the recipient user's account details
		const userAccountInfo = await getAccountById(userAccountId);
		const clientAccountId = clientAccountInfo._id.toString();

		// Check if either user has blocked the other
		const accountBlockedInfo = await isAccountBlocked(userAccountId, clientAccountId);

		// Proceed only if user exists and there's no block relationship
		if (userAccountInfo && !accountBlockedInfo) {
			// Check if a one-to-one chat already exists between the two users
			const chatInfo = await isOneToOneChatAvailable(
				userAccountId,
				clientAccountId
			);

			if (chatInfo) {
				let isClientChatMember = false;
				let hasClientDeletedChat = false;
				let hasRecipientDeletedChat = false;

				// Iterate through participants to determine client membership and chat deletion status
				for (let participant of chatInfo.participants) {
					if (
						participant.accountId.toString() === clientAccountId &&
						participant.isMember === true
					) {
						isClientChatMember = true;
						hasClientDeletedChat = participant.isDeleted;
					}
					if (participant.accountId.toString() === userAccountId) {
						hasRecipientDeletedChat = participant.isDeleted;
					}
				}

				// If client is a valid chat member, proceed with sending attachment
				if (isClientChatMember) {
					// Prepare attachment object
					let fileAttachment = await fileAttachmentGenerator(fileDataList);
					let attachment: AttachmentPayloadParams = caption
						? { type: "file", file: fileAttachment, caption }
						: { type: "file", file: fileAttachment };

					// Upload attachment message as a transactional operation
					const messageId = await executeTransactionWithRetry(
						databaseClient,
						async (session) => {
							return await oneToOneChatAttachmentMessageUpload(
								clientAccountId,
								userAccountId,
								attachment,
								new Date(),
								session
							);
						}
					);

					// Retrieve full message info using inserted message ID
					let messageResponseData = await getChatMessageResponseData(
						messageId,
						clientAccountId
					);

					// Ensure the message type is valid and continue to FCM
					if (
						messageResponseData &&
						messageResponseData.data.type === "attachment"
					) {
						// Send FCM to recipient based on whether they deleted the chat
						if (!hasRecipientDeletedChat) {
							let recipientMessage: FCMMessaging = {
								data: {
									messageData: JSON.stringify({
										id: messageResponseData.id,
										author: messageResponseData.author,
										sentAt: messageResponseData.sentAt,
										seenBy: messageResponseData.seenBy,
										reactions: messageResponseData.reactions,
										data: {
											type: "attachment",
											attachment:
												messageResponseData.data.attachment,
											caption: messageResponseData.data.caption,
										},
									} as MessageResponseParams),
									accountId: clientAccountId,
								},
								notification: {
									title: clientAccountInfo.name,
									body: `Sent you an attachment`,
									imageUrl: clientAccountInfo.profilePictureUri,
								},
								android: {
									priority: MessagePriority.HIGH,
									ttl: 86400,
									notification: {
										eventTimestamp: new Date(),
										channelId: NotificationChannelId.DIRECT_MESSAGE,
										priority: NotificationPriority.HIGH,
										visibility: NotificationVisibility.PRIVATE,
										clickAction: NotificationAction.MESSAGE_INBOX,
									},
								},
								topic: userAccountInfo.broadcastTopic,
							};
							// await sendMessageToTopic(recipientMessage);
						} else {
							// If recipient deleted the chat, include sender’s info
							let recipientMessage: FCMMessaging = {
								data: {
									messageData: JSON.stringify({
										id: messageResponseData.id,
										author: messageResponseData.author,
										sentAt: messageResponseData.sentAt,
										seenBy: messageResponseData.seenBy,
										reactions: messageResponseData.reactions,
										data: {
											type: "attachment",
											attachment:
												messageResponseData.data.attachment,
											caption: messageResponseData.data.caption,
										},
									} as MessageResponseParams),
									accounInfo: JSON.stringify({
										id: clientAccountInfo._id.toString(),
										userId: clientAccountInfo.userId,
										profilePictureUri:
											clientAccountInfo.profilePictureUri,
										name: clientAccountInfo.name,
									}),
								},
								notification: {
									title: clientAccountInfo.name,
									body: `Sent you an attachment`,
									imageUrl: clientAccountInfo.profilePictureUri,
								},
								android: {
									priority: MessagePriority.HIGH,
									ttl: 86400,
									notification: {
										eventTimestamp: new Date(),
										channelId: NotificationChannelId.DIRECT_MESSAGE,
										priority: NotificationPriority.HIGH,
										visibility: NotificationVisibility.PRIVATE,
										clickAction: NotificationAction.MESSAGE_INBOX,
									},
								},
								topic: userAccountInfo.broadcastTopic,
							};
							// await sendMessageToTopic(recipientMessage);
						}

						// Send message back to sender, possibly with recipient's info
						if (!hasClientDeletedChat) {
							let clientMessage: FCMMessaging = {
								data: {
									messageData: JSON.stringify({
										...messageResponseData,
									}),
									accountId: userAccountId,
								},
								topic: clientAccountInfo.broadcastTopic,
							};
							// await sendMessageToTopic(clientMessage);
						} else {
							let clientMessage: FCMMessaging = {
								data: {
									messageData: JSON.stringify({
										...messageResponseData,
									}),
									accounInfo: JSON.stringify({
										id: userAccountInfo._id.toString(),
										userId: userAccountInfo.userId,
										profilePictureUri:
											userAccountInfo.profilePictureUri,
										name: userAccountInfo.name,
									}),
								},
								topic: clientAccountInfo.broadcastTopic,
							};
							// await sendMessageToTopic(clientMessage);
						}
					} else {
						throw new AppError(
							"Failed to send message",
							HttpStatusCodes.NOT_FOUND
						);
					}
				} else {
					throw new AppError(
						"Failed to send message",
						HttpStatusCodes.FORBIDDEN
					);
				}
			} else {
				// If no chat exists, check if sender is allowed to initiate based on follow status and privacy
				const [clientFollowingInfo, userFollowingInfo] = await Promise.all([
					isAccountFollower(userAccountId, clientAccountId),
					isAccountFollower(clientAccountId, userAccountId),
				]);

				if (
					(userAccountInfo.isPrivate && clientFollowingInfo) ||
					!userAccountInfo.isPrivate
				) {
					if (userFollowingInfo) {
						// Generate attachment and create a new chat
						let fileAttachment = await fileAttachmentGenerator(fileDataList);
						let attachment: AttachmentPayloadParams = caption
							? { type: "file", file: fileAttachment, caption }
							: { type: "file", file: fileAttachment };

						const messageId = await executeTransactionWithRetry(
							databaseClient,
							async (session) => {
								return await createOneToOneChat(
									clientAccountId,
									userAccountId,
									false,
									attachment,
									new Date(),
									session
								);
							}
						);

						let messageResponseData = await getChatMessageResponseData(
							messageId,
							clientAccountId
						);

						if (
							messageResponseData &&
							messageResponseData.data.type === "attachment"
						) {
							// Send FCM to recipient with sender info
							let recipientMessage: FCMMessaging = {
								data: {
									messageData: JSON.stringify({
										id: messageResponseData.id,
										author: messageResponseData.author,
										sentAt: messageResponseData.sentAt,
										seenBy: messageResponseData.seenBy,
										reactions: messageResponseData.reactions,
										data: {
											type: "attachment",
											attachment:
												messageResponseData.data.attachment,
											caption: messageResponseData.data.caption,
										},
									} as MessageResponseParams),
									accounInfo: JSON.stringify({
										id: clientAccountInfo._id.toString(),
										userId: clientAccountInfo.userId,
										profilePictureUri:
											clientAccountInfo.profilePictureUri,
										name: clientAccountInfo.name,
									}),
								},
								notification: {
									title: clientAccountInfo.name,
									body: `Sent you an attachment`,
									imageUrl: clientAccountInfo.profilePictureUri,
								},
								android: {
									priority: MessagePriority.HIGH,
									ttl: 86400,
									notification: {
										eventTimestamp: new Date(),
										channelId: NotificationChannelId.DIRECT_MESSAGE,
										priority: NotificationPriority.HIGH,
										visibility: NotificationVisibility.PRIVATE,
										clickAction: NotificationAction.MESSAGE_INBOX,
									},
								},
								topic: userAccountInfo.broadcastTopic,
							};
							// await sendMessageToTopic(recipientMessage);

							// Also send the same message back to sender with recipient info
							let clientMessage: FCMMessaging = {
								data: {
									messageData: JSON.stringify({
										...messageResponseData,
									}),
									accounInfo: JSON.stringify({
										id: userAccountInfo._id.toString(),
										userId: userAccountInfo.userId,
										profilePictureUri:
											userAccountInfo.profilePictureUri,
										name: userAccountInfo.name,
									}),
								},
								topic: clientAccountInfo.broadcastTopic,
							};
							// await sendMessageToTopic(clientMessage);
						} else {
							throw new AppError(
								"Failed to send message",
								HttpStatusCodes.NOT_FOUND
							);
						}
					} else {
						throw new AppError(
							"Failed to send message",
							HttpStatusCodes.FORBIDDEN
						);
					}
				} else {
					throw new AppError(
						"Failed to send message",
						HttpStatusCodes.FORBIDDEN
					);
				}
			}
		} else {
			// Blocked or nonexistent user
			throw new AppError("Failed to send message", HttpStatusCodes.FORBIDDEN);
		}
	} catch (error) {
		throw error;
	}
};
