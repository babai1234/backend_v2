import { NextFunction, Request, Response } from "express";
import {
	oneToOneChatAccountAttachmentService,
	oneToOneChatAudioAttachmentService,
	oneToOneChatClipPostAttachmentService,
	oneToOneChatFileAttachmentService,
	oneToOneChatHighlightAttachmentService,
	oneToOneChatMemoryAttachmentService,
	oneToOneChatMomentPostAttachmentService,
	oneToOneChatPhotoPostAttachmentService,
	oneToOneChatTextUploadService,
} from "../../service/chat/oneToOneChat.service";
import HttpStatusCodes from "../../constants/HttpStatusCodes";
import {
	AttchmentPresignRequestParams,
	CustomRequest,
	OneToOneChatAccountAttachmentUploadRequestParams,
	OneToOneChatAudioAttachmentUploadRequestParams,
	OneToOneChatFileAttachmentUploadRequestParams,
	OneToOneChatHighlightAttachmentUploadRequestParams,
	OneToOneChatMemoryAttachmentUploadRequestParams,
	OneToOneChatPostAttachmentUploadRequestParams,
	OneToOneChatTextMessageUploadRequestParams,
	PresignResponseParams,
} from "../../types/util.type";
import { matchedData, validationResult } from "express-validator";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client } from "../../utils/s3Client";
import { getAccountById } from "../../models/account.model";
import { isAccountFollower, isOneToOneChatAvailable } from "../../utils/dbUtils";
import { AppError } from "../../constants/appError";

/**
 * Handles the upload of a text message in a one-to-one chat.
 *
 * This function validates the incoming request, ensures the client is authenticated,
 * extracts necessary message data (including optional reply info), and delegates the
 * logic to the `oneToOneChatTextUploadService`. If the operation is successful,
 * it returns a 201 Created response.
 *
 * @param {CustomRequest} req - The Express request object, extended with authenticated client info.
 * @param {Response} res - The Express response object used to send back the result.
 * @param {NextFunction} next - The Express `next` function for forwarding errors.
 * @returns {Promise<void>} Returns nothing but sends HTTP response or propagates error.
 *
 * @throws {AppError} - If authentication fails, request validation fails, or message service encounters issues.
 */
export const oneToOneChatTextMessageUploadHandler = async (
	req: CustomRequest,
	res: Response,
	next: NextFunction
): Promise<void> => {
	try {
		// Ensure the user is authenticated
		if (!req.clientAccountInfo) {
			throw new AppError("Unauthorised", HttpStatusCodes.UNAUTHORIZED);
		}

		// Validate request payload using express-validator
		if (!validationResult(req).isEmpty()) {
			throw new AppError("Invalid request", HttpStatusCodes.BAD_REQUEST);
		}

		// Extract sender info from the request
		let clientAccountInfo = req.clientAccountInfo;

		// Extract validated message content, recipient, and reply metadata (if any)
		const { content, sentTo, repliedInfo } =
			matchedData<OneToOneChatTextMessageUploadRequestParams>(req);

		// Call service layer to process and persist the text message
		await oneToOneChatTextUploadService(
			sentTo,
			clientAccountInfo,
			content,
			repliedInfo
		);

		// Respond with HTTP 201 Created on successful message upload
		res.sendStatus(HttpStatusCodes.CREATED);
	} catch (error) {
		// Forward errors to Express error middleware
		next(error);
	}
};

/**
 * Handles the upload of file attachments in a one-to-one chat.
 *
 * This function validates the request, verifies the client's identity,
 * and delegates the attachment processing to the `oneToOneChatFileAttachmentService`.
 * It supports uploading one or more files along with an optional caption to a recipient user.
 *
 * @param {CustomRequest} req - Express request object containing client account info and validated params.
 * @param {Response} res - Express response object used to return the result.
 * @param {NextFunction} next - Express middleware function used for error handling.
 * @returns {Promise<void>} Sends a 201 Created response on success or forwards errors to the handler.
 *
 * @throws {AppError} - If the user is not authorized, request validation fails, or service execution fails.
 */
export const oneToOneChatFileAttachmentUploadHandler = async (
	req: CustomRequest,
	res: Response,
	next: NextFunction
): Promise<void> => {
	try {
		// Check if the user is authenticated
		if (!req.clientAccountInfo) {
			throw new AppError("Unauthorised", HttpStatusCodes.UNAUTHORIZED);
		}

		// Validate request parameters using express-validator
		if (!validationResult(req).isEmpty()) {
			throw new AppError("Invalid request", HttpStatusCodes.BAD_REQUEST);
		}

		// Extract validated data from request
		const { sentTo, fileDataList, caption } =
			matchedData<OneToOneChatFileAttachmentUploadRequestParams>(req);
		const clientAccountInfo = req.clientAccountInfo;

		// Call the service responsible for processing the file attachments
		await oneToOneChatFileAttachmentService(
			sentTo,
			clientAccountInfo,
			fileDataList,
			caption
		);

		// Send a 201 Created response upon successful upload
		res.sendStatus(HttpStatusCodes.CREATED);
	} catch (error) {
		// Forward any error to the centralized error handler
		next(error);
	}
};

/**
 * Generates pre-signed S3 URLs for uploading file attachments in a one-to-one chat.
 *
 * This handler ensures that the authenticated user is authorized to send files to the recipient,
 * verifies if a chat exists or if a valid following relationship allows initiating one,
 * and returns pre-signed URLs for uploading both the original file and a JPEG thumbnail.
 *
 * @param {CustomRequest} req - Express request object extended with client account info.
 * @param {Response} res - Express response object used to return the pre-signed URLs.
 * @param {NextFunction} next - Express next middleware for error handling.
 * @returns {Promise<void>} Sends a 200 OK response with an array of signed URLs, or forwards an error.
 *
 * @throws {AppError} - If the user is unauthorized, validation fails, the recipient is invalid,
 *                     or the messaging conditions are not met.
 */
export const oneToOneChatFileAttachmentUploadPresignHandler = async (
	req: CustomRequest,
	res: Response,
	next: NextFunction
): Promise<void> => {
	try {
		// Ensure the request has been authenticated
		if (!req.clientAccountInfo) {
			throw new AppError("Unauthorised", HttpStatusCodes.UNAUTHORIZED);
		}

		// Check for request validation errors
		if (!validationResult(req).isEmpty()) {
			throw new AppError("Invalid request", HttpStatusCodes.BAD_REQUEST);
		}

		// Extract client and payload details
		const clientAccountId = req.clientAccountInfo._id.toString();
		const { attachmentPresignParams, sentTo } =
			matchedData<AttchmentPresignRequestParams>(req);

		// Validate recipient account existence
		const userAccountInfo = await getAccountById(sentTo);
		if (!userAccountInfo) {
			throw new AppError("Invalid receiver id", HttpStatusCodes.NOT_FOUND);
		}

		// Check if a one-to-one chat already exists between the two users
		const chatInfo = await isOneToOneChatAvailable(sentTo, clientAccountId);

		// If no chat exists, verify if sender is allowed to initiate based on follow status and privacy
		if (!chatInfo) {
			const [userFollowingInfo, clientFollowingInfo] = await Promise.all([
				isAccountFollower(clientAccountId, sentTo), // Is sender following receiver?
				isAccountFollower(sentTo, clientAccountId), // Is receiver following sender?
			]);

			const receiverIsPrivate = userAccountInfo.isPrivate;

			// Conditions where sending is not allowed
			if (
				(receiverIsPrivate && clientFollowingInfo && !userFollowingInfo) ||
				(!receiverIsPrivate && !userFollowingInfo)
			) {
				throw new AppError("Failed to send message", HttpStatusCodes.FORBIDDEN);
			}
		}

		const presignedUrls: PresignResponseParams[] = [];

		// Generate presigned URLs for each file
		for (const param of attachmentPresignParams) {
			const [fileBaseName, fileExtension] = param.fileName.split(".");

			if (!fileBaseName || !fileExtension) {
				throw new AppError("Invalid filename", HttpStatusCodes.BAD_REQUEST);
			}

			// Define S3 keys for original file and thumbnail
			const originalFileKey = `attachment/${fileBaseName}/${param.fileName}`;
			const thumbnailFileKey = `attachment/${fileBaseName}/${fileBaseName}_thumbnail.jpg`;

			// Create S3 commands for both original and thumbnail uploads
			const originalCommand = new PutObjectCommand({
				Bucket: process.env.AWS_S3_BUCKET_NAME,
				Key: originalFileKey,
				ContentType: `${param.mediaType}/${fileExtension}`,
			});

			const thumbnailCommand = new PutObjectCommand({
				Bucket: process.env.AWS_S3_BUCKET_NAME,
				Key: thumbnailFileKey,
				ContentType: `image/jpeg`, // Force thumbnail to always be JPEG
			});

			// Generate pre-signed URLs with 5-minute expiration
			const [originalPresignedUrl, thumbnailPresignedUrl] = await Promise.all([
				getSignedUrl(s3Client, originalCommand, { expiresIn: 300 }),
				getSignedUrl(s3Client, thumbnailCommand, { expiresIn: 300 }),
			]);

			// Add generated URLs to the response array
			presignedUrls.push({
				original: originalPresignedUrl,
				thumbnail: thumbnailPresignedUrl,
			});
		}

		// Send the array of presigned URLs back to the client
		res.status(HttpStatusCodes.OK).json({ presignedUrls });
	} catch (error) {
		console.error("An error occurred generating presigned URLs", error);
		next(error); // Forward error to centralized error handler
	}
};

/**
 * Handles the upload of a photo post attachment in a one-to-one chat.
 *
 * This handler performs authentication and input validation, then delegates
 * the task to the photo post attachment service to send the photo post to
 * another user in a direct chat, optionally with a caption.
 *
 * @param {CustomRequest} req - The incoming request containing client authentication info and validated data.
 * @param {Response} res - The Express response object to send the response back to the client.
 * @param {NextFunction} next - The next middleware function in the Express stack, used for error handling.
 * @returns {Promise<void>} Sends a 201 Created status on success or passes errors to the error handler.
 *
 * @throws {AppError} - Throws:
 *  - 401 Unauthorized if the client is not authenticated,
 *  - 400 Bad Request if request validation fails.
 */
export const oneToOneChatPhotoPostAttachmentUploadHandler = async (
	req: CustomRequest,
	res: Response,
	next: NextFunction
): Promise<void> => {
	try {
		// Ensure the client is authenticated
		if (!req.clientAccountInfo) {
			throw new AppError("Unauthorised", HttpStatusCodes.UNAUTHORIZED);
		}

		// Validate the request data (e.g., postId, sentTo, caption)
		if (!validationResult(req).isEmpty()) {
			throw new AppError("Invalid request", HttpStatusCodes.BAD_REQUEST);
		}

		// Extract client info and validated payload
		const clientAccountInfo = req.clientAccountInfo;
		const { postId, sentTo, caption } =
			matchedData<OneToOneChatPostAttachmentUploadRequestParams>(req);

		// Delegate to the service that handles attaching a photo post in a one-to-one chat
		await oneToOneChatPhotoPostAttachmentService(
			sentTo, // Recipient of the photo post
			clientAccountInfo, // Authenticated user's account info
			postId, // ID of the photo post being shared
			caption // Optional caption for the attachment
		);

		// Respond with 201 Created to indicate success
		res.sendStatus(HttpStatusCodes.CREATED);
	} catch (error) {
		// Pass any thrown errors to the centralized error handler
		next(error);
	}
};

/**
 * Handles the uploading of a moment post attachment in a one-to-one chat.
 *
 * This handler validates the request, checks if the user is authenticated, and calls the service
 * to upload the moment post attachment to the chat. The attachment is linked to a specific post
 * within the chat.
 *
 * @param {CustomRequest} req - The Express request object, extended with client authentication info.
 * @param {Response} res - The Express response object to send the response back to the client.
 * @param {NextFunction} next - The next middleware function used for error handling.
 * @returns {Promise<void>} Returns nothing explicitly, but sends a response with a `201 Created` status
 * and handles errors by passing them to the error-handling middleware.
 *
 * @throws {AppError} - Throws:
 *  - 401 if the user is not authenticated,
 *  - 400 if the request data is invalid.
 */
export const oneToOneChatMomentPostAttachmentUploadHandler = async (
	req: CustomRequest,
	res: Response,
	next: NextFunction
): Promise<void> => {
	try {
		// Check if the request is authenticated by verifying the client account info
		if (!req.clientAccountInfo) {
			// If not authenticated, throw an "Unauthorized" error
			throw new AppError("Unauthorised", HttpStatusCodes.UNAUTHORIZED);
		}

		// Validate the incoming request data for missing or incorrect fields
		if (!validationResult(req).isEmpty()) {
			// If validation fails, throw a "Bad Request" error with details
			throw new AppError("Invalid request", HttpStatusCodes.BAD_REQUEST);
		}

		// Extract client account info and necessary parameters from the validated request body
		const clientAccountInfo = req.clientAccountInfo;
		const { postId, sentTo, caption } =
			matchedData<OneToOneChatPostAttachmentUploadRequestParams>(req);

		// Call the service responsible for handling the moment post attachment upload
		await oneToOneChatMomentPostAttachmentService(
			sentTo, // The recipient of the moment post attachment
			clientAccountInfo, // Information about the client sending the attachment
			postId, // The ID of the moment post to which the attachment belongs
			caption // Optional caption for the moment post attachment
		);

		// Respond with a 201 Created status indicating the successful upload of the moment post attachment
		res.sendStatus(HttpStatusCodes.CREATED);
	} catch (error) {
		// If any error occurs, pass it to the next middleware for error handling
		next(error);
	}
};

/**
 * Handles the uploading of a clip post attachment in a one-to-one chat.
 *
 * This handler validates the request, checks if the user is authenticated, and then calls the appropriate
 * service to upload the clip post attachment. The attachment is linked to a specific post in the chat.
 *
 * @param {CustomRequest} req - The Express request object, extended with client authentication info.
 * @param {Response} res - The Express response object to send the response back to the client.
 * @param {NextFunction} next - The next middleware function used for error handling.
 * @returns {Promise<void>} Returns nothing explicitly, but sends a response with a `201 Created` status
 * and handles errors by passing them to the error-handling middleware.
 *
 * @throws {AppError} - Throws:
 *  - 401 if the user is not authenticated,
 *  - 400 if the request data is invalid.
 */
export const oneToOneChatClipPostAttachmentUploadHandler = async (
	req: CustomRequest,
	res: Response,
	next: NextFunction
): Promise<void> => {
	try {
		// Check if the request is authenticated by verifying the client account info
		if (!req.clientAccountInfo) {
			// If not authenticated, throw a "Unauthorized" error
			throw new AppError("Unauthorised", HttpStatusCodes.UNAUTHORIZED);
		}

		// Validate the incoming request data for missing or incorrect fields
		if (!validationResult(req).isEmpty()) {
			// If validation fails, throw a "Bad Request" error with details
			throw new AppError("Invalid request", HttpStatusCodes.BAD_REQUEST);
		}

		// Extract client account info and necessary parameters from the validated request body
		const clientAccountInfo = req.clientAccountInfo;
		const { postId, sentTo, caption } =
			matchedData<OneToOneChatPostAttachmentUploadRequestParams>(req);

		// Call the service responsible for handling the clip post attachment upload
		await oneToOneChatClipPostAttachmentService(
			sentTo, // The recipient of the clip post attachment
			clientAccountInfo, // Information about the client sending the attachment
			postId, // The ID of the post to which the attachment belongs
			caption // Optional caption for the clip post attachment
		);

		// Respond with a 201 Created status indicating the successful upload of the clip post attachment
		res.sendStatus(HttpStatusCodes.CREATED);
	} catch (error) {
		// If any error occurs, pass it to the next middleware for error handling
		next(error);
	}
};

/**
 * Handles the uploading of an account attachment in a one-to-one chat.
 *
 * This handler validates the request, checks if the user is authenticated, and then calls the appropriate
 * service to upload the account attachment. The attachment is linked to a specific account within the chat.
 *
 * @param {CustomRequest} req - The Express request object, extended with client authentication info.
 * @param {Response} res - The Express response object to send the response back to the client.
 * @param {NextFunction} next - The next middleware function used for error handling.
 * @returns {Promise<void>} Returns nothing explicitly, but sends a response with a `201 Created` status
 * and handles errors by passing them to the error-handling middleware.
 *
 * @throws {AppError} - Throws:
 *  - 401 if the user is not authenticated,
 *  - 400 if the request data is invalid.
 */
export const oneToOneChatAccountAttachmentUploadHandler = async (
	req: CustomRequest,
	res: Response,
	next: NextFunction
): Promise<void> => {
	try {
		// Check if the request is authenticated by verifying the client account info
		if (!req.clientAccountInfo) {
			// If not authenticated, throw a "Unauthorized" error
			throw new AppError("Unauthorised", HttpStatusCodes.UNAUTHORIZED);
		}

		// Validate the incoming request data for missing or incorrect fields
		if (!validationResult(req).isEmpty()) {
			// If validation fails, throw a "Bad Request" error with details
			throw new AppError("Invalid request", HttpStatusCodes.BAD_REQUEST);
		}

		// Extract client account info and necessary parameters from the validated request body
		const clientAccountInfo = req.clientAccountInfo;
		const { accountId, sentTo, caption } =
			matchedData<OneToOneChatAccountAttachmentUploadRequestParams>(req);

		// Call the service responsible for handling the account attachment upload
		await oneToOneChatAccountAttachmentService(
			sentTo, // The recipient of the account attachment
			clientAccountInfo, // Information about the client sending the attachment
			accountId, // The ID of the account being uploaded
			caption // Optional caption for the account attachment
		);

		// Respond with a 201 Created status indicating the successful upload of the account attachment
		res.sendStatus(HttpStatusCodes.CREATED);
	} catch (error) {
		// If any error occurs, pass it to the next middleware for error handling
		next(error);
	}
};

/**
 * Handles the uploading of an audio attachment in a one-to-one chat.
 *
 * This handler validates the request, checks if the user is authenticated, and then calls the appropriate
 * service to upload the audio attachment. The attachment is linked to a specific audio within the chat.
 *
 * @param {CustomRequest} req - The Express request object, extended with client authentication info.
 * @param {Response} res - The Express response object to send the response back to the client.
 * @param {NextFunction} next - The next middleware function used for error handling.
 * @returns {Promise<void>} Returns nothing explicitly, but sends a response with a `201 Created` status
 * and handles errors by passing them to the error-handling middleware.
 *
 * @throws {AppError} - Throws:
 *  - 401 if the user is not authenticated,
 *  - 400 if the request data is invalid.
 */
export const oneToOneChatAudioAttachmentUploadHandler = async (
	req: CustomRequest,
	res: Response,
	next: NextFunction
): Promise<void> => {
	try {
		// Check if the request is authenticated by verifying the client account info
		if (!req.clientAccountInfo) {
			// If not authenticated, throw a "Unauthorized" error
			throw new AppError("Unauthorised", HttpStatusCodes.UNAUTHORIZED);
		}

		// Validate the incoming request data for missing or incorrect fields
		if (!validationResult(req).isEmpty()) {
			// If validation fails, throw a "Bad Request" error with details
			throw new AppError("Invalid request", HttpStatusCodes.BAD_REQUEST);
		}

		// Extract client account info and necessary parameters from the validated request body
		const clientAccountInfo = req.clientAccountInfo;
		const { audioId, sentTo, caption } =
			matchedData<OneToOneChatAudioAttachmentUploadRequestParams>(req);

		// Call the service responsible for handling the audio attachment upload
		await oneToOneChatAudioAttachmentService(
			sentTo, // The recipient of the audio attachment
			clientAccountInfo, // Information about the client sending the audio
			audioId, // The ID of the audio being uploaded
			caption // Optional caption for the audio attachment
		);

		// Respond with a 201 Created status indicating the successful upload of the audio attachment
		res.sendStatus(HttpStatusCodes.CREATED);
	} catch (error) {
		// If any error occurs, pass it to the next middleware for error handling
		next(error);
	}
};

/**
 * Handles the uploading of a memory attachment in a one-to-one chat.
 *
 * This handler validates the request, checks if the user is authenticated, and calls the appropriate
 * service to upload the memory attachment. The attachment is linked to a specific memory within the chat.
 *
 * @param {CustomRequest} req - The Express request object, extended with client authentication info.
 * @param {Response} res - The Express response object to send the response back to the client.
 * @param {NextFunction} next - The next middleware function used for error handling.
 * @returns {Promise<void>} Returns nothing explicitly, but sends a response with a `201 Created` status
 * and handles errors by passing them to the error-handling middleware.
 *
 * @throws {AppError} - Throws:
 *  - 401 if the user is not authenticated,
 *  - 400 if the request data is invalid.
 */
export const oneToOneChatMemoryAttachmentUploadHandler = async (
	req: CustomRequest,
	res: Response,
	next: NextFunction
): Promise<void> => {
	try {
		// Check if the request is authenticated by verifying the client account info
		if (!req.clientAccountInfo) {
			// If not authenticated, throw a "Unauthorized" error
			throw new AppError("Unauthorised", HttpStatusCodes.UNAUTHORIZED);
		}

		// Validate the incoming request data for missing or incorrect fields
		if (!validationResult(req).isEmpty()) {
			// If validation fails, throw a "Bad Request" error with details
			throw new AppError("Invalid request", HttpStatusCodes.BAD_REQUEST);
		}

		// Extract client account info and necessary parameters from the validated request body
		const clientAccountInfo = req.clientAccountInfo;
		const { memoryId, sentTo, caption } =
			matchedData<OneToOneChatMemoryAttachmentUploadRequestParams>(req);

		// Call the service responsible for handling the memory attachment upload
		await oneToOneChatMemoryAttachmentService(
			sentTo, // The recipient of the memory attachment
			clientAccountInfo, // Information about the client sending the memory
			memoryId, // The ID of the memory being uploaded
			caption // Optional caption for the memory attachment
		);

		// Respond with a 201 Created status indicating the successful upload of the memory attachment
		res.sendStatus(HttpStatusCodes.CREATED);
	} catch (error) {
		// If any error occurs, pass it to the next middleware for error handling
		next(error);
	}
};

/**
 * Handles the uploading of a highlight attachment in a one-to-one chat.
 *
 * This handler is responsible for validating the request, checking if the user is authenticated,
 * and then calling the appropriate service to upload the highlight attachment. The attachment is
 * linked to a specific highlight and memory within the chat.
 *
 * @param {CustomRequest} req - The Express request object, extended with client authentication info.
 * @param {Response} res - The Express response object to send the response back to the client.
 * @param {NextFunction} next - The next middleware function used for error handling.
 * @returns {Promise<void>} Returns nothing explicitly, but sends a response with a `201 Created` status
 * and handles errors by passing them to the error-handling middleware.
 *
 * @throws {AppError} - Throws:
 *  - 401 if the user is not authenticated,
 *  - 400 if the request data is invalid.
 */
export const oneToOneChatHighlightAttachmentUploadHandler = async (
	req: CustomRequest,
	res: Response,
	next: NextFunction
): Promise<void> => {
	try {
		// Check if the request is authenticated by verifying the client account info
		if (!req.clientAccountInfo) {
			// If not authenticated, throw a "Unauthorized" error
			throw new AppError("Unauthorised", HttpStatusCodes.UNAUTHORIZED);
		}

		// Validate the incoming request data for missing or incorrect fields
		if (!validationResult(req).isEmpty()) {
			// If validation fails, throw a "Bad Request" error with details
			throw new AppError("Invalid request", HttpStatusCodes.BAD_REQUEST);
		}

		// Extract client account info and necessary parameters from the validated request body
		const clientAccountInfo = req.clientAccountInfo;
		const { highlightId, memoryId, sentTo, caption } =
			matchedData<OneToOneChatHighlightAttachmentUploadRequestParams>(req);

		// Call the service responsible for handling the attachment upload
		await oneToOneChatHighlightAttachmentService(
			sentTo, // The recipient of the highlight
			clientAccountInfo, // Information about the client sending the highlight
			memoryId, // The ID of the memory associated with the highlight
			highlightId, // The ID of the highlight being uploaded
			caption // Optional caption for the highlight attachment
		);

		// Respond with a 201 Created status indicating the successful upload of the highlight attachment
		res.sendStatus(HttpStatusCodes.CREATED);
	} catch (error) {
		// If any error occurs, pass it to the next middleware for error handling
		next(error);
	}
};
