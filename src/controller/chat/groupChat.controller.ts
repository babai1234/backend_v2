import { NextFunction, Request, Response } from "express";
import {
	AttchmentPresignRequestParams,
	CreateGroupChatRequestParams,
	CustomRequest,
	FilePresignRequestParams,
	GroupChatAccountAttachmentUploadRequestParams,
	GroupChatAudioAttachmentUploadRequestParams,
	GroupChatFileAttachmentUploadRequestParams,
	GroupChatHighlightAttachmentUploadRequestParams,
	GroupChatMemoryAttachmentUploadRequestParams,
	GroupChatPostAttachmentUploadRequestParams,
	GroupChatTextMessageUploadRequestParams,
	PresignResponseParams,
} from "../../types/util.type";
import {
	createGroupChatService,
	groupChatAccountAttachmentService,
	groupChatAudioAttachmentService,
	groupChatClipPostAttachmentService,
	groupChatFileAttachmentService,
	groupChatHighlightAttachmentService,
	groupChatMemoryAttachmentService,
	groupChatMomentPostAttachmentService,
	groupChatPhotoPostAttachmentService,
	groupChatTextUploadService,
} from "../../service/chat/groupChat.service";
import HttpStatusCodes from "../../constants/HttpStatusCodes";
import { matchedData, validationResult } from "express-validator";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client } from "../../utils/s3Client";
import { getGroupChatById } from "../../utils/dbUtils";
import { AppError } from "../../constants/appError";

/**
 * Handles the upload of a text message to a group chat.
 *
 * Validates the request, extracts the necessary data, and delegates
 * the processing to the service layer. Sends a `201 Created` status on success.
 *
 * @param {CustomRequest} req - The custom Express request object, expected to include client account info.
 * @param {Response} res - The Express response object.
 * @param {NextFunction} next - The next middleware function in the Express stack.
 * @returns {Promise<void>}
 *
 * @throws {AppError} Will throw if the user is not authorized or if the request is invalid.
 */
export const groupChatTextMessageUploadHandler = async (
	req: CustomRequest,
	res: Response,
	next: NextFunction
): Promise<void> => {
	try {
		// Ensure the client is authenticated and their account info is attached to the request
		if (!req.clientAccountInfo) {
			throw new AppError("Unauthorised", HttpStatusCodes.FORBIDDEN);
		}

		// Validate the incoming request using express-validator
		if (!validationResult(req).isEmpty()) {
			throw new AppError("Invalid request", HttpStatusCodes.BAD_REQUEST);
		}

		// Destructure validated request data
		const clientAccountInfo = req.clientAccountInfo;
		const { chatId, content, repliedInfo } =
			matchedData<GroupChatTextMessageUploadRequestParams>(req);

		// Delegate to the service responsible for processing and storing the message
		await groupChatTextUploadService(chatId, clientAccountInfo, content, repliedInfo);

		// Respond with 201 Created on successful upload
		res.sendStatus(HttpStatusCodes.CREATED);
	} catch (error) {
		// Pass any errors to the global error handler middleware
		next(error);
	}
};

/**
 * Handles the upload of file attachments to a group chat.
 *
 * Validates the request, extracts relevant parameters, and invokes the service layer
 * to store the files and any associated metadata (like caption). Returns a 201 status
 * code upon successful processing.
 *
 * @param {CustomRequest} req - The custom request object extended with client account info.
 * @param {Response} res - Express response object.
 * @param {NextFunction} next - Express next middleware function.
 * @returns {Promise<void>}
 *
 * @throws {AppError} Throws 403 if unauthorized or 400 if validation fails.
 */
export const groupChatFileAttachmentUploadHandler = async (
	req: CustomRequest,
	res: Response,
	next: NextFunction
): Promise<void> => {
	try {
		// Ensure the user is authenticated and has account information
		if (!req.clientAccountInfo) {
			throw new AppError("Unauthorised", HttpStatusCodes.FORBIDDEN);
		}

		// Validate incoming request against defined schema using express-validator
		if (!validationResult(req).isEmpty()) {
			throw new AppError("Invalid request", HttpStatusCodes.BAD_REQUEST);
		}

		// Extract authenticated user and validated parameters from request
		const clientAccountInfo = req.clientAccountInfo;
		const { chatId, fileDataList, caption } =
			matchedData<GroupChatFileAttachmentUploadRequestParams>(req);

		// Delegate file processing and storage to service layer
		await groupChatFileAttachmentService(
			chatId,
			clientAccountInfo,
			fileDataList,
			caption
		);

		// Respond with HTTP 201 Created on success
		res.sendStatus(HttpStatusCodes.CREATED);
	} catch (error) {
		// Forward any errors to global error handler
		next(error);
	}
};

/**
 * Handles the generation of presigned S3 URLs for uploading file attachments in a group chat.
 *
 * This endpoint ensures that the requester is authorized and a valid member of the specified group chat.
 * It validates input parameters and returns AWS S3 presigned URLs for both original files and their thumbnails.
 * Each URL is valid for 5 minutes.
 *
 * @param {CustomRequest} req - Custom request object containing client account info and validated data.
 * @param {Response} res - Express response object used to return the generated URLs.
 * @param {NextFunction} next - Express next middleware function to handle errors.
 * @returns {Promise<void>}
 *
 * @throws {AppError} - Throws 403 for unauthorized access, 400 for invalid input or chat ID, or if file name is malformed.
 */
export const groupChatFileAttachmentUploadPresignHandler = async (
	req: CustomRequest,
	res: Response,
	next: NextFunction
): Promise<void> => {
	try {
		// Ensure user is authenticated
		if (!req.clientAccountInfo) {
			throw new AppError("Unauthorised", HttpStatusCodes.FORBIDDEN);
		}

		// Validate request schema using express-validator
		if (!validationResult(req).isEmpty()) {
			throw new AppError("Invalid request", HttpStatusCodes.BAD_REQUEST);
		}

		// Extract authenticated user ID and validated request parameters
		const clientAccountId = req.clientAccountInfo._id.toString();
		const { attachmentPresignParams, sentTo } =
			matchedData<AttchmentPresignRequestParams>(req);

		// Fetch group chat to ensure the user is a participant
		const chatInfo = await getGroupChatById(sentTo, clientAccountId);
		if (!chatInfo) {
			throw new AppError("Invalid Chat Id", HttpStatusCodes.BAD_REQUEST);
		}

		// Check if requester is an active member of the group chat
		const isMember = chatInfo.participants.some(
			(member) => member.accountId.toString() === clientAccountId && member.isMember
		);
		if (!isMember) {
			throw new AppError("Failed to send message", HttpStatusCodes.FORBIDDEN);
		}

		const presignedUrls: PresignResponseParams[] = [];

		// Iterate over each file to generate presigned URLs for original and thumbnail uploads
		for (const param of attachmentPresignParams) {
			const [fileBaseName, fileExtension] = param.fileName.split(".");

			if (!fileBaseName || !fileExtension) {
				throw new AppError("Invalid file name", HttpStatusCodes.BAD_REQUEST);
			}

			// Hardcoded as JPEG thumbnails for now
			const mimeType = `image/jpeg`;

			// Define S3 object keys for original and thumbnail
			const originalFileKey = `attachment/${fileBaseName}/${param.fileName}`;
			const thumbnailFileKey = `attachment/${fileBaseName}/${fileBaseName}_thumbnail.jpg`;

			// Prepare S3 put object commands for both files
			const originalCommand = new PutObjectCommand({
				Bucket: process.env.AWS_S3_BUCKET_NAME,
				Key: originalFileKey,
				ContentType: `${param.mediaType}/${fileExtension}`,
			});

			const thumbnailCommand = new PutObjectCommand({
				Bucket: process.env.AWS_S3_BUCKET_NAME,
				Key: thumbnailFileKey,
				ContentType: mimeType,
			});

			// Generate both presigned URLs in parallel (valid for 5 minutes)
			const [originalPresignedUrl, thumbnailPresignedUrl] = await Promise.all([
				getSignedUrl(s3Client, originalCommand, { expiresIn: 300 }),
				getSignedUrl(s3Client, thumbnailCommand, { expiresIn: 300 }),
			]);

			// Store the generated URLs in the response array
			presignedUrls.push({
				original: originalPresignedUrl,
				thumbnail: thumbnailPresignedUrl,
			});
		}

		// Send the list of presigned URLs as the response
		res.status(HttpStatusCodes.OK).json({ presignedUrls });
	} catch (error) {
		console.error("An error occurred generating presigned URLs", error);
		next(error);
	}
};

/**
 * Handles the upload of a photo post attachment to a group chat.
 *
 * This endpoint verifies the user's authorization and request validity,
 * then delegates to a service to handle attaching a photo post to a group chat.
 *
 * @param {CustomRequest} req - The custom Express request containing validated data and user info.
 * @param {Response} res - The Express response object used to send the final status.
 * @param {NextFunction} next - The next middleware function used for error handling.
 * @returns {Promise<void>}
 *
 * @throws {AppError} - Throws 403 if unauthorized, 400 if request validation fails.
 */
export const groupChatPhotoPostAttachmentUploadHandler = async (
	req: CustomRequest,
	res: Response,
	next: NextFunction
): Promise<void> => {
	try {
		// Ensure that the user is authenticated
		if (!req.clientAccountInfo) {
			throw new AppError("Unauthorised", HttpStatusCodes.FORBIDDEN);
		}

		// Validate request body against expected schema
		if (!validationResult(req).isEmpty()) {
			throw new AppError("Invalid request", HttpStatusCodes.BAD_REQUEST);
		}

		// Extract authenticated user's info and validated request parameters
		const clientAccountInfo = req.clientAccountInfo;
		const { chatId, postId, caption } =
			matchedData<GroupChatPostAttachmentUploadRequestParams>(req);

		// Delegate to service function to handle the actual post attachment logic
		await groupChatPhotoPostAttachmentService(
			chatId,
			clientAccountInfo,
			postId,
			caption
		);

		// Respond with a 201 Created status if successful
		res.sendStatus(HttpStatusCodes.CREATED);
	} catch (error) {
		// Pass any thrown error to the error-handling middleware
		next(error);
	}
};

/**
 * Handles the upload of a "moment" post attachment to a group chat.
 *
 * This function performs authorization and request validation,
 * then delegates to a service responsible for attaching a moment post
 * (e.g., short video or ephemeral media) to a group chat thread.
 *
 * @param {CustomRequest} req - Custom Express request object including client account info and validated input data.
 * @param {Response} res - Express response object used to return the final status.
 * @param {NextFunction} next - Express next middleware function used for error propagation.
 * @returns {Promise<void>}
 *
 * @throws {AppError} - Throws 403 for unauthorized access and 400 for invalid request body.
 */
export const groupChatMomentPostAttachmentUploadHandler = async (
	req: CustomRequest,
	res: Response,
	next: NextFunction
): Promise<void> => {
	try {
		// Ensure the client making the request is authenticated
		if (!req.clientAccountInfo) {
			throw new AppError("Unauthorised", HttpStatusCodes.FORBIDDEN);
		}

		// Validate the request payload using express-validator
		if (!validationResult(req).isEmpty()) {
			throw new AppError("Invalid request", HttpStatusCodes.BAD_REQUEST);
		}

		// Extract client info and validated parameters
		const clientAccountInfo = req.clientAccountInfo;
		const { chatId, postId, caption } =
			matchedData<GroupChatPostAttachmentUploadRequestParams>(req);

		// Delegate to service to handle attaching the moment post to the chat
		await groupChatMomentPostAttachmentService(
			chatId,
			clientAccountInfo,
			postId,
			caption
		);

		// Respond with HTTP 201 Created if the operation succeeds
		res.sendStatus(HttpStatusCodes.CREATED);
	} catch (error) {
		// Pass any error to the global error handler middleware
		next(error);
	}
};

/**
 * Handles the upload of a clip post attachment to a group chat.
 *
 * This handler ensures the request is authenticated and valid,
 * then forwards the request to the clip post attachment service,
 * which is responsible for linking the clip post (e.g. short video content)
 * to the specified group chat conversation.
 *
 * @param {CustomRequest} req - Express request extended with client account info and validated input.
 * @param {Response} res - Express response object used to send the result.
 * @param {NextFunction} next - Express next middleware function to propagate errors.
 * @returns {Promise<void>}
 *
 * @throws {AppError} - Throws 403 if unauthorized or 400 if request validation fails.
 */
export const groupChatClipPostAttachmentUploadHandler = async (
	req: CustomRequest,
	res: Response,
	next: NextFunction
): Promise<void> => {
	try {
		// Ensure the client is authenticated
		if (!req.clientAccountInfo) {
			throw new AppError("Unauthorised", HttpStatusCodes.FORBIDDEN);
		}

		// Validate request body using express-validator
		if (!validationResult(req).isEmpty()) {
			throw new AppError("Invalid request", HttpStatusCodes.BAD_REQUEST);
		}

		// Extract client info and validated parameters from the request
		const clientAccountInfo = req.clientAccountInfo;
		const { chatId, postId, caption } =
			matchedData<GroupChatPostAttachmentUploadRequestParams>(req);

		// Call the service to attach the clip post to the group chat
		await groupChatClipPostAttachmentService(
			chatId,
			clientAccountInfo,
			postId,
			caption
		);

		// Respond with HTTP 201 Created on success
		res.sendStatus(HttpStatusCodes.CREATED);
	} catch (error) {
		// Forward any errors to the global error handler
		next(error);
	}
};

/**
 * Handles uploading an account attachment message in a group chat.
 *
 * This endpoint allows a user to send another user's account (e.g., as a contact card)
 * as an attachment message within a group chat. It validates authentication and input,
 * and delegates the business logic to the corresponding service.
 *
 * @param {CustomRequest} req - Custom Express request containing validated input and client account info.
 * @param {Response} res - Express response object used to send HTTP status.
 * @param {NextFunction} next - Express next function for error propagation.
 * @returns {Promise<void>} Sends HTTP 201 (Created) on success, or passes errors to middleware.
 *
 * @throws {AppError} - 403 if user is unauthorized, 400 if request validation fails.
 */
export const groupChatAccountAttachmentUploadHandler = async (
	req: CustomRequest,
	res: Response,
	next: NextFunction
): Promise<void> => {
	try {
		// Ensure the request is made by an authenticated client
		if (!req.clientAccountInfo) {
			throw new AppError("Unauthorised", HttpStatusCodes.FORBIDDEN);
		}

		// Validate request fields (e.g., chatId, accountId, caption)
		if (!validationResult(req).isEmpty()) {
			throw new AppError("Invalid request", HttpStatusCodes.BAD_REQUEST);
		}

		// Extract client identity and validated form data
		const clientAccountInfo = req.clientAccountInfo;
		const { accountId, chatId, caption } =
			matchedData<GroupChatAccountAttachmentUploadRequestParams>(req);

		// Delegate to service layer to process the account attachment message
		await groupChatAccountAttachmentService(
			chatId,
			clientAccountInfo,
			accountId,
			caption
		);

		// Respond with HTTP 201 Created upon successful upload
		res.sendStatus(HttpStatusCodes.CREATED);
	} catch (error) {
		// Forward error to Express error handler middleware
		next(error);
	}
};

/**
 * Handles uploading an audio message attachment in a group chat.
 *
 * This endpoint allows an authenticated user to send an audio file
 * (previously uploaded or recorded) as a message within a group chat.
 * It validates input, checks authorization, and invokes the corresponding service logic.
 *
 * @param {CustomRequest} req - Express request object containing client account info and validated fields.
 * @param {Response} res - Express response object used to send HTTP responses.
 * @param {NextFunction} next - Express middleware function for error handling.
 * @returns {Promise<void>} Sends HTTP 201 Created on success or passes error to next handler.
 *
 * @throws {AppError} - Throws 403 if unauthorized, 400 if request validation fails.
 */
export const groupChatAudioAttachmentUploadHandler = async (
	req: CustomRequest,
	res: Response,
	next: NextFunction
): Promise<void> => {
	try {
		// Ensure the user is authenticated
		if (!req.clientAccountInfo) {
			throw new AppError("Unauthorised", HttpStatusCodes.FORBIDDEN);
		}

		// Check for validation errors in the request
		if (!validationResult(req).isEmpty()) {
			throw new AppError("Invalid request", HttpStatusCodes.BAD_REQUEST);
		}

		// Extract authenticated user's account info
		const clientAccountInfo = req.clientAccountInfo;

		// Extract validated data from the request
		const { audioId, chatId, caption } =
			matchedData<GroupChatAudioAttachmentUploadRequestParams>(req);

		// Delegate the attachment upload logic to the service layer
		await groupChatAudioAttachmentService(
			chatId,
			clientAccountInfo,
			audioId,
			caption
		);

		// Respond with 201 Created on successful upload
		res.sendStatus(HttpStatusCodes.CREATED);
	} catch (error) {
		// Forward any errors to Express error handler middleware
		next(error);
	}
};

/**
 * Handles the upload of a memory attachment as a message in a group chat.
 *
 * This endpoint allows an authenticated user to attach an existing memory (such as a photo or video)
 * to a group chat conversation. It verifies the request and calls the service layer to process the upload.
 *
 * @param {CustomRequest} req - The Express request object, extended with client authentication info.
 * @param {Response} res - The Express response object used to return a success status.
 * @param {NextFunction} next - The next middleware function for centralized error handling.
 * @returns {Promise<void>} Returns nothing explicitly, but sends an HTTP 201 status on success.
 *
 * @throws {AppError} - Throws:
 *  - 403 if the user is not authenticated,
 *  - 400 if the request fails validation,
 *  - or forwards any other processing errors.
 */
export const groupChatMemoryAttachmentUploadHandler = async (
	req: CustomRequest,
	res: Response,
	next: NextFunction
): Promise<void> => {
	try {
		// Check if the request is authenticated
		if (!req.clientAccountInfo) {
			throw new AppError("Unauthorised", HttpStatusCodes.FORBIDDEN);
		}

		// Check for validation errors in the request payload
		if (!validationResult(req).isEmpty()) {
			throw new AppError("Invalid request", HttpStatusCodes.BAD_REQUEST);
		}

		// Extract authenticated account info
		const clientAccountInfo = req.clientAccountInfo;

		// Extract validated input fields from the request
		const { chatId, memoryId, caption } =
			matchedData<GroupChatMemoryAttachmentUploadRequestParams>(req);

		// Pass the request to the service function for processing
		await groupChatMemoryAttachmentService(
			chatId,
			clientAccountInfo,
			memoryId,
			caption
		);

		// Respond with HTTP 201 Created on success
		res.sendStatus(HttpStatusCodes.CREATED);
	} catch (error) {
		// Forward error to global error handler middleware
		next(error);
	}
};

/**
 * Handles the upload of a highlight attachment as a message in a group chat.
 *
 * This endpoint allows an authenticated user to attach a highlight (memory or media) to a group chat conversation.
 * The request is validated, and then the corresponding service is called to handle the upload and attachment process.
 *
 * @param {CustomRequest} req - The Express request object, extended with client authentication info.
 * @param {Response} res - The Express response object used to send the success response.
 * @param {NextFunction} next - The next middleware function to pass errors to the error handling middleware.
 * @returns {Promise<void>} Returns nothing explicitly, but sends an HTTP 201 status on success.
 *
 * @throws {AppError} - Throws:
 *  - 403 if the user is not authenticated,
 *  - 400 if the request is invalid,
 *  - or forwards any other errors that occur.
 */
export const groupChatHighlightAttachmentUploadHandler = async (
	req: CustomRequest,
	res: Response,
	next: NextFunction
): Promise<void> => {
	try {
		// Check if the request is authenticated
		if (!req.clientAccountInfo) {
			throw new AppError("Unauthorised", HttpStatusCodes.FORBIDDEN);
		}

		// Check if the incoming request payload is valid
		if (!validationResult(req).isEmpty()) {
			throw new AppError("Invalid request", HttpStatusCodes.BAD_REQUEST);
		}

		// Extract the authenticated user's account information
		const clientAccountInfo = req.clientAccountInfo;

		// Extract necessary parameters from the validated request
		const { chatId, highlightId, memoryId, caption } =
			matchedData<GroupChatHighlightAttachmentUploadRequestParams>(req);

		// Pass the request data to the service layer for processing
		await groupChatHighlightAttachmentService(
			chatId,
			clientAccountInfo,
			memoryId,
			highlightId,
			caption
		);

		// Respond with a 201 Created status code indicating the upload was successful
		res.sendStatus(HttpStatusCodes.CREATED);
	} catch (error) {
		// Forward any error to the global error handler
		next(error);
	}
};

/**
 * Handles the creation of a new group chat.
 *
 * This endpoint allows an authenticated user to create a new group chat, adding participants
 * and optionally setting a display picture. It validates the request, processes the group chat creation,
 * and responds with a status indicating success or failure.
 *
 * @param {CustomRequest} req - The Express request object, extended with client authentication info.
 * @param {Response} res - The Express response object used to send the success response.
 * @param {NextFunction} next - The next middleware function to handle errors.
 * @returns {Promise<void>} Returns nothing explicitly, but sends an HTTP 201 status on success.
 *
 * @throws {AppError} - Throws:
 *  - 403 if the user is not authenticated,
 *  - 400 if the request is invalid,
 *  - or forwards any other errors that occur.
 */
export const createGroupChatHandler = async (
	req: CustomRequest,
	res: Response,
	next: NextFunction
): Promise<void> => {
	try {
		// Check if the request is authenticated by verifying the client account info
		if (!req.clientAccountInfo) {
			throw new AppError("Unauthorised", HttpStatusCodes.FORBIDDEN);
		}

		// Validate the request to ensure the required fields are present and correct
		if (!validationResult(req).isEmpty()) {
			// Log validation errors for debugging purposes
			console.error(validationResult(req).array());

			// Throw an error if the validation fails
			throw new AppError("Invalid request", HttpStatusCodes.BAD_REQUEST);
		}

		// Extract the authenticated user's account info
		const clientAccountInfo = req.clientAccountInfo;

		// Destructure the necessary fields from the validated request data
		const { name, participantIdList, displayPicture } =
			matchedData<CreateGroupChatRequestParams>(req);

		// Call the service to create the group chat with the provided data
		await createGroupChatService(
			clientAccountInfo,
			participantIdList,
			name,
			displayPicture
		);

		// Respond with a 201 Created status indicating the chat was successfully created
		res.sendStatus(HttpStatusCodes.CREATED);
	} catch (error) {
		// Forward any errors to the error handling middleware
		next(error);
	}
};

/**
 * Generates a presigned URL for uploading a display picture to an S3 bucket.
 *
 * This handler is used to generate a presigned URL that allows clients to directly upload a display picture
 * to AWS S3. The presigned URL is valid for a limited time (5 minutes) and is associated with the file
 * name and media type provided by the client.
 *
 * @param {CustomRequest} req - The Express request object, extended with client authentication info.
 * @param {Response} res - The Express response object used to send the presigned URL.
 * @param {NextFunction} next - The next middleware function to handle errors.
 * @returns {Promise<void>} Returns nothing explicitly, but sends the presigned URL for the file upload.
 *
 * @throws {AppError} - Throws:
 *  - 403 if the user is not authenticated,
 *  - 400 if the request is invalid,
 *  - or forwards any other errors that occur.
 */
export const groupChatDisplayPictureUploadPresignHandler = async (
	req: CustomRequest,
	res: Response,
	next: NextFunction
): Promise<void> => {
	try {
		// Check if the request is authenticated by verifying the client account info
		if (!req.clientAccountInfo) {
			// If not authenticated, throw a "Forbidden" error
			throw new AppError("Unauthorised", HttpStatusCodes.FORBIDDEN);
		}

		// Validate the incoming request payload for required fields
		if (!validationResult(req).isEmpty()) {
			// If validation fails, throw a "Bad Request" error
			throw new AppError("Invalid request", HttpStatusCodes.BAD_REQUEST);
		}

		// Extract the file name and media type from the validated request data
		const { fileName, mediaType } = matchedData<FilePresignRequestParams>(req);

		// Split the file name into base name and extension to validate the file format
		const [fileBaseName, fileExtension] = fileName.split(".");

		// If the file name is not valid (missing base name or extension), throw an error
		if (!fileBaseName || !fileExtension) {
			throw new Error(`Invalid file name: ${fileName}`);
		}

		// Construct the key for storing the original file in the S3 bucket
		const originalFileKey = `displayPicture/${fileBaseName}/${fileName}`;

		// Create a PutObjectCommand to upload the file to S3 with the specified media type
		const originalCommand = new PutObjectCommand({
			Bucket: process.env.AWS_S3_BUCKET_NAME, // Bucket name from environment variable
			Key: originalFileKey, // S3 object key
			ContentType: `${mediaType}/${fileExtension}`, // File content type (e.g., image/jpeg)
		});

		// Generate a presigned URL for the original file upload, valid for 5 minutes
		const originalPresignedUrl = await getSignedUrl(s3Client, originalCommand, {
			expiresIn: 300, // Presigned URL expiry time in seconds (5 minutes)
		});

		// Respond with the presigned URL for uploading the display picture
		res.status(HttpStatusCodes.OK).json(originalPresignedUrl);
	} catch (error) {
		// If an error occurs, pass it to the error handling middleware
		next(error);
	}
};
