import { NextFunction, Request, Response } from "express";
import { matchedData, validationResult } from "express-validator";
import {
	CustomRequest,
	PostRetryUploadParams,
	MomentPostUploadParams,
	PresignResponseParams,
	PostCommentUploadParams,
} from "../../types/util.type";
import {
	momentPostCommentUploadService,
	momentPostUploadService,
	postRetryUploadService,
} from "../../service/post/moment.service";
import { s3Client } from "../../utils/s3Client";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { AppError } from "../../constants/appError";
import HttpStatusCodes from "../../constants/HttpStatusCodes";

/**
 * Handles the uploading of a moment post.
 *
 * This endpoint allows a user to upload a moment post by providing metadata. It ensures the user is authenticated,
 * validates the request data, and forwards the relevant data to the service layer for processing.
 * If the post upload is successful, a 200 status code is returned indicating the post was uploaded successfully.
 *
 * @param {CustomRequest} req - Extends Express Request with clientAccountInfo and validated body.
 * @param {Response} res - Express Response object used to send a success message after uploading the post.
 * @param {NextFunction} next - Express NextFunction for forwarding errors to the global error handler.
 * @returns {Promise<void>} Sends HTTP 200 with a success message when the post is uploaded successfully.
 *
 * @throws {AppError} - Throws 401 if the user is not authenticated, 400 if validation fails on request data.
 */
export const momentPostUploadHandler = async (
	req: CustomRequest,
	res: Response,
	next: NextFunction
): Promise<void> => {
	try {
		// Ensure the user is authenticated before proceeding
		if (!req.clientAccountInfo) {
			throw new AppError("Unauthorised", HttpStatusCodes.UNAUTHORIZED);
		}

		// Validate the request body to ensure it meets the expected format
		if (!validationResult(req).isEmpty()) {
			throw new AppError("Invalid request", HttpStatusCodes.BAD_REQUEST);
		}

		// Extract moment post metadata from the validated request body
		const momentPostMetadata = matchedData<MomentPostUploadParams>(req);

		// Call the service layer to handle the post upload logic
		await momentPostUploadService(momentPostMetadata, req.clientAccountInfo);

		// Send HTTP 200 status indicating the post was uploaded successfully
		res.status(200).send("Post uploaded successfully!");
	} catch (error) {
		// Forward any errors to the global error handler
		next(error);
	}
};

/**
 * Handles the uploading of a comment on a moment post.
 *
 * This endpoint allows a user to upload a comment on a specific moment post. It ensures the user is authenticated,
 * validates the incoming request, and forwards the relevant data to the service layer for processing.
 * If the comment upload is successful, a 201 status code is returned indicating the comment was created.
 *
 * @param {CustomRequest} req - Extends Express Request with clientAccountInfo and validated body.
 * @param {Response} res - Express Response object used to send a success message after uploading the comment.
 * @param {NextFunction} next - Express NextFunction for forwarding errors to the global handler.
 * @returns {Promise<void>} Sends HTTP 201 with success message when the comment is uploaded successfully.
 *
 * @throws {AppError} - Throws 401 if the user is not authenticated, 400 if validation fails on request data.
 */
export const momentPostCommentUploadHandler = async (
	req: CustomRequest,
	res: Response,
	next: NextFunction
): Promise<void> => {
	try {
		// Ensure the user is authenticated before proceeding
		if (!req.clientAccountInfo) {
			throw new AppError("Unauthorised", HttpStatusCodes.UNAUTHORIZED);
		}

		// Validate request data to ensure it's in the expected format
		if (!validationResult(req).isEmpty()) {
			throw new AppError("Invalid request", HttpStatusCodes.BAD_REQUEST);
		}

		// Extract relevant data (postId, comment, and repliedTo information) from the request
		const { postId, comment, repliedTo } = matchedData<PostCommentUploadParams>(req);

		// Call the service layer function to handle the comment upload
		await momentPostCommentUploadService(
			postId,
			comment,
			req.clientAccountInfo,
			repliedTo
		);

		// Send HTTP 201 status indicating the comment was uploaded successfully
		res.status(201).send("Comment uploaded successfully!");
	} catch (error) {
		// Forward any errors to the global error handler
		next(error);
	}
};

/**
 * Handles retrying the upload of a moment post.
 *
 * This endpoint allows a user to retry uploading a moment post based on the provided job ID. It ensures the user is authenticated,
 * validates the request data, and forwards the job ID to the service layer for processing the retry logic.
 * If the post retry is successful, a 200 status code is returned indicating the post upload was retried successfully.
 *
 * @param {CustomRequest} req - Extends Express Request with clientAccountInfo and validated body.
 * @param {Response} res - Express Response object used to send a success message after retrying the post upload.
 * @param {NextFunction} next - Express NextFunction for forwarding errors to the global error handler.
 * @returns {Promise<void>} Sends HTTP 200 with a success message when the post upload retry is successful.
 *
 * @throws {AppError} - Throws 401 if the user is not authenticated, 400 if validation fails on request data.
 */
export const momentPostRetryUploadHandler = async (
	req: CustomRequest,
	res: Response,
	next: NextFunction
): Promise<void> => {
	try {
		// Ensure the user is authenticated before proceeding
		if (!req.clientAccountInfo) {
			throw new AppError("Unauthorised", HttpStatusCodes.UNAUTHORIZED);
		}

		// Validate the request body to ensure it meets the expected format
		if (!validationResult(req).isEmpty()) {
			throw new AppError("Invalid request", HttpStatusCodes.BAD_REQUEST);
		}

		// Extract jobId from the validated request body
		const { jobId } = matchedData<PostRetryUploadParams>(req);

		// Call the service layer function to retry the post upload based on the provided job ID
		await postRetryUploadService(jobId);

		// Send HTTP 200 status indicating the post upload retry was successful
		res.status(200).send("Post uploaded successfully!");
	} catch (error) {
		// Log the error and forward it to the global error handler
		console.error(error);
		next(error);
	}
};

/**
 * Handles the generation of presigned URLs for uploading a moment post (video and thumbnail) to AWS S3.
 *
 * This endpoint allows a user to obtain presigned URLs to upload both the original video and its thumbnail image to
 * an AWS S3 bucket. The request must include the file name of the post, and the server will generate presigned URLs
 * for both the original video and its thumbnail, allowing the client to upload these files directly to S3.
 * If successful, it returns the presigned URLs for both files.
 *
 * @param {CustomRequest} req - Extends Express Request with clientAccountInfo and validated body.
 * @param {Response} res - Express Response object used to return the presigned URLs for the post upload.
 * @param {NextFunction} next - Express NextFunction for forwarding errors to the global error handler.
 * @returns {Promise<void>} Sends HTTP 200 with the presigned URLs for both the original video and its thumbnail.
 *
 * @throws {AppError} - Throws 401 if the user is not authenticated, 400 if validation fails or invalid file name is provided.
 */
export const momentPostUploadPresignHandler = async (
	req: CustomRequest,
	res: Response,
	next: NextFunction
): Promise<void> => {
	try {
		// Ensure the user is authenticated before proceeding
		if (!req.clientAccountInfo) {
			throw new AppError("Unauthorised", HttpStatusCodes.UNAUTHORIZED);
		}

		// Validate the request body to ensure it meets the expected format
		if (!validationResult(req).isEmpty()) {
			throw new AppError("Invalid request", HttpStatusCodes.BAD_REQUEST);
		}

		// Extract postFileName from the validated request body
		const { postFileName } = matchedData<{ postFileName: string }>(req);
		const presignedUrls: PresignResponseParams[] = [];

		// Extract the base name and file extension from the file name
		const [fileBaseName, fileExtension] = postFileName.split(".");

		// If the file name or extension is invalid, throw an error
		if (!fileBaseName || !fileExtension) {
			throw new AppError("Invalid request", HttpStatusCodes.BAD_REQUEST);
		}

		// Define the S3 keys for the original file and the thumbnail
		const originalFileKey = `moment/${fileBaseName}/${postFileName}`;
		const thumbnailFileKey = `moment/${fileBaseName}/${fileBaseName}_thumbnail.jpeg`;

		// Define the S3 commands for uploading the original file and the thumbnail
		const originalCommand = new PutObjectCommand({
			Bucket: process.env.AWS_S3_BUCKET_NAME,
			Key: originalFileKey,
			ContentType: `video/mp4`, // Setting content type for video
		});

		const thumbnailCommand = new PutObjectCommand({
			Bucket: process.env.AWS_S3_BUCKET_NAME,
			Key: thumbnailFileKey,
			ContentType: "image/jpeg", // Setting content type for the thumbnail
		});

		// Get the presigned URLs for both the original file and the thumbnail
		const [originalPresignedUrl, thumbnailPresignedUrl] = await Promise.all([
			getSignedUrl(s3Client, originalCommand, { expiresIn: 300 }), // 5 min expiry for the original file
			getSignedUrl(s3Client, thumbnailCommand, { expiresIn: 300 }), // 5 min expiry for the thumbnail
		]);

		// Store the presigned URLs in an array
		presignedUrls.push({
			original: originalPresignedUrl,
			thumbnail: thumbnailPresignedUrl,
		});

		// Send the presigned URLs as a response
		res.status(200).json({ presignedUrls });
	} catch (error) {
		// Forward the error to the global error handler
		next(error);
	}
};
