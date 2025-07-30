import { ClientSession, ObjectId, WithId } from "mongodb";
import {
	AttachmentPayloadParams,
	BannerParams,
	MessageReplyInfo,
} from "../../types/util.type";
import {
	GroupChat,
	GroupChatParticipant,
	GroupMessage,
} from "../../types/collection/chat.type";
import { getKeywords, urlGenerator } from "../../utils/functions";
import { isAccountBlocked, isAccountFollower } from "../../utils/dbUtils";
import { getAccountById } from "../account.model";
import { groupChatCollection, groupMessageCollection } from "../index.model";
import { AppError } from "../../constants/appError";
import HttpStatusCodes from "../../constants/HttpStatusCodes";

/**
 * Handles the uploading of a text message in a group chat, with support for replies.
 *
 * This function processes a group chat text message upload by creating a new message entry
 * in the database. If the message is a reply, it includes the original message's content and metadata.
 * It also extracts keywords from the content for future search or filtering purposes.
 *
 * @param {string} content - The content of the text message being uploaded.
 * @param {string} clientAccountId - The ID of the user sending the message.
 * @param {string} chatId - The ID of the group chat in which the message is being sent.
 * @param {ClientSession} session - The session object used to perform the database operation within a transaction.
 * @param {Date} currentTime - The timestamp when the message is being sent.
 * @param {MessageReplyInfo} [repliedInfo] - Information about the message being replied to (if applicable).
 * @param {WithId<GroupMessage>} [replySourceGroupMessageData] - The original message being replied to (if applicable).
 *
 * @returns {Promise<string>} - A promise that resolves to the ID of the inserted message in the database.
 *
 * @throws {Error} - Throws an error if any issue occurs during the message upload process, such as a database error.
 */
export async function groupChatTextMessageUpload(
	content: string,
	clientAccountId: string,
	chatId: string,
	session: ClientSession,
	currentTime: Date,
	repliedInfo?: MessageReplyInfo,
	replySourceGroupMessageData?: WithId<GroupMessage>
): Promise<string> {
	// Extract keywords from the content for search/filtering purposes
	let keywords = getKeywords(content);
	let messageInfo: GroupMessage;
	try {
		// Check if this is a reply message and construct the message accordingly
		if (
			repliedInfo &&
			replySourceGroupMessageData &&
			replySourceGroupMessageData.data.type !== "banner"
		) {
			// If the original message is a text or reply message, create a "reply" type message
			if (
				replySourceGroupMessageData.data.type === "reply" ||
				replySourceGroupMessageData.data.type === "text"
			) {
				// Create a reply message object
				messageInfo = {
					sender: new ObjectId(clientAccountId), // Sender's account ID
					chatId: new ObjectId(chatId), // The ID of the chat
					sentAt: currentTime, // The time the message was sent
					seenBy: [], // List of users who have seen the message (empty initially)
					data: {
						type: "reply", // The type of message is a reply
						content: {
							text: content, // The text of the reply
							keyword: keywords, // Keywords extracted from the content
						},
						attachment: {
							type: "text", // The attachment type (text in this case)
							content: replySourceGroupMessageData.data.content.text, // Original message content being replied to
						},
						repliedInfo: {
							messageId: new ObjectId(repliedInfo.messageId), // The ID of the replied message
							repliedTo: new ObjectId(repliedInfo.repliedTo), // The ID of the user being replied to
						},
					},
				};
			} else {
				// If the original message has an attachment, create a reply message with the attachment
				messageInfo = {
					sender: new ObjectId(clientAccountId),
					chatId: new ObjectId(chatId),
					sentAt: currentTime,
					seenBy: [],
					data: {
						type: "reply", // The type of message is a reply
						attachment: replySourceGroupMessageData.data.attachment, // Attach the original message's attachment
						repliedInfo: {
							messageId: new ObjectId(repliedInfo.messageId),
							repliedTo: new ObjectId(repliedInfo.repliedTo),
						},
						content: {
							text: content,
							keyword: keywords,
						},
					},
				};
			}
		} else {
			// If this is a regular message (not a reply), create a normal text message
			messageInfo = {
				sender: new ObjectId(clientAccountId), // Sender's account ID
				chatId: new ObjectId(chatId), // The ID of the chat
				sentAt: currentTime, // Timestamp of when the message was sent
				seenBy: [], // List of users who have seen the message (empty initially)
				data: {
					type: "text", // The type of message is text
					content: {
						text: content, // The text content of the message
						keyword: keywords, // Keywords extracted from the content
					},
				},
			};
		}

		// Insert the message into the database and retrieve the inserted message's ID
		let { insertedId } = await groupMessageCollection.insertOne(messageInfo, {
			session,
		});

		// Return the inserted message ID as a string
		return insertedId.toString();
	} catch (error) {
		// In case of an error, throw the error so it can be caught and handled by the caller
		throw error;
	}
}

/**
 * Handles the uploading of an attachment message in a group chat.
 *
 * This function processes the different types of attachments (e.g., photo, audio, video, etc.) and creates a message entry
 * in the database, associating the attachment with a specific chat. If a caption is provided, it extracts keywords from it
 * and adds them to the message for search and filtering purposes. The function updates the group's last message timestamp
 * after inserting the new message.
 *
 * @param {string} clientAccountId - The ID of the user sending the message.
 * @param {string} chatId - The ID of the group chat in which the attachment is being sent.
 * @param {AttachmentPayloadParams} attachment - The attachment data, which includes the attachment type, id, caption, etc.
 * @param {Date} currentTime - The timestamp when the message is being sent.
 * @param {ClientSession} session - The session object used to perform the database operation within a transaction.
 *
 * @returns {Promise<string>} - A promise that resolves to the ID of the inserted message in the database.
 *
 * @throws {Error} - Throws an error if any issue occurs during the message upload or group chat update process, such as a database error.
 */
export async function groupChatAttachmentMessageUpload(
	clientAccountId: string,
	chatId: string,
	attachment: AttachmentPayloadParams,
	currentTime: Date,
	session: ClientSession
): Promise<string> {
	let messageInfo: GroupMessage;

	// Handle the different types of attachments (photo, moment, clip, audio, etc.)
	if (attachment.type === "photo") {
		// If there is a caption, extract keywords and construct the message with caption data
		if (attachment.caption) {
			let keywords: string[] = getKeywords(attachment.caption);
			messageInfo = {
				sender: new ObjectId(clientAccountId), // Sender's account ID
				chatId: new ObjectId(chatId), // Chat ID
				sentAt: currentTime, // Time when the message is sent
				seenBy: [], // List of users who have seen the message (empty initially)
				data: {
					type: "attachment", // The message is of type "attachment"
					attachment: {
						type: "photo", // Attachment type is photo
						id: new ObjectId(attachment.id), // ID of the attachment
					},
					content: {
						text: attachment.caption, // Caption text
						keyword: keywords, // Extracted keywords from the caption
					},
				},
			};
		} else {
			// If no caption is provided, create the message with just the attachment info
			messageInfo = {
				sender: new ObjectId(clientAccountId),
				chatId: new ObjectId(chatId),
				sentAt: currentTime,
				seenBy: [],
				data: {
					type: "attachment",
					attachment: {
						type: "photo",
						id: new ObjectId(attachment.id),
					},
				},
			};
		}
	} else if (attachment.type === "moment") {
		// Similar logic for handling "moment" attachments
		if (attachment.caption) {
			let keywords: string[] = getKeywords(attachment.caption);
			messageInfo = {
				sender: new ObjectId(clientAccountId),
				chatId: new ObjectId(chatId),
				sentAt: currentTime,
				seenBy: [],
				data: {
					type: "attachment",
					attachment: {
						type: "moment", // Attachment type is moment
						id: new ObjectId(attachment.id),
					},
					content: {
						text: attachment.caption,
						keyword: keywords,
					},
				},
			};
		} else {
			messageInfo = {
				sender: new ObjectId(clientAccountId),
				chatId: new ObjectId(chatId),
				sentAt: currentTime,
				seenBy: [],
				data: {
					type: "attachment",
					attachment: {
						type: "moment",
						id: new ObjectId(attachment.id),
					},
				},
			};
		}
	} else if (attachment.type === "clip") {
		// Similar logic for handling "clip" attachments
		if (attachment.caption) {
			let keywords: string[] = getKeywords(attachment.caption);
			messageInfo = {
				sender: new ObjectId(clientAccountId),
				chatId: new ObjectId(chatId),
				sentAt: currentTime,
				seenBy: [],
				data: {
					type: "attachment",
					attachment: {
						type: "clip", // Attachment type is clip
						id: new ObjectId(attachment.id),
					},
					content: {
						text: attachment.caption,
						keyword: keywords,
					},
				},
			};
		} else {
			messageInfo = {
				sender: new ObjectId(clientAccountId),
				chatId: new ObjectId(chatId),
				sentAt: currentTime,
				seenBy: [],
				data: {
					type: "attachment",
					attachment: {
						type: "clip",
						id: new ObjectId(attachment.id),
					},
				},
			};
		}
	} else if (attachment.type === "audio") {
		// Similar logic for handling "audio" attachments
		if (attachment.caption) {
			let keywords: string[] = getKeywords(attachment.caption);
			messageInfo = {
				sender: new ObjectId(clientAccountId),
				chatId: new ObjectId(chatId),
				sentAt: currentTime,
				seenBy: [],
				data: {
					type: "attachment",
					attachment: {
						type: "audio", // Attachment type is audio
						id: new ObjectId(attachment.id),
						audioType: attachment.audioType,
					},
					content: {
						text: attachment.caption,
						keyword: keywords,
					},
				},
			};
		} else {
			messageInfo = {
				sender: new ObjectId(clientAccountId),
				chatId: new ObjectId(chatId),
				sentAt: currentTime,
				seenBy: [],
				data: {
					type: "attachment",
					attachment: {
						type: "audio",
						id: new ObjectId(attachment.id),
						audioType: attachment.audioType,
					},
				},
			};
		}
	} else if (attachment.type === "account") {
		// Similar logic for handling "account" attachments
		if (attachment.caption) {
			let keywords: string[] = getKeywords(attachment.caption);
			messageInfo = {
				sender: new ObjectId(clientAccountId),
				chatId: new ObjectId(chatId),
				sentAt: currentTime,
				seenBy: [],
				data: {
					type: "attachment",
					attachment: {
						type: "account", // Attachment type is account
						id: new ObjectId(attachment.id),
					},
					content: {
						text: attachment.caption,
						keyword: keywords,
					},
				},
			};
		} else {
			messageInfo = {
				sender: new ObjectId(clientAccountId),
				chatId: new ObjectId(chatId),
				sentAt: currentTime,
				seenBy: [],
				data: {
					type: "attachment",
					attachment: {
						type: "account",
						id: new ObjectId(attachment.id),
					},
				},
			};
		}
	} else if (attachment.type === "memory") {
		// Similar logic for handling "memory" attachments
		if (attachment.caption) {
			let keywords: string[] = getKeywords(attachment.caption);
			messageInfo = {
				sender: new ObjectId(clientAccountId),
				chatId: new ObjectId(chatId),
				sentAt: currentTime,
				seenBy: [],
				data: {
					type: "attachment",
					attachment: {
						type: "memory", // Attachment type is memory
						id: new ObjectId(attachment.id),
					},
					content: {
						text: attachment.caption,
						keyword: keywords,
					},
				},
			};
		} else {
			messageInfo = {
				sender: new ObjectId(clientAccountId),
				chatId: new ObjectId(chatId),
				sentAt: currentTime,
				seenBy: [],
				data: {
					type: "attachment",
					attachment: {
						type: "memory",
						id: new ObjectId(attachment.id),
					},
				},
			};
		}
	} else if (attachment.type === "highlight") {
		// Handle "highlight" type with additional information (highlightId, memoryId)
		if (attachment.caption) {
			let keywords: string[] = getKeywords(attachment.caption);
			messageInfo = {
				sender: new ObjectId(clientAccountId),
				chatId: new ObjectId(chatId),
				sentAt: currentTime,
				seenBy: [],
				data: {
					type: "attachment",
					attachment: {
						type: "highlight",
						highlightInfo: {
							highlightId: new ObjectId(attachment.highlightId), // Highlight ID
							memoryId: new ObjectId(attachment.memoryId), // Memory ID
						},
					},
					content: {
						text: attachment.caption,
						keyword: keywords,
					},
				},
			};
		} else {
			messageInfo = {
				sender: new ObjectId(clientAccountId),
				chatId: new ObjectId(chatId),
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
				},
			};
		}
	} else {
		// Handle generic file attachment
		if (attachment.caption) {
			let keywords: string[] = getKeywords(attachment.caption);
			messageInfo = {
				sender: new ObjectId(clientAccountId),
				chatId: new ObjectId(chatId),
				sentAt: currentTime,
				seenBy: [],
				data: {
					type: "attachment",
					attachment: {
						type: "file", // Attachment type is file
						file: attachment.file,
					},
					content: {
						text: attachment.caption,
						keyword: keywords,
					},
				},
			};
		} else {
			messageInfo = {
				sender: new ObjectId(clientAccountId),
				chatId: new ObjectId(chatId),
				sentAt: currentTime,
				seenBy: [],
				data: {
					type: "attachment",
					attachment: {
						type: "file",
						file: attachment.file,
					},
				},
			};
		}
	}

	// Try inserting the message into the database and updating the chat's last message timestamp
	try {
		let { insertedId } = await groupMessageCollection.insertOne(messageInfo, {
			session,
		});
		await groupChatCollection.updateOne(
			{ _id: new ObjectId(chatId) },
			{ $set: { lastMessageSentAt: currentTime } },
			{ session }
		);
		return insertedId.toString(); // Return the inserted message ID
	} catch (error) {
		throw error; // Throw an error if something goes wrong
	}
}

/**
 * Handles the uploading of a banner message in a group chat.
 *
 * This function creates a new message with banner information (e.g., banner image, text, etc.) and inserts it into the
 * database. It associates the banner message with the given group chat and sets the sender as the user who sent the message.
 * The function returns the inserted message's ID as a string upon successful insertion.
 *
 * @param {string} clientAccountId - The ID of the user sending the banner message.
 * @param {string} chatId - The ID of the group chat where the banner is being sent.
 * @param {BannerParams} bannerInfo - The banner details (e.g., image URL, banner text, etc.).
 * @param {Date} currentTime - The timestamp when the banner message is being sent.
 * @param {ClientSession} session - The session object used to perform the database operation within a transaction.
 *
 * @returns {Promise<string>} - A promise that resolves to the ID of the inserted banner message in the database.
 *
 * @throws {Error} - Throws an error if any issue occurs during the message upload process, such as a database error.
 */
export async function groupChatBannerMessageUpload(
	clientAccountId: string,
	chatId: string,
	bannerInfo: BannerParams,
	currentTime: Date,
	session: ClientSession
): Promise<string> {
	let messageInfo: GroupMessage;

	// Prepare the message object with banner information
	try {
		messageInfo = {
			sender: new ObjectId(clientAccountId), // Set the sender as the user who is uploading the banner
			chatId: new ObjectId(chatId), // Set the group chat ID to associate the message with the correct chat
			sentAt: currentTime, // Set the timestamp of when the message is sent
			seenBy: [], // Initialize an empty array for users who have seen the message (empty initially)
			data: {
				type: "banner", // Specify that this is a "banner" type message
				bannerInfo: bannerInfo, // Attach the provided banner information (e.g., image, text, etc.)
			},
		};

		// Insert the banner message into the database within the provided session for transaction consistency
		let { insertedId } = await groupMessageCollection.insertOne(messageInfo, {
			session, // Use the session for transactional integrity
		});

		// Return the ID of the inserted banner message
		return insertedId.toString();
	} catch (error) {
		// If any error occurs during insertion, propagate the error
		throw error;
	}
}

/**
 * Creates a new group chat with the provided participants and chat details.
 *
 * This function initializes a group chat by adding the provided participants (including the creator),
 * ensuring that no blocked users are added. It also optionally allows the chat to have a display picture.
 * The group chat is then inserted into the database, and the function returns the inserted chat's ID.
 *
 * @param {string} clientAccountId - The ID of the client (user) creating the group chat.
 * @param {string} name - The name of the new group chat.
 * @param {string[]} participantsIdList - List of participant account IDs to be added to the group chat.
 * @param {Date} currentTime - The current timestamp when the group chat is created.
 * @param {ClientSession} session - The session object for performing database operations within a transaction.
 * @param {string} [displayPicture] - Optional display picture URL for the group chat.
 *
 * @returns {Promise<string>} - A promise that resolves to the ID of the newly created group chat.
 *
 * @throws {AppError} - Throws an error if there is an issue with the group creation, such as blocked participants
 * or missing account information.
 */
export async function createGroupChat(
	clientAccountId: string,
	name: string,
	participantsIdList: string[],
	currentTime: Date,
	session: ClientSession,
	displayPicture?: string
): Promise<string> {
	try {
		// Initialize the list of participants with the creator of the group chat
		let participantsList: GroupChatParticipant[] = [
			{
				accountId: new ObjectId(clientAccountId), // Set the creator as an admin of the group
				joinedAt: currentTime,
				isPinned: false,
				isMuted: false,
				isMember: true,
				isAdmin: true,
			},
		];

		// Iterate through the list of participant account IDs and add them to the participants list
		for (let accountId of participantsIdList) {
			// Get the account info for each participant
			const accountInfo = await getAccountById(accountId);

			if (accountInfo) {
				// Check if the account is blocked by the creator
				if (!(await isAccountBlocked(accountId, clientAccountId))) {
					// Add the participant to the group, marking them as a member but not an admin
					participantsList.push({
						accountId: new ObjectId(accountId),
						joinedAt: currentTime,
						isPinned: false,
						isMuted: false,
						isMember: (await isAccountFollower(clientAccountId, accountId)) // Member status based on whether the client is a follower
							? true
							: false,
						isAdmin: false,
						invitedBy: new ObjectId(clientAccountId), // The creator is the one who invited this participant
					});
				} else {
					// Throw an error if the participant is blocked by the creator
					throw new AppError(
						"Failed to create group. Participant is blocked.",
						HttpStatusCodes.FORBIDDEN
					);
				}
			} else {
				// Throw an error if the participant account is not found
				throw new AppError(
					"Failed to create group. Participant not found.",
					HttpStatusCodes.NOT_FOUND
				);
			}
		}

		// Create the group chat object, optionally including a display picture
		let chatInfo: GroupChat = displayPicture
			? {
					participants: participantsList,
					lastMessageSentAt: currentTime,
					displayPicture: urlGenerator(displayPicture, "displayPicture"), // Generate URL for the display picture
					name: name,
			  }
			: {
					participants: participantsList,
					lastMessageSentAt: currentTime,
					name: name,
			  };

		// Insert the new group chat into the database and return the inserted ID as a string
		const { insertedId } = await groupChatCollection.insertOne(chatInfo, { session });

		return insertedId.toString();
	} catch (error) {
		// If any error occurs during the process, propagate the error
		throw error;
	}
}

/**
 * Adds new participants to an existing group chat.
 *
 * This function takes a list of participant IDs, validates them by checking if they exist and if they are not blocked
 * by the client (group creator). It then updates the group chat's participant list, and sets the `lastMessageSentAt`
 * field to the current time. The updated group chat object is returned.
 *
 * @param {string} clientAccountId - The ID of the client (user) who is adding participants to the group.
 * @param {WithId<GroupChat>} chatInfo - The current group chat object to which participants will be added.
 * @param {string[]} participantsIdList - The list of participant account IDs to be added to the group chat.
 * @param {Date} currentTime - The current timestamp when participants are added.
 * @param {ClientSession} session - The session object for performing database operations within a transaction.
 *
 * @returns {Promise<WithId<GroupChat>>} - A promise that resolves to the updated group chat object with new participants.
 *
 * @throws {AppError} - Throws an error if a participant is blocked by the client or if the participant account is not found.
 */
export async function addGroupChatParticipants(
	clientAccountId: string,
	chatInfo: WithId<GroupChat>,
	participantsIdList: string[],
	currentTime: Date,
	session: ClientSession
): Promise<WithId<GroupChat>> {
	try {
		// Initialize the list of new participants to be added
		let participantsList: GroupChatParticipant[] = [];

		// Iterate over the list of participants to validate and add them
		for (let accountId of participantsIdList) {
			// Fetch the account info for each participant
			const accountInfo = await getAccountById(accountId);

			if (accountInfo) {
				// Ensure the participant is not blocked by the client
				if (!(await isAccountBlocked(accountId, clientAccountId))) {
					// Add valid participant to the list with initial values
					participantsList.push({
						accountId: new ObjectId(accountId),
						joinedAt: currentTime,
						isPinned: false,
						isMuted: false,
						isMember: (await isAccountFollower(clientAccountId, accountId)) // Determine if the participant is a member based on following status
							? true
							: false,
						isAdmin: false,
						invitedBy: new ObjectId(clientAccountId), // Mark the client as the inviter
					});
				} else {
					// Throw error if the participant is blocked by the client
					throw new AppError(
						"Failed to add. Participant is blocked.",
						HttpStatusCodes.FORBIDDEN
					);
				}
			} else {
				// Throw error if the participant account does not exist
				throw new AppError(
					"Failed to add. Participant not found.",
					HttpStatusCodes.NOT_FOUND
				);
			}
		}

		// Update the group chat with the new participants and set the last message time
		await groupChatCollection.updateOne(
			{ _id: new ObjectId(chatInfo._id) }, // Find the specific chat by ID
			{
				$push: { participants: { $each: participantsList } }, // Add the new participants to the participants list
				$set: { lastMessageSentAt: new Date() }, // Update the last message sent timestamp
			},
			{ session } // Ensure the operation is part of the ongoing session
		);

		// Return the updated group chat object, including the newly added participants
		return {
			_id: chatInfo._id,
			lastMessageSentAt: new Date(),
			name: chatInfo.name,
			participants: [...chatInfo.participants, ...participantsList], // Merge existing and new participants
			displayPicture: chatInfo.displayPicture,
		};
	} catch (error) {
		// Propagate any errors encountered during the process
		throw error;
	}
}
