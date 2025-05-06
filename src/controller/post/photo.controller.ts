import { NextFunction, Request, Response } from "express";
import { matchedData, validationResult } from "express-validator";
import {
	CustomRequest,
	PhotoPostUploadParams,
	PostCommentUploadParams,
	PostPresignRequestParams,
	PresignResponseParams,
} from "../../types/util.type";
import {
	photoPostCommentUploadService,
	photoPostUploadService,
} from "../../service/post/photo.service";
import { s3Client } from "../../utils/s3Client";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { AppError } from "../../constants/appError";
import HttpStatusCodes from "../../constants/HttpStatusCodes";

/**
 * Handles the upload of a photo post.
 *
 * This endpoint is used for uploading a photo post, validating the request, and passing the metadata
 * to the service layer for processing. If the user is not authenticated or if the request is invalid,
 * an error is thrown. Upon successful upload, a response with a success message is sent.
 *
 * @param {CustomRequest} req - The request object extending Express Request with clientAccountInfo and validated body.
 * @param {Response} res - Express Response object used to send a success message after post upload.
 * @param {NextFunction} next - Express NextFunction to forward errors to the global error handler.
 * @returns {Promise<void>} Sends an HTTP 201 status with a success message if the photo post is uploaded successfully.
 *
 * @throws {AppError} - Throws 401 if the user is not authenticated, 400 if validation fails or invalid data is provided.
 */
export const photoPostUploadHandler = async (
	req: CustomRequest,
	res: Response,
	next: NextFunction
): Promise<void> => {
	try {
		// Ensure the user is authenticated
		if (!req.clientAccountInfo) {
			throw new AppError("Unauthorised", HttpStatusCodes.UNAUTHORIZED);
		}

		// Validate the request body to ensure it is correctly formatted
		if (!validationResult(req).isEmpty()) {
			throw new AppError("Invalid request", HttpStatusCodes.BAD_REQUEST);
		}

		// Extract the metadata for the photo post from the validated request body
		const photoPostMetadata = matchedData<PhotoPostUploadParams>(req);

		// Call the service layer to handle the actual photo post upload logic
		await photoPostUploadService(photoPostMetadata, req.clientAccountInfo);

		// Send a success response after the post is uploaded
		res.status(201).send("Post uploaded successfully!");
	} catch (error) {
		// Pass any errors to the global error handler
		next(error);
	}
};

/**
 * Handles the upload of a comment on a photo post.
 *
 * This endpoint validates the request to ensure the user is authenticated and the request data is valid.
 * It extracts the necessary comment data and calls the service layer function to upload the comment on the specified photo post.
 * Upon successful upload, a success message is returned. If any validation or errors occur, the request is rejected.
 *
 * @param {CustomRequest} req - The request object, containing client account info and validated body data.
 * @param {Response} res - Express Response object used to send a success message after uploading the comment.
 * @param {NextFunction} next - Express NextFunction used to pass errors to the global error handler.
 * @returns {Promise<void>} Sends an HTTP 201 status with a success message upon successful comment upload.
 *
 * @throws {AppError} - Throws 401 if the user is not authenticated, 400 if validation fails or invalid data is provided.
 */
export const photoPostCommentUploadHandler = async (
	req: CustomRequest,
	res: Response,
	next: NextFunction
): Promise<void> => {
	try {
		// Ensure the user is authenticated
		if (!req.clientAccountInfo) {
			throw new AppError("Unauthorised", HttpStatusCodes.UNAUTHORIZED);
		}

		// Validate the request body to ensure it is correctly formatted
		if (!validationResult(req).isEmpty()) {
			throw new AppError("Invalid request", HttpStatusCodes.BAD_REQUEST);
		}

		// Extract the post ID, comment, and optional replied-to information from the request body
		const { postId, comment, repliedTo } = matchedData<PostCommentUploadParams>(req);

		// Call the service layer to handle the actual upload of the comment on the photo post
		await photoPostCommentUploadService(
			postId,
			comment,
			req.clientAccountInfo,
			repliedTo
		);

		// Send a success response after the comment is uploaded
		res.status(201).send("Comment uploaded successfully!");
	} catch (error) {
		// Pass any errors to the global error handler
		next(error);
	}
};

/**
 * Handles the generation of presigned URLs for uploading a photo post and its thumbnail.
 *
 * This endpoint generates presigned URLs for uploading both the original photo and its thumbnail to S3.
 * It accepts a list of file names, splits each file name to derive the base name and extension, and generates the appropriate
 * presigned URLs for each file. The URLs are valid for 5 minutes, allowing the client to upload the files directly to S3.
 *
 * @param {CustomRequest} req - The request object, containing client account info and a list of file names to be uploaded.
 * @param {Response} res - Express Response object used to send back the generated presigned URLs for each photo.
 * @param {NextFunction} next - Express NextFunction used to pass errors to the global error handler.
 * @returns {Promise<void>} Sends a 200 response with a JSON object containing the presigned URLs for the original photo and thumbnail.
 *
 * @throws {AppError} - Throws 401 if the user is not authenticated, 400 if the request is invalid (e.g., missing file name or extension).
 */
export const photoPostUploadPresignHandler = async (
	req: CustomRequest,
	res: Response,
	next: NextFunction
): Promise<void> => {
	try {
		// Ensure the user is authenticated
		if (!req.clientAccountInfo) {
			throw new AppError("Unauthorised", HttpStatusCodes.UNAUTHORIZED);
		}

		// Validate the request body to ensure it is correctly formatted
		if (!validationResult(req).isEmpty()) {
			throw new AppError("Invalid request", HttpStatusCodes.BAD_REQUEST);
		}

		// Extract the list of file names for the post files
		const { postFileName } = matchedData<PostPresignRequestParams>(req);

		// Initialize an array to hold the presigned URLs
		const presignedUrls: PresignResponseParams[] = [];

		// Iterate over each file name provided in the request
		for (const fileName of postFileName) {
			// Split the file name to get the base name and file extension
			const [fileBaseName, fileExtension] = fileName.split(".");

			// Ensure the file name and extension are valid
			if (!fileBaseName || !fileExtension) {
				throw new AppError("Invalid request", HttpStatusCodes.BAD_REQUEST);
			}

			// Define the mime type for the photo file
			const mimeType = `image/${fileExtension}`;

			// Define the S3 keys for the original photo and its thumbnail
			const originalFileKey = `photo/${fileBaseName}/${fileName}`;
			const thumbnailFileKey = `photo/${fileBaseName}/${fileBaseName}_thumbnail.${fileExtension}`;

			// Create commands to generate presigned URLs for both the original photo and the thumbnail
			const originalCommand = new PutObjectCommand({
				Bucket: process.env.AWS_S3_BUCKET_NAME,
				Key: originalFileKey,
				ContentType: mimeType,
			});

			const thumbnailCommand = new PutObjectCommand({
				Bucket: process.env.AWS_S3_BUCKET_NAME,
				Key: thumbnailFileKey,
				ContentType: mimeType,
			});

			// Generate presigned URLs for both the original file and its thumbnail
			const [originalPresignedUrl, thumbnailPresignedUrl] = await Promise.all([
				getSignedUrl(s3Client, originalCommand, { expiresIn: 300 }), // 5 min expiry for original file
				getSignedUrl(s3Client, thumbnailCommand, { expiresIn: 300 }), // 5 min expiry for thumbnail
			]);

			// Add the generated URLs to the presignedUrls array
			presignedUrls.push({
				original: originalPresignedUrl,
				thumbnail: thumbnailPresignedUrl,
			});
		}

		// Send the presigned URLs in the response
		res.status(200).json({ presignedUrls });
	} catch (error) {
		// Pass any errors to the global error handler
		next(error);
	}
};
