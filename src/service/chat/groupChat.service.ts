import { ObjectId, WithId } from "mongodb";
import {
	FCMMessaging,
	MessagePriority,
	NotificationAction,
	NotificationChannelId,
	NotificationPriority,
	NotificationVisibility,
} from "../../fcm/messaging";
import { sendMessageToTopic } from "../../fcm/oneToOneMessage";
import { getAccountById, updateAccountShares } from "../../models/account.model";
import {
	addGroupChatParticipants,
	createGroupChat,
	groupChatAttachmentMessageUpload,
	groupChatBannerMessageUpload,
	groupChatTextMessageUpload,
} from "../../models/chat/groupChat.model";
import { Account } from "../../types/collection/account.type";
import { AccountResponseParams } from "../../types/response/account.type";
import { MessageResponseParams } from "../../types/response/chat.type";
import {
	AttachmentPayloadParams,
	FileAttachmentInfo,
	MessageReplyInfo,
} from "../../types/util.type";
import {
	executeTransactionWithRetry,
	getAccountAttachmentResponse,
	getClipPostResponse,
	getGroupChatById,
	getGroupChatMessageData,
	getGroupChatMessageResponseData,
	getHighlightResponse,
	getMemoryResponse,
	getMomentPostResponse,
	getMusicAudioAttachmentResponse,
	getOriginalAudioAttachmentResponse,
	getPhotoPostResponse,
	isAccountBlocked,
	isAccountFollower,
} from "../../utils/dbUtils";
import { fileAttachmentGenerator } from "../../utils/functions";
import { databaseClient } from "../../models/index.model";
import { updatePhotoPostShares } from "../../models/post/photo.model";
import { updateMomentPostShares } from "../../models/post/moment.model";
import { updateClipPostShares } from "../../models/post/clip.model";
import {
	updateMusicAudioShares,
	updateOriginalAudioShares,
} from "../../models/audio.model";
import { updateMemoryShares } from "../../models/memory/memory.model";
import { AppError } from "../../constants/appError";
import HttpStatusCodes from "../../constants/HttpStatusCodes";

/** Function inserts the text message in the database
 * @name groupChatTextUploadService
 * @param chatId - ChatId of the group where the message is being sent.
 * @param clientAccountInfo - Basic information of the client from where the message is being sent
 * @param content - Content of the message
 * @param repliedInfo: Information of the message that is being replied to
 * @returns Promise<void>
 * */

export const groupChatTextUploadService = async (
	chatId: string,
	clientAccountInfo: WithId<Account>,
	content: string,
	repliedInfo?: MessageReplyInfo
): Promise<void> => {
	try {
		// Check whether the group chat exists or not
		const clientAccountId = clientAccountInfo._id.toString();
		const chatInfo = await getGroupChatById(chatId, clientAccountId);
		// If group chat document exists, then continue with further checks.
		if (chatInfo) {
			let isMember = false;
			for (let participant of chatInfo.participants) {
				if (participant.accountId.toString() === clientAccountId) {
					isMember = participant.isMember;
				}
			}
			// If the client is in the participant list of the chat document and is an active member of the chat, then check whether the message is reply or not, else throw an error
			if (isMember) {
				// If the repliedInfo parameter exists, check whether the message that is being replied to exists for the client or not, else throw an error
				if (repliedInfo) {
					let replySourceChatMessageData = await getGroupChatMessageData(
						repliedInfo.messageId,
						clientAccountId
					);
					// If the replySourceChatMessageData exists then update the database and then send the message to the recipients and senders topic through fcm
					if (replySourceChatMessageData) {
						// oneToOneChatTextMessageUpload function creates the message object and then inserts it into the database and returns the id of the newly inserted message
						let messageId = await executeTransactionWithRetry(
							databaseClient,
							async (session) => {
								return await groupChatTextMessageUpload(
									content,
									clientAccountId,
									chatId,
									session,
									new Date(),
									repliedInfo,
									replySourceChatMessageData
								);
							}
						);

						// getGroupChatMessageResponseData function takes input this messageID and generates the response message which will be sent to the user and client through fcm as data message
						let messageResponseData = await getGroupChatMessageResponseData(
							messageId,
							clientAccountId
						);
						// If the messageResponseData exists and its data.type field is reply then send the message through fcm, else throw an error
						if (
							messageResponseData &&
							messageResponseData.data.type === "reply"
						) {
							// Send the message response to all the participants of the group, if the participant is a member they will receive a notification message, else the client and non member will receive a data message.
							for (let participant of chatInfo.participants) {
								if (
									participant.isMember &&
									participant.accountId.toString() !== clientAccountId
								) {
									const accountInfo = await getAccountById(
										participant.accountId.toString()
									);
									if (accountInfo) {
										let recipientMessage: FCMMessaging = {
											data: {
												messageData: JSON.stringify({
													...messageResponseData,
												}),
												chatId: chatId,
											},
											notification: {
												title: chatInfo.name,
												body: messageResponseData.data.content,
												imageUrl: chatInfo.displayPicture,
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
											topic: accountInfo.broadcastTopic,
										};
										// await sendMessageToTopic(recipientMessage);
									}
								} else {
									const accountInfo = await getAccountById(
										participant.accountId.toString()
									);
									if (accountInfo) {
										let recipientMessage: FCMMessaging = {
											data: {
												messageData: JSON.stringify({
													...messageResponseData,
												}),
												chatId: chatId,
											},
											android: {
												priority: MessagePriority.HIGH,
												ttl: 86400,
											},
											topic: accountInfo.broadcastTopic,
										};
										// await sendMessageToTopic(recipientMessage);
									}
								}
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
							return await groupChatTextMessageUpload(
								content,
								clientAccountId,
								chatId,
								session,
								new Date()
							);
						}
					);
					let messageResponseData = await getGroupChatMessageResponseData(
						messageId,
						clientAccountId
					);
					// If the messageResponseData exists and data.type field is text then send the message through fcm, else throw an error
					if (messageResponseData && messageResponseData.data.type === "text") {
						// Send the message response to all the participants of the group, if the participant is a member they will receive a notification message, else the client and non member or the client they will receive a data message.
						for (let participant of chatInfo.participants) {
							if (
								participant.isMember &&
								participant.accountId.toString() !== clientAccountId
							) {
								const accountInfo = await getAccountById(
									participant.accountId.toString()
								);
								if (accountInfo) {
									let recipientMessage: FCMMessaging = {
										data: {
											messageData: JSON.stringify({
												...messageResponseData,
											}),
											chatId: chatId,
										},
										notification: {
											title: chatInfo.name,
											body: messageResponseData.data.content,
											imageUrl: chatInfo.displayPicture,
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
										topic: accountInfo.broadcastTopic,
									};
									// await sendMessageToTopic(recipientMessage);
								}
							} else {
								const accountInfo = await getAccountById(
									participant.accountId.toString()
								);
								if (accountInfo) {
									let recipientMessage: FCMMessaging = {
										data: {
											messageData: JSON.stringify({
												...messageResponseData,
											}),
											chatId: chatId,
										},
										android: {
											priority: MessagePriority.HIGH,
											ttl: 86400,
										},
										topic: accountInfo.broadcastTopic,
									};
									// await sendMessageToTopic(recipientMessage);
								}
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
		}
		// If group chat document doesnot exists throw an Error
		else {
			throw new AppError("Invalid Chat Id", HttpStatusCodes.BAD_REQUEST);
		}
	} catch (error) {
		throw error;
	}
};

/** Function inserts the photo attachment message in the database
 * @name groupChatPhotoPostAttachmentService
 * @param chatId - ChatId of the group where the message is being sent.
 * @param clientAccountInfo - Basic information of the client from where the message is being sent
 * @param postId - Id of the post which is being sent as an attachment
 * @param caption - Caption of the message
 * @returns Promise<void>
 * */

export const groupChatPhotoPostAttachmentService = async (
	chatId: string,
	clientAccountInfo: WithId<Account>,
	postId: string,
	caption?: string
): Promise<void> => {
	try {
		// Check whether the group chat exists or not
		const clientAccountId = clientAccountInfo._id.toString();
		const chatInfo = await getGroupChatById(chatId, clientAccountId);
		// If group chat document exists and clientAccountInfo is not NULL, then continue with further checks
		if (chatInfo) {
			let isMember = false;
			for (let participant of chatInfo.participants) {
				if (participant.accountId.toString() === clientAccountId) {
					isMember = participant.isMember;
				}
			}
			// If the client is in the participant list of the chat document and is an active member of the chat, then check whether the message is reply or not, else throw an error
			if (isMember) {
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
						if (hasClientSendingPrivilege) {
							let attachment: AttachmentPayloadParams = {
								type: "photo",
								id: postId,
								caption: caption,
							};
							// Insert the message in the database, get the response message from the inserted messageId and send the message through fcm
							let messageId = await executeTransactionWithRetry(
								databaseClient,
								async (session) => {
									let messageId =
										await groupChatAttachmentMessageUpload(
											clientAccountId,
											chatId,
											attachment,
											new Date(),
											session
										);
									await updatePhotoPostShares(attachment.id, session);
									return messageId;
								}
							);
							let messageResponseData =
								await getGroupChatMessageResponseData(
									messageId,
									clientAccountId
								);
							// If the messageResponseData exists and data.type field is attachment then send the message through fcm, else throw an error
							if (
								messageResponseData &&
								messageResponseData.data.type === "attachment"
							) {
								// Send the message response to all the participants of the group, if the participant is a member they will receive a notification message, else the client and non member or the client they will receive a data message.
								for (let participant of chatInfo.participants) {
									if (
										participant.isMember &&
										participant.accountId.toString() !==
											clientAccountId
									) {
										const accountInfo = await getAccountById(
											participant.accountId.toString()
										);
										if (accountInfo) {
											// Check whether the participant has the privilege to receive the attachment based on any blocking relationship between the author and user or if the author is a private account and whether the participant follows the author or not
											const hasParticipantReceivingPrivilege =
												!(await isAccountBlocked(
													authorId,
													accountInfo._id.toString()
												)) &&
												((authorInfo.isPrivate &&
													(await isAccountFollower(
														authorId,
														accountInfo._id.toString()
													))) ||
													!authorInfo.isPrivate)
													? true
													: false;
											let recipientMessage: FCMMessaging = {
												data: {
													messageData: JSON.stringify({
														id: messageResponseData.id,
														author: messageResponseData.author,
														sentAt: messageResponseData.sentAt,
														seenBy: messageResponseData.seenBy,
														reactions:
															messageResponseData.reactions,
														data: {
															type: "attachment",
															attachment:
																hasParticipantReceivingPrivilege
																	? messageResponseData
																			.data
																			.attachment
																	: null,
															caption:
																messageResponseData.data
																	.caption,
														},
													} as MessageResponseParams),
													chatId: chatId,
												},
												notification: {
													title: chatInfo.name,
													body: `Sent you a photo of ${authorInfo.name}`,
													imageUrl: chatInfo.displayPicture,
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
														priority:
															NotificationPriority.HIGH,
														visibility:
															NotificationVisibility.PRIVATE,
														clickAction:
															NotificationAction.MESSAGE_INBOX,
													},
												},
												topic: accountInfo.broadcastTopic,
											};
											// await sendMessageToTopic(recipientMessage);
										}
									} else {
										const accountInfo = await getAccountById(
											participant.accountId.toString()
										);
										if (accountInfo) {
											// Check whether the participant has the privilege to receive the attachment based on any blocking relationship between the author and user or if the author is a private account and whether the participant follows the author or not
											const hasParticipantReceivingPrivilege =
												!(await isAccountBlocked(
													authorId,
													accountInfo._id.toString()
												)) &&
												((authorInfo.isPrivate &&
													(await isAccountFollower(
														authorId,
														accountInfo._id.toString()
													))) ||
													!authorInfo.isPrivate)
													? true
													: false;
											let recipientMessage: FCMMessaging = {
												data: {
													messageData: JSON.stringify({
														id: messageResponseData.id,
														author: messageResponseData.author,
														sentAt: messageResponseData.sentAt,
														seenBy: messageResponseData.seenBy,
														reactions:
															messageResponseData.reactions,
														data: {
															type: "attachment",
															attachment:
																hasParticipantReceivingPrivilege
																	? messageResponseData
																			.data
																			.attachment
																	: null,
															caption:
																messageResponseData.data
																	.caption,
														},
													} as MessageResponseParams),
													chatId: chatId,
												},
												android: {
													priority: MessagePriority.HIGH,
													ttl: 86400,
												},
												topic: accountInfo.broadcastTopic,
											};
											// await sendMessageToTopic(recipientMessage);
										}
									}
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
				throw new AppError("Failed to send message", HttpStatusCodes.FORBIDDEN);
			}
		}
		// If group chat document doesnot exists throw an Error
		else {
			throw new AppError("Invalid ChatId", HttpStatusCodes.BAD_REQUEST);
		}
	} catch (error) {
		throw error;
	}
};

/** Function inserts the moment attachment message in the database
 * @name groupChatMomentPostAttachmentService
 * @param chatId - ChatId of the group where the message is being sent.
 * @param clientAccountInfo - Basic information of the client from where the message is being sent
 * @param postId - Id of the post which is being sent as an attachment
 * @param caption - Caption of the message
 * @returns Promise<void>
 * */

export const groupChatMomentPostAttachmentService = async (
	chatId: string,
	clientAccountInfo: WithId<Account>,
	postId: string,
	caption?: string
): Promise<void> => {
	try {
		// Check whether the group chat exists or not
		const clientAccountId = clientAccountInfo._id.toString();
		const chatInfo = await getGroupChatById(chatId, clientAccountId);
		// If group chat document exists, then continue with further checks
		if (chatInfo) {
			let isMember = false;
			for (let participant of chatInfo.participants) {
				if (participant.accountId.toString() === clientAccountId) {
					isMember = participant.isMember;
				}
			}
			// If the client is in the participant list of the chat document and is an active member of the chat, then check whether the message is reply or not, else throw an error
			if (isMember) {
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
						if (hasClientSendingPrivilege) {
							let attachment: AttachmentPayloadParams = {
								type: "moment",
								id: postId,
								caption: caption,
							};
							// Insert the message in the database, get the response message from the inserted messageId and send the message through fcm
							let messageId = await executeTransactionWithRetry(
								databaseClient,
								async (session) => {
									let messageId =
										await groupChatAttachmentMessageUpload(
											clientAccountId,
											chatId,
											attachment,
											new Date(),
											session
										);
									await updateMomentPostShares(attachment.id, session);
									return messageId;
								}
							);
							let messageResponseData =
								await getGroupChatMessageResponseData(
									messageId,
									clientAccountId
								);
							// If the messageResponseData exists and data.type field is attachment then send the message through fcm, else throw an error
							if (
								messageResponseData &&
								messageResponseData.data.type === "attachment"
							) {
								// Send the message response to all the participants of the group, if the participant is a member they will receive a notification message, else the client and non member or the client they will receive a data message.
								for (let participant of chatInfo.participants) {
									if (
										participant.isMember &&
										participant.accountId.toString() !==
											clientAccountId
									) {
										const accountInfo = await getAccountById(
											participant.accountId.toString()
										);
										if (accountInfo) {
											// Check whether the participant has the privilege to receive the attachment based on any blocking relationship between the author and user or if the author is a private account and whether the participant follows the author or not
											const hasParticipantReceivingPrivilege =
												!(await isAccountBlocked(
													authorId,
													accountInfo._id.toString()
												)) &&
												((authorInfo.isPrivate &&
													(await isAccountFollower(
														authorId,
														accountInfo._id.toString()
													))) ||
													!authorInfo.isPrivate)
													? true
													: false;
											let recipientMessage: FCMMessaging = {
												data: {
													messageData: JSON.stringify({
														id: messageResponseData.id,
														author: messageResponseData.author,
														sentAt: messageResponseData.sentAt,
														seenBy: messageResponseData.seenBy,
														reactions:
															messageResponseData.reactions,
														data: {
															type: "attachment",
															attachment:
																hasParticipantReceivingPrivilege
																	? messageResponseData
																			.data
																			.attachment
																	: null,
															caption:
																messageResponseData.data
																	.caption,
														},
													} as MessageResponseParams),
													chatId: chatId,
												},
												notification: {
													title: chatInfo.name,
													body: `Sent a moment of ${authorInfo.name}`,
													imageUrl: chatInfo.displayPicture,
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
														priority:
															NotificationPriority.HIGH,
														visibility:
															NotificationVisibility.PRIVATE,
														clickAction:
															NotificationAction.MESSAGE_INBOX,
													},
												},
												topic: accountInfo.broadcastTopic,
											};
											// await sendMessageToTopic(recipientMessage);
										}
									} else {
										const accountInfo = await getAccountById(
											participant.accountId.toString()
										);
										if (accountInfo) {
											// Check whether the participant has the privilege to receive the attachment based on any blocking relationship between the author and user or if the author is a private account and whether the participant follows the author or not
											const hasParticipantReceivingPrivilege =
												!(await isAccountBlocked(
													authorId,
													accountInfo._id.toString()
												)) &&
												((authorInfo.isPrivate &&
													(await isAccountFollower(
														authorId,
														accountInfo._id.toString()
													))) ||
													!authorInfo.isPrivate)
													? true
													: false;
											let recipientMessage: FCMMessaging = {
												data: {
													messageData: JSON.stringify({
														id: messageResponseData.id,
														author: messageResponseData.author,
														sentAt: messageResponseData.sentAt,
														seenBy: messageResponseData.seenBy,
														reactions:
															messageResponseData.reactions,
														data: {
															type: "attachment",
															attachment:
																hasParticipantReceivingPrivilege
																	? messageResponseData
																			.data
																			.attachment
																	: null,
															caption:
																messageResponseData.data
																	.caption,
														},
													} as MessageResponseParams),
													chatId: chatId,
												},
												android: {
													priority: MessagePriority.HIGH,
													ttl: 86400,
												},
												topic: accountInfo.broadcastTopic,
											};
											// await sendMessageToTopic(recipientMessage);
										}
									}
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
				throw new AppError("Failed to send message", HttpStatusCodes.FORBIDDEN);
			}
		}
		// If group chat document doesnot exists throw an Error
		else {
			throw new AppError("Invalid Chat Id", HttpStatusCodes.BAD_REQUEST);
		}
	} catch (error) {
		throw error;
	}
};

/** Function inserts the clip attachment message in the database
 * @name groupChatClipPostAttachmentService
 * @param chatId - ChatId of the group where the message is being sent.
 * @param clientAccountInfo - Basic information of the client from where the message is being sent
 * @param postId - Id of the post which is being sent as an attachment
 * @param caption - Caption of the message
 * @returns Promise<void>
 * */

export const groupChatClipPostAttachmentService = async (
	chatId: string,
	clientAccountInfo: WithId<Account>,
	postId: string,
	caption?: string
): Promise<void> => {
	try {
		// Check whether the group chat exists or not
		const clientAccountId = clientAccountInfo._id.toString();
		const chatInfo = await getGroupChatById(chatId, clientAccountId);
		// If group chat document exists and clientAccountInfo is not NULL, then continue with further checks
		if (chatInfo) {
			let isMember = false;
			for (let participant of chatInfo.participants) {
				if (participant.accountId.toString() === clientAccountId) {
					isMember = participant.isMember;
				}
			}
			// If the client is in the participant list of the chat document and is an active member of the chat, then check whether the message is reply or not, else throw an error
			if (isMember) {
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
						if (hasClientSendingPrivilege) {
							let attachment: AttachmentPayloadParams = {
								type: "clip",
								id: postId,
								caption: caption,
							};
							// Insert the message in the database, get the response message from the inserted messageId and send the message through fcm
							let messageId = await executeTransactionWithRetry(
								databaseClient,
								async (session) => {
									let messageId =
										await groupChatAttachmentMessageUpload(
											clientAccountId,
											chatId,
											attachment,
											new Date(),
											session
										);
									await updateClipPostShares(attachment.id, session);
									return messageId;
								}
							);
							let messageResponseData =
								await getGroupChatMessageResponseData(
									messageId,
									clientAccountId
								);
							// If the messageResponseData exists and data.type field is attachment then send the message through fcm, else throw an error
							if (
								messageResponseData &&
								messageResponseData.data.type === "attachment"
							) {
								// Send the message response to all the participants of the group, if the participant is a member they will receive a notification message, else the client and non member or the client they will receive a data message.
								for (let participant of chatInfo.participants) {
									if (
										participant.isMember &&
										participant.accountId.toString() !==
											clientAccountId
									) {
										const accountInfo = await getAccountById(
											participant.accountId.toString()
										);
										if (accountInfo) {
											// Check whether the participant has the privilege to receive the attachment based on any blocking relationship between the author and user or if the author is a private account and whether the participant follows the author or not
											const hasParticipantReceivingPrivilege =
												!(await isAccountBlocked(
													authorId,
													accountInfo._id.toString()
												)) &&
												((authorInfo.isPrivate &&
													(await isAccountFollower(
														authorId,
														accountInfo._id.toString()
													))) ||
													!authorInfo.isPrivate)
													? true
													: false;
											let recipientMessage: FCMMessaging = {
												data: {
													messageData: JSON.stringify({
														id: messageResponseData.id,
														author: messageResponseData.author,
														sentAt: messageResponseData.sentAt,
														seenBy: messageResponseData.seenBy,
														reactions:
															messageResponseData.reactions,
														data: {
															type: "attachment",
															attachment:
																hasParticipantReceivingPrivilege
																	? messageResponseData
																			.data
																			.attachment
																	: null,
															caption:
																messageResponseData.data
																	.caption,
														},
													} as MessageResponseParams),
													chatId: chatId,
												},
												notification: {
													title: chatInfo.name,
													body: `Sent a clip of ${authorInfo.name}`,
													imageUrl: chatInfo.displayPicture,
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
														priority:
															NotificationPriority.HIGH,
														visibility:
															NotificationVisibility.PRIVATE,
														clickAction:
															NotificationAction.MESSAGE_INBOX,
													},
												},
												topic: accountInfo.broadcastTopic,
											};
											// await sendMessageToTopic(recipientMessage);
										}
									} else {
										const accountInfo = await getAccountById(
											participant.accountId.toString()
										);
										if (accountInfo) {
											// Check whether the participant has the privilege to receive the attachment based on any blocking relationship between the author and user or if the author is a private account and whether the participant follows the author or not
											const hasParticipantReceivingPrivilege =
												!(await isAccountBlocked(
													authorId,
													accountInfo._id.toString()
												)) &&
												((authorInfo.isPrivate &&
													(await isAccountFollower(
														authorId,
														accountInfo._id.toString()
													))) ||
													!authorInfo.isPrivate)
													? true
													: false;
											let recipientMessage: FCMMessaging = {
												data: {
													messageData: JSON.stringify({
														id: messageResponseData.id,
														author: messageResponseData.author,
														sentAt: messageResponseData.sentAt,
														seenBy: messageResponseData.seenBy,
														reactions:
															messageResponseData.reactions,
														data: {
															type: "attachment",
															attachment:
																hasParticipantReceivingPrivilege
																	? messageResponseData
																			.data
																			.attachment
																	: null,
															caption:
																messageResponseData.data
																	.caption,
														},
													} as MessageResponseParams),
													chatId: chatId,
												},
												android: {
													priority: MessagePriority.HIGH,
													ttl: 86400,
												},
												topic: accountInfo.broadcastTopic,
											};
											// await sendMessageToTopic(recipientMessage);
										}
									}
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
				throw new AppError("Failed to send message", HttpStatusCodes.FORBIDDEN);
			}
		}
		// If group chat document doesnot exists throw an Error
		else {
			throw new AppError("Invalid Chat Id", HttpStatusCodes.BAD_REQUEST);
		}
	} catch (error) {
		throw error;
	}
};

/** Function inserts the audio attachment message in the database
 * @name groupChatAudioAttachmentService
 * @param chatId - ChatId of the group where the message is being sent.
 * @param clientAccountInfo - Basic information of the client from where the message is being sent
 * @param audioId - Id of the audio which is being sent as an attachment
 * @param caption - Caption of the message
 * @returns Promise<void>
 * */

export const groupChatAudioAttachmentService = async (
	chatId: string,
	clientAccountInfo: WithId<Account>,
	type: "music" | "original",
	audioId: string,
	caption?: string
): Promise<void> => {
	try {
		// Check whether the group chat exists or not
		const clientAccountId = clientAccountInfo._id.toString();
		const chatInfo = await getGroupChatById(chatId, clientAccountId);
		// If group chat document exists and clientAccountInfo is not NULL, then continue with further checks
		if (chatInfo) {
			let isMember = false;
			for (let participant of chatInfo.participants) {
				if (participant.accountId.toString() === clientAccountId) {
					isMember = participant.isMember;
				}
			}
			// If the client is in the participant list of the chat document and is an active member of the chat, then check whether the message is reply or not, else throw an error
			if (isMember) {
				// Check whether the post exists or not, if not throw an error
				const audioInfo =
					type === "original"
						? await getOriginalAudioAttachmentResponse(
								audioId,
								clientAccountId
						  )
						: await getMusicAudioAttachmentResponse(audioId, clientAccountId);
				if (audioInfo) {
					// Check whether the client has the privilege to send the attachment based on any blocking relationship between the client and aurthor or if the author is a private account and whether the client follows the author or not
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
					if (hasClientSendingPrivilege) {
						let attachment: AttachmentPayloadParams = {
							type: "audio",
							id: audioId,
							audioType: type,
							caption: caption,
						};
						// Insert the message in the database, get the response message from the inserted messageId and send the message through fcm
						let messageId = await executeTransactionWithRetry(
							databaseClient,
							async (session) => {
								let messageId = await groupChatAttachmentMessageUpload(
									clientAccountId,
									chatId,
									attachment,
									new Date(),
									session
								);
								type === "music"
									? await updateMusicAudioShares(attachment.id, session)
									: await updateOriginalAudioShares(
											attachment.id,
											session
									  );
								return messageId;
							}
						);
						let messageResponseData = await getGroupChatMessageResponseData(
							messageId,
							clientAccountId
						);
						// If the messageResponseData exists and data.type field is attachment then send the message through fcm, else throw an error
						if (
							messageResponseData &&
							messageResponseData.data.type === "attachment"
						) {
							// Send the message response to all the participants of the group, if the participant is a member they will receive a notification message, else the client and non member or the client they will receive a data message.
							for (let participant of chatInfo.participants) {
								if (
									participant.isMember &&
									participant.accountId.toString() !== clientAccountId
								) {
									const accountInfo = await getAccountById(
										participant.accountId.toString()
									);
									if (accountInfo) {
										// Check whether the participant has the privilege to receive the attachment based on any blocking relationship between the author and user or if the author is a private account and whether the participant follows the author or not
										let hasParticipantReceivingPrivilege: boolean;
										if (audioInfo.associatedAccountInfo) {
											hasParticipantReceivingPrivilege =
												!(await isAccountBlocked(
													audioInfo.associatedAccountInfo.id,
													accountInfo._id.toString()
												)) &&
												((audioInfo.associatedAccountInfo
													.isPrivate &&
													(await isAccountFollower(
														audioInfo.associatedAccountInfo
															.id,
														accountInfo._id.toString()
													))) ||
													!audioInfo.associatedAccountInfo
														.isPrivate)
													? true
													: false;
										} else {
											hasParticipantReceivingPrivilege = true;
										}
										let recipientMessage: FCMMessaging = {
											data: {
												messageData: JSON.stringify({
													id: messageResponseData.id,
													author: messageResponseData.author,
													sentAt: messageResponseData.sentAt,
													seenBy: messageResponseData.seenBy,
													reactions:
														messageResponseData.reactions,
													data: {
														type: "attachment",
														attachment:
															hasParticipantReceivingPrivilege
																? messageResponseData.data
																		.attachment
																: null,
														caption:
															messageResponseData.data
																.caption,
													},
												} as MessageResponseParams),
												chatId: chatId,
											},
											notification: {
												title: chatInfo.name,
												body: `Sent you an audio`,
												imageUrl: chatInfo.displayPicture,
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
											topic: accountInfo.broadcastTopic,
										};
										// await sendMessageToTopic(recipientMessage);
									}
								} else {
									const accountInfo = await getAccountById(
										participant.accountId.toString()
									);
									if (accountInfo) {
										// Check whether the participant has the privilege to receive the attachment based on any blocking relationship between the author and user or if the author is a private account and whether the participant follows the author or not
										let hasParticipantReceivingPrivilege: boolean;
										if (audioInfo.associatedAccountInfo) {
											hasParticipantReceivingPrivilege =
												!(await isAccountBlocked(
													audioInfo.associatedAccountInfo.id,
													accountInfo._id.toString()
												)) &&
												((audioInfo.associatedAccountInfo
													.isPrivate &&
													(await isAccountFollower(
														audioInfo.associatedAccountInfo
															.id,
														accountInfo._id.toString()
													))) ||
													!audioInfo.associatedAccountInfo
														.isPrivate)
													? true
													: false;
										} else {
											hasParticipantReceivingPrivilege = true;
										}
										let recipientMessage: FCMMessaging = {
											data: {
												messageData: JSON.stringify({
													id: messageResponseData.id,
													author: messageResponseData.author,
													sentAt: messageResponseData.sentAt,
													seenBy: messageResponseData.seenBy,
													reactions:
														messageResponseData.reactions,
													data: {
														type: "attachment",
														attachment:
															hasParticipantReceivingPrivilege
																? messageResponseData.data
																		.attachment
																: null,
														caption:
															messageResponseData.data
																.caption,
													},
												} as MessageResponseParams),
												chatId: chatId,
											},
											android: {
												priority: MessagePriority.HIGH,
												ttl: 86400,
											},
											topic: accountInfo.broadcastTopic,
										};
										// await sendMessageToTopic(recipientMessage);
									}
								}
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
					throw new AppError(
						"Failed to send message",
						HttpStatusCodes.NOT_FOUND
					);
				}
			} else {
				throw new AppError("Failed to send message", HttpStatusCodes.FORBIDDEN);
			}
		}
		// If group chat document doesnot exists throw an Error
		else {
			throw new AppError("Invalid Chat Id", HttpStatusCodes.BAD_REQUEST);
		}
	} catch (error) {
		throw error;
	}
};

/** Function inserts the account attachment message in the database
 * @name groupChatAccountAttachmentService
 * @param chatId - ChatId of the group where the message is being sent.
 * @param clientAccountInfo - Basic information of the client from where the message is being sent
 * @param accountId - Id of the account which is being sent as an attachment
 * @param caption - Caption of the message
 * @returns Promise<void>
 * */

export const groupChatAccountAttachmentService = async (
	chatId: string,
	clientAccountInfo: WithId<Account>,
	accountId: string,
	caption?: string
): Promise<void> => {
	try {
		// Check whether the group chat exists or not
		const clientAccountId = clientAccountInfo._id.toString();
		const chatInfo = await getGroupChatById(chatId, clientAccountId);
		// If group chat document exists and clientAccountInfo is not NULL, then continue with further checks
		if (chatInfo) {
			let isMember = false;
			for (let participant of chatInfo.participants) {
				if (participant.accountId.toString() === clientAccountId) {
					isMember = participant.isMember;
				}
			}
			// If the client is in the participant list of the chat document and is an active member of the chat, then check whether the message is reply or not, else throw an error
			if (isMember) {
				// Check whether the post exists or not, if not throw an error
				const accountInfo = await getAccountAttachmentResponse(
					accountId,
					clientAccountId
				);
				if (accountInfo) {
					// Check whether the client has the privilege to send the attachment based on any blocking relationship between the client and aurthor or if the author is a private account and whether the client follows the author or not
					const hasClientSendingPrivilege = !(await isAccountBlocked(
						accountId,
						clientAccountId
					));
					if (hasClientSendingPrivilege) {
						let attachment: AttachmentPayloadParams = {
							type: "account",
							id: accountId,
							caption: caption,
						};
						// Insert the message in the database, get the response message from the inserted messageId and send the message through fcm
						let messageId = await executeTransactionWithRetry(
							databaseClient,
							async (session) => {
								let messageId = await groupChatAttachmentMessageUpload(
									clientAccountId,
									chatId,
									attachment,
									new Date(),
									session
								);
								await updateAccountShares(attachment.id, session);
								return messageId;
							}
						);
						let messageResponseData = await getGroupChatMessageResponseData(
							messageId,
							clientAccountId
						);
						// If the messageResponseData exists and data.type field is attachment then send the message through fcm, else throw an error
						if (
							messageResponseData &&
							messageResponseData.data.type === "attachment"
						) {
							// Send the message response to all the participants of the group, if the participant is a member they will receive a notification message, else the client and non member or the client they will receive a data message.
							for (let participant of chatInfo.participants) {
								if (
									participant.isMember &&
									participant.accountId.toString() !== clientAccountId
								) {
									const accountInfo = await getAccountById(
										participant.accountId.toString()
									);
									if (accountInfo) {
										// Check whether the participant has the privilege to receive the attachment based on any blocking relationship between the author and user or if the author is a private account and whether the participant follows the author or not
										const hasParticipantReceivingPrivilege =
											!(await isAccountBlocked(
												accountId,
												accountInfo._id.toString()
											));
										let recipientMessage: FCMMessaging = {
											data: {
												messageData: JSON.stringify({
													id: messageResponseData.id,
													author: messageResponseData.author,
													sentAt: messageResponseData.sentAt,
													seenBy: messageResponseData.seenBy,
													reactions:
														messageResponseData.reactions,
													data: {
														type: "attachment",
														attachment:
															hasParticipantReceivingPrivilege
																? messageResponseData.data
																		.attachment
																: null,
														caption:
															messageResponseData.data
																.caption,
													},
												} as MessageResponseParams),
												chatId: chatId,
											},
											notification: {
												title: chatInfo.name,
												body: `Sent you an account of ${accountInfo.name}`,
												imageUrl: chatInfo.displayPicture,
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
											topic: accountInfo.broadcastTopic,
										};
										// await sendMessageToTopic(recipientMessage);
									}
								} else {
									const accountInfo = await getAccountById(
										participant.accountId.toString()
									);
									if (accountInfo) {
										// Check whether the participant has the privilege to receive the attachment based on any blocking relationship between the author and user or if the author is a private account and whether the participant follows the author or not
										const hasParticipantReceivingPrivilege =
											!(await isAccountBlocked(
												accountId,
												accountInfo._id.toString()
											));
										let recipientMessage: FCMMessaging = {
											data: {
												messageData: JSON.stringify({
													id: messageResponseData.id,
													author: messageResponseData.author,
													sentAt: messageResponseData.sentAt,
													seenBy: messageResponseData.seenBy,
													reactions:
														messageResponseData.reactions,
													data: {
														type: "attachment",
														attachment:
															hasParticipantReceivingPrivilege
																? messageResponseData.data
																		.attachment
																: null,
														caption:
															messageResponseData.data
																.caption,
													},
												} as MessageResponseParams),
												chatId: chatId,
											},
											android: {
												priority: MessagePriority.HIGH,
												ttl: 86400,
											},
											topic: accountInfo.broadcastTopic,
										};
										// await sendMessageToTopic(recipientMessage);
									}
								}
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
					throw new AppError(
						"Failed to send message",
						HttpStatusCodes.NOT_FOUND
					);
				}
			} else {
				throw new AppError("Failed to send message", HttpStatusCodes.FORBIDDEN);
			}
		}
		// If group chat document doesnot exists throw an Error
		else {
			throw new AppError("Invalid Chat Id", HttpStatusCodes.BAD_REQUEST);
		}
	} catch (error) {
		throw error;
	}
};

/** Function inserts the memory attachment message in the database
 * @name groupChatMemoryAttachmentService
 * @param chatId - ChatId of the group where the message is being sent.
 * @param clientAccountInfo - Basic information of the client from where the message is being sent
 * @param memoryId - Id of the memory which is being sent as an attachment
 * @param caption - Caption of the message
 * @returns Promise<void>
 * */

export const groupChatMemoryAttachmentService = async (
	chatId: string,
	clientAccountInfo: WithId<Account>,
	memoryId: string,
	caption?: string
): Promise<void> => {
	try {
		// Check whether the group chat exists or not
		const clientAccountId = clientAccountInfo._id.toString();
		const chatInfo = await getGroupChatById(chatId, clientAccountId);
		// If group chat document exists and clientAccountInfo is not NULL, then continue with further checks
		if (chatInfo) {
			let isMember = false;
			for (let participant of chatInfo.participants) {
				if (participant.accountId.toString() === clientAccountId) {
					isMember = participant.isMember;
				}
			}
			// If the client is in the participant list of the chat document and is an active member of the chat, then check whether the message is reply or not, else throw an error
			if (isMember) {
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
							!memoryInfo.advancedOptions.disableSharing &&
							!(await isAccountBlocked(authorId, clientAccountId)) &&
							((authorInfo.isPrivate &&
								(await isAccountFollower(authorId, clientAccountId))) ||
								!authorInfo.isPrivate)
								? true
								: false;
						if (hasClientSendingPrivilege) {
							let attachment: AttachmentPayloadParams = {
								type: "memory",
								id: memoryId,
								caption: caption,
							};
							// Insert the message in the database, get the response message from the inserted messageId and send the message through fcm
							let messageId = await executeTransactionWithRetry(
								databaseClient,
								async (session) => {
									let messageId =
										await groupChatAttachmentMessageUpload(
											clientAccountId,
											chatId,
											attachment,
											new Date(),
											session
										);
									await updateMemoryShares(attachment.id, session);
									return messageId;
								}
							);
							let messageResponseData =
								await getGroupChatMessageResponseData(
									messageId,
									clientAccountId
								);
							// If the messageResponseData exists and data.type field is attachment then send the message through fcm, else throw an error
							if (
								messageResponseData &&
								messageResponseData.data.type === "attachment"
							) {
								// Send the message response to all the participants of the group, if the participant is a member they will receive a notification message, else the client and non member or the client they will receive a data message.
								for (let participant of chatInfo.participants) {
									if (
										participant.isMember &&
										participant.accountId.toString() !==
											clientAccountId
									) {
										const accountInfo = await getAccountById(
											participant.accountId.toString()
										);
										if (accountInfo) {
											// Check whether the participant has the privilege to receive the attachment based on any blocking relationship between the author and user or if the author is a private account and whether the participant follows the author or not
											const hasParticipantReceivingPrivilege =
												!(await isAccountBlocked(
													authorId,
													accountInfo._id.toString()
												)) &&
												((authorInfo.isPrivate &&
													(await isAccountFollower(
														authorId,
														accountInfo._id.toString()
													))) ||
													!authorInfo.isPrivate)
													? true
													: false;
											let recipientMessage: FCMMessaging = {
												data: {
													messageData: JSON.stringify({
														id: messageResponseData.id,
														author: messageResponseData.author,
														sentAt: messageResponseData.sentAt,
														seenBy: messageResponseData.seenBy,
														reactions:
															messageResponseData.reactions,
														data: {
															type: "attachment",
															attachment:
																hasParticipantReceivingPrivilege
																	? messageResponseData
																			.data
																			.attachment
																	: null,
															caption:
																messageResponseData.data
																	.caption,
														},
													} as MessageResponseParams),
													chatId: chatId,
												},
												notification: {
													title: chatInfo.name,
													body: `Sent you a memory of ${authorInfo.name}`,
													imageUrl: chatInfo.displayPicture,
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
														priority:
															NotificationPriority.HIGH,
														visibility:
															NotificationVisibility.PRIVATE,
														clickAction:
															NotificationAction.MESSAGE_INBOX,
													},
												},
												topic: accountInfo.broadcastTopic,
											};
											// await sendMessageToTopic(recipientMessage);
										}
									} else {
										const accountInfo = await getAccountById(
											participant.accountId.toString()
										);
										if (accountInfo) {
											// Check whether the participant has the privilege to receive the attachment based on any blocking relationship between the author and user or if the author is a private account and whether the participant follows the author or not
											const hasParticipantReceivingPrivilege =
												!(await isAccountBlocked(
													authorId,
													accountInfo._id.toString()
												)) &&
												((authorInfo.isPrivate &&
													(await isAccountFollower(
														authorId,
														accountInfo._id.toString()
													))) ||
													!authorInfo.isPrivate)
													? true
													: false;
											let recipientMessage: FCMMessaging = {
												data: {
													messageData: JSON.stringify({
														id: messageResponseData.id,
														author: messageResponseData.author,
														sentAt: messageResponseData.sentAt,
														seenBy: messageResponseData.seenBy,
														reactions:
															messageResponseData.reactions,
														data: {
															type: "attachment",
															attachment:
																hasParticipantReceivingPrivilege
																	? messageResponseData
																			.data
																			.attachment
																	: null,
															caption:
																messageResponseData.data
																	.caption,
														},
													} as MessageResponseParams),
													chatId: chatId,
												},
												android: {
													priority: MessagePriority.HIGH,
													ttl: 86400,
												},
												topic: accountInfo.broadcastTopic,
											};
											// await sendMessageToTopic(recipientMessage);
										}
									}
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
				throw new AppError("Failed to send message", HttpStatusCodes.FORBIDDEN);
			}
		}
		// If group chat document doesnot exists throw an Error
		else {
			throw new AppError("Invalid Chat Id", HttpStatusCodes.BAD_REQUEST);
		}
	} catch (error) {
		throw error;
	}
};

/** Function inserts the highlight attachment message in the database
 * @name groupChatHighlightAttachmentService
 * @param chatId - ChatId of the group where the message is being sent.
 * @param clientAccountInfo - Basic information of the client from where the message is being sent
 * @param highlightId - Id of the highlight which is being sent as an attachment
 * @param memoryId - Id of the memory which is being sent as an attachment
 * @param caption - Caption of the message
 * @returns Promise<void>
 * */

export const groupChatHighlightAttachmentService = async (
	chatId: string,
	clientAccountInfo: WithId<Account>,
	highlightId: string,
	memoryId: string,
	caption?: string
): Promise<void> => {
	try {
		// Check whether the group chat exists or not
		const clientAccountId = clientAccountInfo._id.toString();
		const chatInfo = await getGroupChatById(chatId, clientAccountId);
		// If group chat document exists and clientAccountInfo is not NULL, then continue with further checks
		if (chatInfo) {
			let isMember = false;
			for (let participant of chatInfo.participants) {
				if (participant.accountId.toString() === clientAccountId) {
					isMember = participant.isMember;
				}
			}
			// If the client is in the participant list of the chat document and is an active member of the chat, then check whether the message is reply or not, else throw an error
			if (isMember) {
				// Check whether the post exists or not, if not throw an error
				const highlightInfo = await getHighlightResponse(
					memoryId,
					highlightId,
					clientAccountId
				);
				if (highlightInfo) {
					// Check whether the author of the highlight memory is available or not
					const authorInfo = await getAccountById(
						highlightInfo.memoryInfo.author.id
					);
					// If the authorInfo is not NULL then contiue with further checks
					if (authorInfo) {
						const authorId = authorInfo._id.toString();
						// Check whether the client has the privilege to send the attachment based on any blocking relationship between the client and aurthor or if the author is a private account and whether the client follows the author or not
						const hasClientSendingPrivilege =
							!highlightInfo.memoryInfo.advancedOptions.disableSharing &&
							!(await isAccountBlocked(authorId, clientAccountId)) &&
							((authorInfo.isPrivate &&
								(await isAccountFollower(authorId, clientAccountId))) ||
								!authorInfo.isPrivate)
								? true
								: false;
						if (hasClientSendingPrivilege) {
							let attachment: AttachmentPayloadParams = {
								type: "highlight",
								highlightId: highlightId,
								memoryId: memoryId,
								caption: caption,
							};
							// Insert the message in the database, get the response message from the inserted messageId and send the message through fcm
							let messageId = await executeTransactionWithRetry(
								databaseClient,
								async (session) => {
									let messageId =
										await groupChatAttachmentMessageUpload(
											clientAccountId,
											chatId,
											attachment,
											new Date(),
											session
										);
									await updateMemoryShares(
										attachment.memoryId,
										session
									);
									return messageId;
								}
							);
							let messageResponseData =
								await getGroupChatMessageResponseData(
									messageId,
									clientAccountId
								);
							// If the messageResponseData exists and data.type field is attachment then send the message through fcm, else throw an error
							if (
								messageResponseData &&
								messageResponseData.data.type === "attachment"
							) {
								// Send the message response to all the participants of the group, if the participant is a member they will receive a notification message, else the client and non member or the client they will receive a data message.
								for (let participant of chatInfo.participants) {
									if (
										participant.isMember &&
										participant.accountId.toString() !==
											clientAccountId
									) {
										const accountInfo = await getAccountById(
											participant.accountId.toString()
										);
										if (accountInfo) {
											// Check whether the participant has the privilege to receive the attachment based on any blocking relationship between the author and user or if the author is a private account and whether the participant follows the author or not
											const hasParticipantReceivingPrivilege =
												!(await isAccountBlocked(
													authorId,
													accountInfo._id.toString()
												)) &&
												((authorInfo.isPrivate &&
													(await isAccountFollower(
														authorId,
														accountInfo._id.toString()
													))) ||
													!authorInfo.isPrivate)
													? true
													: false;
											let recipientMessage: FCMMessaging = {
												data: {
													messageData: JSON.stringify({
														id: messageResponseData.id,
														author: messageResponseData.author,
														sentAt: messageResponseData.sentAt,
														seenBy: messageResponseData.seenBy,
														reactions:
															messageResponseData.reactions,
														data: {
															type: "attachment",
															attachment:
																hasParticipantReceivingPrivilege
																	? messageResponseData
																			.data
																			.attachment
																	: null,
															caption:
																messageResponseData.data
																	.caption,
														},
													} as MessageResponseParams),
													chatId: chatId,
												},
												notification: {
													title: chatInfo.name,
													body: `Sent you a highlight of ${authorInfo.name}`,
													imageUrl: chatInfo.displayPicture,
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
														priority:
															NotificationPriority.HIGH,
														visibility:
															NotificationVisibility.PRIVATE,
														clickAction:
															NotificationAction.MESSAGE_INBOX,
													},
												},
												topic: accountInfo.broadcastTopic,
											};
											// await sendMessageToTopic(recipientMessage);
										}
									} else {
										const accountInfo = await getAccountById(
											participant.accountId.toString()
										);
										if (accountInfo) {
											// Check whether the participant has the privilege to receive the attachment based on any blocking relationship between the author and user or if the author is a private account and whether the participant follows the author or not
											const hasParticipantReceivingPrivilege =
												!(await isAccountBlocked(
													authorId,
													accountInfo._id.toString()
												)) &&
												((authorInfo.isPrivate &&
													(await isAccountFollower(
														authorId,
														accountInfo._id.toString()
													))) ||
													!authorInfo.isPrivate)
													? true
													: false;
											let recipientMessage: FCMMessaging = {
												data: {
													messageData: JSON.stringify({
														id: messageResponseData.id,
														author: messageResponseData.author,
														sentAt: messageResponseData.sentAt,
														seenBy: messageResponseData.seenBy,
														reactions:
															messageResponseData.reactions,
														data: {
															type: "attachment",
															attachment:
																hasParticipantReceivingPrivilege
																	? messageResponseData
																			.data
																			.attachment
																	: null,
															caption:
																messageResponseData.data
																	.caption,
														},
													} as MessageResponseParams),
													chatId: chatId,
												},
												android: {
													priority: MessagePriority.HIGH,
													ttl: 86400,
												},
												topic: accountInfo.broadcastTopic,
											};
											// await sendMessageToTopic(recipientMessage);
										}
									}
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
				throw new AppError("Failed to send message", HttpStatusCodes.FORBIDDEN);
			}
		}
		// If group chat document doesnot exists throw an Error
		else {
			throw new AppError("Invalid Chat Id", HttpStatusCodes.BAD_REQUEST);
		}
	} catch (error) {
		throw error;
	}
};

/** Function inserts the file attachment message in the database
 * @name groupChatFileAttachmentService
 * @param chatId - ChatId of the group where the message is being sent.
 * @param clientAccountInfo - Basic information of the client from where the message is being sent
 * @param files - Files which is being sent as an attachment
 * @param caption - Caption of the message
 * @returns Promise<void>
 * */

export const groupChatFileAttachmentService = async (
	chatId: string,
	clientAccountInfo: WithId<Account>,
	files: FileAttachmentInfo[],
	caption?: string
): Promise<void> => {
	try {
		// Get the client account ID as a string for easy comparison
		const clientAccountId = clientAccountInfo._id.toString();

		// Fetch the group chat information using the chatId and clientAccountId
		const chatInfo = await getGroupChatById(chatId, clientAccountId);

		// If the group chat exists, proceed with the next steps
		if (chatInfo) {
			// Check if the client is an active member of the group chat
			const isMember = chatInfo.participants.some(
				(member) =>
					member.accountId.toString() === clientAccountId && member.isMember
			);

			// If the client is a valid member of the group, proceed with file attachment handling
			if (isMember) {
				// Generate file attachments from the provided files (using Multer file objects)
				const fileAttachment = await fileAttachmentGenerator(files);

				// Prepare the attachment object with its type, file details, and caption (if any)
				let attachment: AttachmentPayloadParams = {
					type: "file",
					file: fileAttachment,
					caption: caption,
				};

				// Insert the attachment message into the database, and retrieve the inserted messageId
				let messageId = await executeTransactionWithRetry(
					databaseClient,
					async (session) => {
						// Upload the message with the attachment
						let messageId = await groupChatAttachmentMessageUpload(
							clientAccountId,
							chatId,
							attachment,
							new Date(),
							session
						);
						// Return the messageId after insertion
						return messageId;
					}
				);

				// Fetch message response data to validate and extract message information
				let messageResponseData = await getGroupChatMessageResponseData(
					messageId,
					clientAccountId
				);

				// If messageResponseData exists and contains an attachment, proceed to send notifications
				if (
					messageResponseData &&
					messageResponseData.data.type === "attachment"
				) {
					// Loop through all participants of the chat and send notifications based on membership status
					for (let participant of chatInfo.participants) {
						// If the participant is a member and not the sender, send them a notification message
						if (
							participant.isMember &&
							participant.accountId.toString() !== clientAccountId
						) {
							const accountInfo = await getAccountById(
								participant.accountId.toString()
							);
							if (accountInfo) {
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
										chatId: chatId,
									},
									notification: {
										title: chatInfo.name,
										body: `Sent you an attachment`, // The body of the notification
										imageUrl: chatInfo.displayPicture, // Display chat image as part of notification
									},
									android: {
										priority: MessagePriority.HIGH,
										ttl: 86400, // Notification is valid for 1 day (86400 seconds)
										notification: {
											eventTimestamp: new Date(
												messageResponseData.sentAt
											),
											channelId:
												NotificationChannelId.DIRECT_MESSAGE, // Channel for direct message notifications
											priority: NotificationPriority.HIGH,
											visibility: NotificationVisibility.PRIVATE, // Notification is private
											clickAction: NotificationAction.MESSAGE_INBOX, // Action when clicked
										},
									},
									topic: accountInfo.broadcastTopic, // Send the notification to the participant's topic
								};
								// Send the notification to the participant via FCM (Firebase Cloud Messaging)
								// await sendMessageToTopic(recipientMessage);
							}
						} else {
							// If the participant is not a member, send a data-only message instead
							const accountInfo = await getAccountById(
								participant.accountId.toString()
							);
							if (accountInfo) {
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
										chatId: chatId,
									},
									android: {
										priority: MessagePriority.HIGH,
										ttl: 86400, // Notification is valid for 1 day (86400 seconds)
									},
									topic: accountInfo.broadcastTopic, // Send to the participant's topic
								};
								// Send the data message to the non-member participant via FCM
								// await sendMessageToTopic(recipientMessage);
							}
						}
					}
				} else {
					// If the message upload failed or did not contain an attachment, throw an error
					throw new AppError(
						"Failed to send message",
						HttpStatusCodes.NOT_FOUND
					);
				}
			} else {
				// If the client is not a member of the group chat, throw an error
				throw new AppError("Failed to send message", HttpStatusCodes.FORBIDDEN);
			}
		}
		// If the group chat does not exist, throw an error
		else {
			throw new AppError("Invalid Chat Id", HttpStatusCodes.BAD_REQUEST);
		}
	} catch (error) {
		// Propagate errors up the call stack for centralized error handling
		throw error;
	}
};

/** Function creates a group chat
 * @name groupChatCreateService
 * @param clientAccountInfo - Basic information of the client from where the message is being sent
 * @param participantsIdList - Account id's of the participants who are invited to the group
 * @param name - Name of the group
 * @param displayPicture - Display picture of the group, can be undefined
 * @returns Promise<void>
 * */

export const createGroupChatService = async (
	clientAccountInfo: WithId<Account>,
	participantsIdList: string[], // List of participants' IDs
	name: string, // Group chat name
	displayPicture?: string // Optional display picture for the group
): Promise<void> => {
	try {
		// Get the client account ID as a string for easy comparison later
		const clientAccountId = clientAccountInfo._id.toString();

		// Check if the group has between 2 and 20 members (inclusive) - minimum 3 participants (client + 2 others)
		if (participantsIdList.length > 1 && participantsIdList.length <= 20) {
			// Start a transaction to create the group chat and add initial messages
			const chatId = await executeTransactionWithRetry(
				databaseClient,
				async (session) => {
					const currentTime = new Date();

					// Create the group chat in the database
					let chatId = await createGroupChat(
						clientAccountId,
						name,
						participantsIdList,
						currentTime,
						session,
						displayPicture
					);

					// Upload a group creation message (banner message)
					await groupChatBannerMessageUpload(
						clientAccountId,
						chatId.toString(),
						{
							type: "groupCreate", // Type is 'groupCreate' to mark it as a group creation message
							accountId: new ObjectId(clientAccountId),
						},
						currentTime,
						session
					);

					// Optionally, could upload 'groupMemberAdd' messages for each participant (currently commented out)
					// for (const participant of participantsIdList) {
					// 	if (participant !== clientAccountId) {
					// 		await groupChatBannerMessageUpload(
					// 			clientAccountId,
					// 			chatId.toString(),
					// 			{
					// 				type: "groupMemberAdd",
					// 				accountId: new ObjectId(participant),
					// 				invitedById: new ObjectId(clientAccountId),
					// 			},
					// 			currentTime,
					// 			session
					// 		);
					// 	}
					// }
					// Return the chat ID once the group chat has been created successfully
					return chatId;
				}
			);

			// Fetch the created group chat details from the database to confirm successful creation
			const chatInfo = await getGroupChatById(chatId, clientAccountId);
			if (!chatInfo) {
				// If chat info is not found, throw an error
				throw new AppError("Failed to create group", HttpStatusCodes.NOT_FOUND);
			}

			// List to hold account information of all participants
			const participantAccountInfoList: WithId<Account>[] = [];

			// Loop through participants and fetch their account info to include in the response
			for (let participant of chatInfo.participants) {
				const accountInfo = await getAccountById(
					participant.accountId.toString()
				);
				if (accountInfo) {
					// Add valid account info to the list
					participantAccountInfoList.push(accountInfo);
				}
			}

			// Loop through participants again to send a notification about the group creation
			for (let participant of chatInfo.participants) {
				if (participant.accountId.toString() !== clientAccountId) {
					// If participant is not the client, send a notification about being added to the group
					const accountInfo = await getAccountById(
						participant.accountId.toString()
					);
					if (accountInfo) {
						let recipientMessage: FCMMessaging = {
							data: {
								// Include group chat info in the notification data
								chatInfo: JSON.stringify({
									chatId: chatId,
									name: name,
									displayPicture: displayPicture,
									participants: participantAccountInfoList,
								}),
							},
							notification: {
								// Notification title and body differ based on the participant's membership status
								title: chatInfo.name,
								body: participant.isMember
									? `Added you to a group`
									: `Invited you to a group`,
								imageUrl: chatInfo.displayPicture,
							},
							android: {
								priority: MessagePriority.HIGH, // High priority for the notification
								ttl: 86400, // Time-to-live of 1 day (86400 seconds)
								notification: {
									eventTimestamp: new Date(),
									channelId: NotificationChannelId.DIRECT_MESSAGE, // Notification channel for direct messages
									priority: NotificationPriority.HIGH,
									visibility: NotificationVisibility.PRIVATE, // Ensure the message is private
									clickAction: participant.isMember
										? NotificationAction.MESSAGE_INBOX
										: NotificationAction.MESSAGE_REQUEST, // Action depends on whether the user is a member or invited
								},
							},
							topic: accountInfo.broadcastTopic, // Send notification to the participant's broadcast topic
						};
						// Send the message via Firebase Cloud Messaging (FCM)
						// await sendMessageToTopic(recipientMessage);
					}
				} else {
					// If the participant is the client, send a simpler notification without 'body' text
					const accountInfo = await getAccountById(
						participant.accountId.toString()
					);
					if (accountInfo) {
						let recipientMessage: FCMMessaging = {
							data: {
								// Send chat info to the client as well
								chatInfo: JSON.stringify({
									chatId: chatId,
									name: name,
									displayPicture: displayPicture,
									participants: participantAccountInfoList,
								}),
							},
							android: {
								priority: MessagePriority.HIGH, // High priority for notifications
								ttl: 86400, // TTL of 1 day (86400 seconds)
							},
							topic: accountInfo.broadcastTopic, // Send to client's broadcast topic
						};
						// Send the message via Firebase Cloud Messaging (FCM)
						// await sendMessageToTopic(recipientMessage);
					}
				}
			}
		} else {
			// If the number of participants is not valid (less than 2 or greater than 20), throw an error
			throw new AppError("Failed to create group", HttpStatusCodes.BAD_REQUEST);
		}
	} catch (error) {
		// Catch and log any error, then propagate it upwards
		console.error(error);
		throw error;
	}
};

/** Function adds new accounts as participants of a group chat
 * @name groupChatInviteService
 * @param clientAccountInfo - Basic information of the client from where the message is being sent
 * @param participantsIdList - Account id's of the participants who are invited to the group
 * @param chatId - Id of the group
 * @returns Promise<void>
 * */

export const groupChatInviteService = async (
	clientAccountInfo: WithId<Account>, // The client initiating the invite
	participantsIdList: string[], // List of participants to be invited
	chatId: string // The group chat ID where the participants will be added
): Promise<void> => {
	try {
		// Get the client account ID as a string
		const clientAccountId = clientAccountInfo._id.toString();

		// Fetch the group chat info from the database
		const chatInfo = await getGroupChatById(chatId, clientAccountId);

		// Check if the group chat exists
		if (chatInfo) {
			let isMember = false;
			let isAdmin = false;

			// Loop through the participants to check if the client is a member and admin
			for (const participant of chatInfo.participants) {
				if (participant.accountId.toString() === clientAccountId) {
					isMember = participant.isMember; // Set membership status
					isAdmin = participant.isAdmin; // Set admin status
				}
			}

			// If the client is not a member or not an admin, they cannot invite others
			if (!isMember || !isAdmin) {
				throw new AppError("Failed to add", HttpStatusCodes.FORBIDDEN);
			}

			// Check if adding the new participants would exceed the 20-participant limit
			if (chatInfo.participants.length + participantsIdList.length > 20) {
				throw new AppError("Group is full", HttpStatusCodes.FORBIDDEN);
			}

			// Prepare a list of participant account info for later notification
			const participantAccountInfoList: WithId<Account>[] = [];
			for (let participant of chatInfo.participants) {
				let accountInfo = await getAccountById(participant.accountId.toString());
				if (accountInfo) {
					participantAccountInfoList.push(accountInfo); // Add valid account info to the list
				}
			}

			// Start a transaction to add the participants and upload the corresponding messages
			const groupChatId = await executeTransactionWithRetry(
				databaseClient,
				async (session) => {
					// Add new participants to the group chat
					let updatedChatInfo = await addGroupChatParticipants(
						clientAccountId,
						chatInfo,
						participantsIdList,
						new Date(), // Use the current date for timestamp
						session
					);

					// Upload banner message for each added participant
					for (const participant of updatedChatInfo.participants) {
						if (participant.accountId.toString() !== clientAccountId) {
							await groupChatBannerMessageUpload(
								clientAccountId,
								chatInfo._id.toString(),
								{
									type: "groupMemberAdd", // Set message type to 'groupMemberAdd'
									accountId: participant.accountId,
									invitedById: new ObjectId(clientAccountId), // The client is inviting the participant
								},
								new Date(), // Timestamp for the message
								session
							);
						}
					}

					// Return the updated group chat ID
					return updatedChatInfo._id.toString();
				}
			);

			// Fetch the updated group chat info after the transaction
			const updatedChatInfo = await getGroupChatById(groupChatId, clientAccountId);
			if (!updatedChatInfo) {
				// If the updated group chat info is not found, throw an error
				throw new AppError("Failed to add", HttpStatusCodes.NOT_FOUND);
			}

			// Loop through the updated participants and send notifications to those who were added
			for (let participant of updatedChatInfo.participants) {
				// Check if the participant is in the invite list
				if (participant.accountId.toString() in participantsIdList) {
					const accountInfo = await getAccountById(
						participant.accountId.toString()
					);
					if (accountInfo) {
						let recipientMessage: FCMMessaging = {
							data: {
								// Include group chat info in the notification data
								chatInfo: JSON.stringify({
									chatId: chatId,
									name: updatedChatInfo.name,
									displayPicture: updatedChatInfo.displayPicture,
									participants: participantAccountInfoList,
								}),
							},
							notification: {
								// Set title and body based on whether the participant is already a member
								title: updatedChatInfo.name,
								body: participant.isMember
									? "Added you to a group"
									: "Invited you to a group",
								imageUrl: chatInfo.displayPicture,
							},
							android: {
								priority: MessagePriority.HIGH, // High priority for the notification
								ttl: 86400, // Time-to-live of 1 day (86400 seconds)
								notification: {
									eventTimestamp: new Date(),
									channelId: NotificationChannelId.DIRECT_MESSAGE, // Direct message notification channel
									priority: NotificationPriority.HIGH,
									visibility: NotificationVisibility.PRIVATE, // Keep the notification private
									clickAction: participant.isMember
										? NotificationAction.MESSAGE_INBOX // If a member, direct to inbox
										: NotificationAction.MESSAGE_REQUEST, // If invited, direct to request
								},
							},
							topic: accountInfo.broadcastTopic, // Send notification to the participant's broadcast topic
						};
						// Send the notification via Firebase Cloud Messaging (FCM)
						// await sendMessageToTopic(recipientMessage);
					}
				}
			}
		} else {
			// If the group chat does not exist, throw an error
			throw new AppError("Invalid Chat Id", HttpStatusCodes.BAD_REQUEST);
		}
	} catch (error) {
		// Catch and propagate any errors that occur during the process
		throw error;
	}
};
