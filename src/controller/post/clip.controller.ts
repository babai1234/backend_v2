import { NextFunction, Request, Response } from "express";
import { matchedData, validationResult } from "express-validator";
import {
	ClipPostUploadParams,
	CustomRequest,
	PostCommentUploadParams,
	PostRetryUploadParams,
	PresignResponseParams,
} from "../../types/util.type";
import {
	clipPostCommentUploadService,
	clipPostUploadService,
} from "../../service/post/clip.service";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { s3Client } from "../../utils/s3Client";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { postRetryUploadService } from "../../service/post/moment.service";
import { AppError } from "../../constants/appError";
import HttpStatusCodes from "../../constants/HttpStatusCodes";

/**
 * Handles the upload of a clip post by an authenticated user.
 *
 * This controller:
 * - Verifies user authentication
 * - Validates the incoming request
 * - Extracts sanitized clip post metadata
 * - Calls the service layer to process and store the post
 *
 * @param {CustomRequest} req - Express request object extended with clientAccountInfo and validated body.
 * @param {Response} res - Express response object used to send status or data.
 * @param {NextFunction} next - Express next middleware function for error handling.
 * @returns {Promise<void>} Responds with 200 on success, otherwise forwards the error.
 *
 * @throws {AppError} If authentication is missing, request validation fails, or service call throws.
 */
export const clipPostUploadHandler = async (
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

		// Extract validated and sanitized request parameters
		const clipPostMetadata = matchedData<ClipPostUploadParams>(req);

		// Call the service layer to handle the clip post upload logic
		await clipPostUploadService(clipPostMetadata, req.clientAccountInfo);

		// Respond with success message
		res.status(200).send("Post uploaded successfully!");
	} catch (error) {
		// Pass any error to the error handling middleware
		next(error);
	}
};

/**
 * Handles retrying a previously failed clip post upload.
 *
 * This controller:
 * - Ensures the user is authenticated
 * - Validates the request input
 * - Extracts the job ID of the failed post
 * - Triggers a retry of the upload via the service layer
 *
 * @param {CustomRequest} req - Extended Express request object that includes client account info.
 * @param {Response} res - Express response object used to send the success response.
 * @param {NextFunction} next - Express next middleware function used for forwarding errors.
 * @returns {Promise<void>} Returns nothing but sends a 200 status on success.
 *
 * @throws {AppError} If authentication or validation fails, or service layer throws an error.
 */
export const clipPostRetryUploadHandler = async (
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

		// Extract sanitized jobId from the validated request data
		const { jobId } = matchedData<PostRetryUploadParams>(req);

		// Call the service function to retry the post upload with the given job ID
		await postRetryUploadService(jobId);

		// Respond with a success message
		res.status(200).send("Post uploaded successfully!");
	} catch (error) {
		// Log and pass any error to the next error-handling middleware
		console.error(error);
		next(error);
	}
};

/**
 * Handles the upload of a comment on a clip post.
 *
 * This controller performs the following:
 * - Checks user authentication
 * - Validates incoming request data
 * - Extracts post ID, comment text, and optional replied-to comment ID
 * - Invokes the service layer to store the comment
 * - Returns a success response on completion
 *
 * @param {CustomRequest} req - Extended request object containing client account info and request body.
 * @param {Response} res - Express response object used to send status and messages.
 * @param {NextFunction} next - Express middleware function to pass errors to the error handler.
 * @returns {Promise<void>} Responds with HTTP 201 on success or forwards an error.
 */
export const clipPostCommentUploadHandler = async (
	req: CustomRequest,
	res: Response,
	next: NextFunction
): Promise<void> => {
	try {
		// Ensure the user is authenticated
		if (!req.clientAccountInfo) {
			throw new AppError("Unauthorised", HttpStatusCodes.UNAUTHORIZED);
		}

		// Validate the request using express-validator
		if (!validationResult(req).isEmpty()) {
			throw new AppError("Invalid request", HttpStatusCodes.BAD_REQUEST);
		}

		// Extract sanitized parameters from the request
		const { postId, comment, repliedTo } = matchedData<PostCommentUploadParams>(req);

		// Call the service function to handle uploading the comment
		await clipPostCommentUploadService(
			postId,
			comment,
			req.clientAccountInfo,
			repliedTo
		);

		// Respond with success
		res.status(201).send("Comment uploaded successfully!");
	} catch (error) {
		// Pass any error to the next middleware for centralized handling
		next(error);
	}
};

/**
 * Handles generation of presigned S3 URLs for uploading a clip post and its thumbnail.
 *
 * This endpoint ensures the user is authenticated, validates the incoming request,
 * and returns temporary S3 URLs (valid for 5 minutes) for both the original video file
 * and its JPEG thumbnail. Filenames are derived from the provided `postFileName`.
 *
 * @param {CustomRequest} req - Extends Express Request with clientAccountInfo and validated body.
 * @param {Response} res - Express Response object used to send back JSON containing presigned URLs.
 * @param {NextFunction} next - Express NextFunction for forwarding errors to the global handler.
 * @returns {Promise<void>} Sends HTTP 200 with `{ presignedUrls: PresignResponseParams[] }` on success.
 *
 * @throws {AppError} - Throws 401 if unauthorized, 400 if validation fails or filename is malformed.
 */
export const clipPostUploadPresignHandler = async (
	req: CustomRequest,
	res: Response,
	next: NextFunction
): Promise<void> => {
	try {
		// Ensure the request is made by an authenticated user
		if (!req.clientAccountInfo) {
			throw new AppError("Unauthorised", HttpStatusCodes.UNAUTHORIZED);
		}

		// Validate request payload for required fields
		if (!validationResult(req).isEmpty()) {
			throw new AppError("Invalid request", HttpStatusCodes.BAD_REQUEST);
		}

		// Extract the requested file name from the validated request data
		const { postFileName } = matchedData<{ postFileName: string }>(req);
		const presignedUrls: PresignResponseParams[] = [];

		// Split file name into base name and extension (e.g., "video.mp4" -> ["video", "mp4"])
		const [fileBaseName, fileExtension] = postFileName.split(".");

		// If filename is missing base name or extension, reject as bad request
		if (!fileBaseName || !fileExtension) {
			throw new AppError("Invalid request", HttpStatusCodes.BAD_REQUEST);
		}

		// Construct S3 object keys for the original video and its thumbnail
		const originalFileKey = `clip/${fileBaseName}/${postFileName}`;
		const thumbnailFileKey = `clip/${fileBaseName}/${fileBaseName}_thumbnail.jpeg`;

		// Prepare S3 PutObject commands for both original and thumbnail uploads
		const originalCommand = new PutObjectCommand({
			Bucket: process.env.AWS_S3_BUCKET_NAME,
			Key: originalFileKey,
			ContentType: `video/mp4`, // Assuming .mp4 video files
		});

		const thumbnailCommand = new PutObjectCommand({
			Bucket: process.env.AWS_S3_BUCKET_NAME,
			Key: thumbnailFileKey,
			ContentType: "image/jpeg", // Thumbnails always JPEG
		});

		// Generate presigned URLs in parallel, each valid for 300 seconds (5 minutes)
		const [originalPresignedUrl, thumbnailPresignedUrl] = await Promise.all([
			getSignedUrl(s3Client, originalCommand, { expiresIn: 300 }),
			getSignedUrl(s3Client, thumbnailCommand, { expiresIn: 300 }),
		]);

		// Collect both URLs into the response array
		presignedUrls.push({
			original: originalPresignedUrl,
			thumbnail: thumbnailPresignedUrl,
		});

		// Send the presigned URLs back to the client
		res.status(HttpStatusCodes.OK).json({ presignedUrls });
	} catch (error) {
		// Log unexpected errors for debugging
		console.error("An error occurred generating presigned URLs", error);
		// Forward the error to centralized error-handling middleware
		next(error);
	}
};
