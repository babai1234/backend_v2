import { NextFunction, Request, Response } from "express";
import { matchedData, validationResult } from "express-validator";
import {
	CustomRequest,
	FilePresignRequestParams,
	MemoryUploadParams,
	PresignResponseParams,
} from "../../types/util.type";
import { memoryUploadService } from "../../service/memory/memory.service";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { s3Client } from "../../utils/s3Client";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { AppError } from "../../constants/appError";
import HttpStatusCodes from "../../constants/HttpStatusCodes";

/**
 * Handles the upload of a memory (user-generated content such as photos, videos, or notes).
 *
 * This function ensures that the user is authenticated, validates the incoming request,
 * extracts the necessary metadata, and delegates the upload logic to the `memoryUploadService`.
 * It returns a success message upon successful upload or forwards any errors to the error middleware.
 *
 * @param {CustomRequest} req - Extended Express request object containing client authentication and memory metadata.
 * @param {Response} res - Express response object used to send the response.
 * @param {NextFunction} next - Express middleware function to pass control to the next error handler.
 * @returns {Promise<void>} Returns nothing but sends an HTTP response or propagates an error.
 *
 * @throws {AppError} - Thrown if the user is not authenticated, the request is invalid, or an internal error occurs.
 */
export const memoryUploadHandler = async (
	req: CustomRequest,
	res: Response,
	next: NextFunction
): Promise<void> => {
	try {
		// Ensure the user is authenticated
		if (!req.clientAccountInfo) {
			throw new AppError("Unauthorised", HttpStatusCodes.UNAUTHORIZED);
		}

		// Validate request parameters using express-validator
		if (!validationResult(req).isEmpty()) {
			throw new AppError("Invalid request", HttpStatusCodes.BAD_REQUEST);
		}

		// Extract validated metadata about the memory from the request
		const metadata = matchedData<MemoryUploadParams>(req);

		// Delegate actual upload logic to the service layer
		await memoryUploadService(metadata, req.clientAccountInfo);

		// Respond with success message upon successful upload
		res.status(201).send("Memory uploaded successfully!");
	} catch (error) {
		// Forward any errors to the centralized error handler
		next(error);
	}
};

/**
 * Handles generation of presigned S3 URLs for memory uploads.
 *
 * This endpoint allows authenticated users to obtain temporary, secure S3 URLs for uploading
 * original memory files and their corresponding thumbnail versions.
 * It ensures request validation, validates file naming, and returns presigned URLs
 * for both the original and thumbnail uploads.
 *
 * @param {CustomRequest} req - The request object containing the authenticated client and presign parameters.
 * @param {Response} res - The response object used to send back the presigned URLs.
 * @param {NextFunction} next - Express middleware function used to forward errors.
 * @returns {Promise<void>} A promise that resolves with a 200 response or propagates an error.
 *
 * @throws {AppError} If the user is unauthorized, the request is invalid, or file naming is malformed.
 */
export const memoryUploadPresignHandler = async (
	req: CustomRequest,
	res: Response,
	next: NextFunction
): Promise<void> => {
	try {
		// Ensure the user is authenticated
		if (!req.clientAccountInfo) {
			throw new AppError("Unauthorised", HttpStatusCodes.UNAUTHORIZED);
		}

		// Validate the request payload using express-validator
		if (!validationResult(req).isEmpty()) {
			throw new AppError("Invalid request", HttpStatusCodes.BAD_REQUEST);
		}

		// Extract validated input parameters
		const { fileName, mediaType } = matchedData<FilePresignRequestParams>(req);

		// Split the file name into base name and extension
		const [fileBaseName, fileExtension] = fileName.split(".");

		// Ensure the filename is well-formed
		if (!fileBaseName || !fileExtension) {
			throw new AppError("Invalid request", HttpStatusCodes.BAD_REQUEST);
		}

		// Define S3 object keys and MIME types
		const mimeType = `image/jpeg`;
		const originalFileKey = `memory/${fileBaseName}/${fileName}`;
		const thumbnailFileKey = `memory/${fileBaseName}/${fileBaseName}_thumbnail.jpg`;

		// Create S3 commands to upload original file and thumbnail
		const originalCommand = new PutObjectCommand({
			Bucket: process.env.AWS_S3_BUCKET_NAME,
			Key: originalFileKey,
			ContentType: `${mediaType}/${fileExtension}`,
		});

		const thumbnailCommand = new PutObjectCommand({
			Bucket: process.env.AWS_S3_BUCKET_NAME,
			Key: thumbnailFileKey,
			ContentType: mimeType,
		});

		// Generate presigned URLs for both commands (valid for 5 minutes)
		const [originalPresignedUrl, thumbnailPresignedUrl] = await Promise.all([
			getSignedUrl(s3Client, originalCommand, { expiresIn: 300 }),
			getSignedUrl(s3Client, thumbnailCommand, { expiresIn: 300 }),
		]);

		// Construct response object with both URLs
		const presignedUrl: PresignResponseParams = {
			original: originalPresignedUrl,
			thumbnail: thumbnailPresignedUrl,
		};

		// Return the generated presigned URLs to the client
		res.status(200).json(presignedUrl);
	} catch (error) {
		// Forward any error to the error handling middleware
		next(error);
	}
};
