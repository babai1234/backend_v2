import { ClientSession, ObjectId, WithId } from "mongodb";
import { getKeywords } from "../../utils/functions";
import { ChatMessage, OneToOneChat } from "../../types/collection/chat.type";
import {
	AttachmentPayloadParams,
	MessageReplyInfo,
	PayloadParams,
	TextPayloadParams,
} from "../../types/util.type";
import { oneToOneChatCollection, oneToOneMessageCollection } from "../index.model";

/**
 * Uploads a text message in a one-to-one chat.
 *
 * This function handles uploading a text message in a one-to-one chat. It can optionally handle replies to
 * previous messages, either text or attachments. The message data, including content and keywords, is stored
 * in the database. The function returns the ID of the inserted message.
 *
 * @param {string} content - The text content of the message.
 * @param {string} clientAccountId - The ID of the client (user) who is sending the message.
 * @param {string} userAccountId - The ID of the recipient user.
 * @param {Date} currentTime - The current timestamp when the message is sent.
 * @param {ClientSession} session - The session object for performing the database operation within a transaction.
 * @param {MessageReplyInfo} [repliedInfo] - The information about the message being replied to, if applicable.
 * @param {WithId<ChatMessage>} [replySourceChatMessageData] - The source message data being replied to, if applicable.
 *
 * @returns {Promise<string>} - A promise that resolves to the ID of the inserted message.
 *
 * @throws {Error} - Throws an error if any issue occurs during the database operation.
 */
export async function oneToOneChatTextMessageUpload(
	content: string,
	clientAccountId: string,
	userAccountId: string,
	currentTime: Date,
	session: ClientSession,
	repliedInfo?: MessageReplyInfo,
	replySourceChatMessageData?: WithId<ChatMessage>
): Promise<string> {
	// Extract keywords from the content for search purposes or categorization
	let keywords = getKeywords(content);

	// Declare the message info object that will hold the message data
	let messageInfo: ChatMessage;

	try {
		// Handle the case where the message is a reply
		if (repliedInfo && replySourceChatMessageData) {
			// Check if the reply source message is of type "text" or "reply"
			if (
				replySourceChatMessageData.data.type === "reply" ||
				replySourceChatMessageData.data.type === "text"
			) {
				// Prepare the message data when replying to a text message
				messageInfo = {
					sender: new ObjectId(clientAccountId),
					receiver: new ObjectId(userAccountId),
					sentAt: currentTime,
					seenBy: [], // Initially, no one has seen the message
					data: {
						type: "reply",
						content: {
							text: content, // The content of the reply message
							keyword: keywords, // Associated keywords
						},
						attachment: {
							type: "text", // The type of the original message being replied to
							content: replySourceChatMessageData.data.content.text,
						},
						repliedInfo: {
							messageId: new ObjectId(repliedInfo.messageId), // ID of the replied message
							repliedTo: new ObjectId(repliedInfo.repliedTo), // ID of the message being replied to
						},
					},
				};
			} else {
				// Prepare the message data when replying to a non-text message (attachment)
				messageInfo = {
					sender: new ObjectId(clientAccountId),
					receiver: new ObjectId(userAccountId),
					sentAt: currentTime,
					seenBy: [], // Initially, no one has seen the message
					data: {
						type: "reply",
						attachment: replySourceChatMessageData.data.attachment, // Include the original attachment
						repliedInfo: {
							messageId: new ObjectId(repliedInfo.messageId), // ID of the replied message
							repliedTo: new ObjectId(repliedInfo.repliedTo), // ID of the message being replied to
						},
						content: {
							text: content, // The content of the reply message
							keyword: keywords, // Associated keywords
						},
					},
				};
			}
		} else {
			// Prepare the message data for a regular text message (not a reply)
			messageInfo = {
				sender: new ObjectId(clientAccountId),
				receiver: new ObjectId(userAccountId),
				sentAt: currentTime,
				seenBy: [], // Initially, no one has seen the message
				data: {
					type: "text", // Message type is "text"
					content: {
						text: content, // The content of the message
						keyword: keywords, // Associated keywords
					},
				},
			};
		}

		// Insert the message into the database and return the inserted message ID
		let { insertedId } = await oneToOneMessageCollection.insertOne(messageInfo, {
			session,
		});

		// Return the string representation of the inserted message ID
		return insertedId.toString();
	} catch (error) {
		// Propagate any errors encountered during the process
		throw error;
	}
}

/**
 * Uploads an attachment message to a one-to-one chat.
 *
 * This function handles different types of attachments such as:
 * - photo
 * - moment
 * - clip
 * - audio
 * - account
 * - memory
 * - highlight
 * - file (default/fallback)
 *
 * It also handles optional captions and extracts keywords from them.
 * Updates the `oneToOneChat` collection to reflect recent activity and
 * inserts the chat message into the `oneToOneMessageCollection`.
 *
 * @param clientAccountId - The sender's account ID
 * @param userAccountId - The receiver's account ID
 * @param attachment - The attachment payload, including type, id, caption, and optional nested info
 * @param currentTime - The timestamp of when the message is being sent
 * @param session - The MongoDB client session for transactional support
 * @returns A Promise resolving to the inserted message's ID string
 */
export async function oneToOneChatAttachmentMessageUpload(
	clientAccountId: string,
	userAccountId: string,
	attachment: AttachmentPayloadParams,
	currentTime: Date,
	session: ClientSession
): Promise<string> {
	let messageInfo: ChatMessage;

	// Helper to conditionally attach caption and keywords
	const createContent = (caption?: string) =>
		caption
			? {
					text: caption,
					keyword: getKeywords(caption),
			  }
			: undefined;

	// Create the message object depending on the attachment type
	if (attachment.type === "photo") {
		messageInfo = {
			sender: new ObjectId(clientAccountId),
			receiver: new ObjectId(userAccountId),
			sentAt: currentTime,
			seenBy: [],
			data: {
				type: "attachment",
				attachment: {
					type: "photo",
					id: new ObjectId(attachment.id),
				},
				...(attachment.caption && {
					content: createContent(attachment.caption),
				}),
			},
		};
	} else if (attachment.type === "moment") {
		messageInfo = {
			sender: new ObjectId(clientAccountId),
			receiver: new ObjectId(userAccountId),
			sentAt: currentTime,
			seenBy: [],
			data: {
				type: "attachment",
				attachment: {
					type: "moment",
					id: new ObjectId(attachment.id),
				},
				...(attachment.caption && {
					content: createContent(attachment.caption),
				}),
			},
		};
	} else if (attachment.type === "clip") {
		messageInfo = {
			sender: new ObjectId(clientAccountId),
			receiver: new ObjectId(userAccountId),
			sentAt: currentTime,
			seenBy: [],
			data: {
				type: "attachment",
				attachment: {
					type: "clip",
					id: new ObjectId(attachment.id),
				},
				...(attachment.caption && {
					content: createContent(attachment.caption),
				}),
			},
		};
	} else if (attachment.type === "audio") {
		messageInfo = {
			sender: new ObjectId(clientAccountId),
			receiver: new ObjectId(userAccountId),
			sentAt: currentTime,
			seenBy: [],
			data: {
				type: "attachment",
				attachment: {
					type: "audio",
					id: new ObjectId(attachment.id),
				},
				...(attachment.caption && {
					content: createContent(attachment.caption),
				}),
			},
		};
	} else if (attachment.type === "account") {
		messageInfo = {
			sender: new ObjectId(clientAccountId),
			receiver: new ObjectId(userAccountId),
			sentAt: currentTime,
			seenBy: [],
			data: {
				type: "attachment",
				attachment: {
					type: "account",
					id: new ObjectId(attachment.id),
				},
				...(attachment.caption && {
					content: createContent(attachment.caption),
				}),
			},
		};
	} else if (attachment.type === "memory") {
		messageInfo = {
			sender: new ObjectId(clientAccountId),
			receiver: new ObjectId(userAccountId),
			sentAt: currentTime,
			seenBy: [],
			data: {
				type: "attachment",
				attachment: {
					type: "memory",
					id: new ObjectId(attachment.id),
				},
				...(attachment.caption && {
					content: createContent(attachment.caption),
				}),
			},
		};
	} else if (attachment.type === "highlight") {
		messageInfo = {
			sender: new ObjectId(clientAccountId),
			receiver: new ObjectId(userAccountId),
			sentAt: currentTime,
			seenBy: [],
			data: {
				type: "attachment",
				attachment: {
					type: "highlight",
					highlightInfo: {
						highlightId: new ObjectId(attachment.highlightId),
						memoryId: new ObjectId(attachment.memoryId),
					},
				},
				...(attachment.caption && {
					content: createContent(attachment.caption),
				}),
			},
		};
	} else {
		// Default to file-type attachment
		messageInfo = {
			sender: new ObjectId(clientAccountId),
			receiver: new ObjectId(userAccountId),
			sentAt: currentTime,
			seenBy: [],
			data: {
				type: "attachment",
				attachment: {
					type: "file",
					file: attachment.file,
				},
				...(attachment.caption && {
					content: createContent(attachment.caption),
				}),
			},
		};
	}

	try {
		// Update the last message timestamp and restore participants if previously deleted
		await oneToOneChatCollection.updateOne(
			{
				$and: [
					{
						participants: {
							$elemMatch: { accountId: new ObjectId(userAccountId) },
						},
					},
					{
						participants: {
							$elemMatch: { accountId: new ObjectId(clientAccountId) },
						},
					},
				],
			},
			{
				$set: {
					lastMessageSentAt: currentTime,

					// If either participant was marked deleted, reset their state
					"participants.$[deletedClient].isDeleted": false,
					"participants.$[deletedClient].joinedAt": currentTime,
					"participants.$[deletedClient].participantLastMessageSentAt":
						currentTime,

					// Update the sender's last message sent timestamp if they are active
					"participants.$[activeClient].participantLastMessageSentAt":
						currentTime,

					// Similarly restore deleted user if applicable
					"participants.$[deletedUser].isDeleted": false,
					"participants.$[deletedUser].joinedAt": currentTime,
				},
			},
			{
				arrayFilters: [
					{
						"deletedClient.accountId": new ObjectId(clientAccountId),
						"deletedClient.isDeleted": true,
					},
					{
						"activeClient.accountId": new ObjectId(clientAccountId),
						"activeClient.isDeleted": false,
					},
					{
						"deletedUser.accountId": new ObjectId(userAccountId),
						"deletedUser.isDeleted": true,
					},
				],
				session,
			}
		);

		// Insert the composed chat message
		const { insertedId } = await oneToOneMessageCollection.insertOne(messageInfo, {
			session,
		});
		return insertedId.toString();
	} catch (error) {
		// Rethrow for upstream error handling
		throw error;
	}
}

/**
 * Creates a one-to-one chat between two accounts and sends the first message (text or attachment).
 *
 * - Inserts a new chat document into the `oneToOneChatCollection`.
 * - Depending on the payload type, uploads either a text or an attachment message.
 * - Uses a transaction session to ensure atomic operations.
 *
 * @param {string} clientAccountId - The account ID of the user initiating the chat.
 * @param {string} userAccountId - The account ID of the recipient user.
 * @param {boolean} isMessageRequest - Indicates if the message is a request (affects membership status).
 * @param {PayloadParams} payload - The message payload containing either text or attachment data.
 * @param {Date} currentTime - The timestamp to use for creation and activity tracking.
 * @param {ClientSession} session - The MongoDB session used to execute operations within a transaction.
 *
 * @returns {Promise<string>} The ID of the inserted message document.
 *
 * @throws Will throw an error if the database operation or message upload fails.
 */

export async function createOneToOneChat(
	clientAccountId: string,
	userAccountId: string,
	isMessageRequest: boolean,
	payload: PayloadParams,
	currentTime: Date,
	session: ClientSession
): Promise<string> {
	const chatInfo: OneToOneChat = {
		participants: [
			{
				accountId: new ObjectId(clientAccountId),
				isDeleted: false,
				isMember: true,
				isMuted: false,
				isPinned: false,
				joinedAt: currentTime,
				participantLastMessageSentAt: currentTime,
			},
			{
				accountId: new ObjectId(userAccountId),
				isDeleted: false,
				isMember: isMessageRequest ? false : true,
				isMuted: false,
				isPinned: false,
				joinedAt: currentTime,
			},
		],
		lastMessageSentAt: currentTime,
	};

	try {
		await oneToOneChatCollection.insertOne(chatInfo, { session });

		// Handle text message separately
		if (payload.type === "text") {
			return await oneToOneChatTextMessageUpload(
				payload.content,
				clientAccountId,
				userAccountId,
				currentTime,
				session
			);
		}

		// Handle attachment messages
		const baseAttachment: Partial<AttachmentPayloadParams> = {
			type: payload.type,
			caption: payload.caption,
		};

		// Map specific attachment types to their unique fields
		let attachmentPayload: AttachmentPayloadParams;

		switch (payload.type) {
			case "photo":
			case "moment":
			case "clip":
			case "account":
			case "audio":
			case "memory":
				attachmentPayload = {
					...baseAttachment,
					id: payload.id,
				} as AttachmentPayloadParams;
				break;
			case "highlight":
				attachmentPayload = {
					...baseAttachment,
					highlightId: payload.highlightId,
					memoryId: payload.memoryId,
				} as AttachmentPayloadParams;
				break;
			case "file":
			default:
				attachmentPayload = {
					...baseAttachment,
					file: payload.file,
				} as AttachmentPayloadParams;
				break;
		}

		return await oneToOneChatAttachmentMessageUpload(
			clientAccountId,
			userAccountId,
			attachmentPayload,
			currentTime,
			session
		);
	} catch (error) {
		throw error;
	}
}
