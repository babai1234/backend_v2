import {
	FileMetadata,
	ImageFile,
	VideoFile,
	PhotoWithPreview,
	PostFileParams,
	FileAttachmentInfo,
} from "../types/util.type";
import { stopWords } from "./stopWords";
import {
	CreateJobCommandInput,
	MediaConvertClient,
	Output,
} from "@aws-sdk/client-mediaconvert";
import { ClipJobTemplate, MomentJobTemplate } from "../constants/constant";
import { AppError } from "../constants/appError";
import HttpStatusCodes from "../constants/HttpStatusCodes";

// ----------------------------------------------------- File Attachment ---------------------------------------------------------

/**
 * This function takes input a list of file attachments processes them and uploads them to the cloud
 * @param files - The files that are sent as an attachment.
 * @returns An array of object of type ImageFile or VideoFile.
 */
export async function fileAttachmentGenerator(
	fileDataList: FileAttachmentInfo[] // Input: Array of file metadata objects
): Promise<(ImageFile | VideoFile)[]> {
	try {
		let attachmentList: (ImageFile | VideoFile)[] = []; // Initialize an array to store processed attachment data

		for (let fileData of fileDataList) {
			// Iterate through each file data object

			if (fileData.mediaType === "video") {
				// If the media type is video, create a VideoFile object
				attachmentList.push({
					width: fileData.width, // Set video width
					height: fileData.height, // Set video height
					duration: fileData.duration, // Set video duration
					placeholder: fileData.blurHash, // Set blurHash for loading placeholder
					thumbnail: urlGenerator(fileData.fileName, "attachment", "thumbnail"), // Generate URL for video thumbnail
					uri: urlGenerator(fileData.fileName, "attachment", "video"), // Generate URL for video file
				});
			} else {
				// If the media type is an image, create an ImageFile object
				attachmentList.push({
					width: fileData.width, // Set image width
					height: fileData.height, // Set image height
					placeholder: fileData.blurHash, // Set blurHash for loading placeholder
					uri: urlGenerator(fileData.fileName, "attachment", "image"), // Generate URL for image file
				});
			}
		}

		return attachmentList; // Return the array of formatted attachments
	} catch (error) {
		// If an error occurs, rethrow it for higher-level handling
		throw error;
	}
}

/**
 * Generates an AWS MediaConvert job configuration input for processing "moment" video files
 * based on the input file's resolution, bitrate, and audio extraction preference.
 *
 * @param {FileMetadata} metadata - Metadata about the input file including width, audioBitrate, frameRate, and videoBitrate.
 * @param {string} filename - Name of the uploaded video file.
 * @param {boolean} shouldExtractAudio - Whether to include an extracted audio file in the outputs.
 * @returns {CreateJobCommandInput} - Configuration object to be passed to AWS MediaConvert.
 * @throws {AppError} - If required metadata fields are missing.
 */
export function momentPostJobGenerator(
	metadata: FileMetadata,
	filename: string,
	shouldExtractAudio: boolean
): CreateJobCommandInput {
	try {
		// Ensure required metadata fields are present
		if (!metadata.audioBitrate || !metadata.frameRate || !metadata.videoBitrate) {
			throw new AppError("Invalid request", HttpStatusCodes.BAD_REQUEST);
		}

		// Get file base name (without extension) and input URL
		const baseName = filename.split(".")[0];
		const inputFileUrl = urlGenerator(filename, "moment", "video");

		// Cap audio bitrate to 96kbps if higher
		const audioBitrate =
			metadata.audioBitrate < 96000 ? metadata.audioBitrate : 96000;

		// Initialize output list for file group
		const fileGroupOutputs: Output[] = [{ NameModifier: "_preview" }];

		// Determine output framerate settings based on input framerate
		let outputFrameRateNumerator = 30;
		let outputFrameRateDenominator = 1;
		if (metadata.frameRate >= 30) {
			outputFrameRateNumerator = 30;
			outputFrameRateDenominator = 1;
		} else if (metadata.frameRate >= 24 && metadata.frameRate < 30) {
			outputFrameRateNumerator = 24;
			outputFrameRateDenominator = 1;
		} else if (metadata.frameRate >= 20 && metadata.frameRate < 24) {
			outputFrameRateNumerator = 24000;
			outputFrameRateDenominator = 1001;
		} else {
			outputFrameRateNumerator = 15;
			outputFrameRateDenominator = 1;
		}

		// If audio is to be extracted, add audio output config
		if (shouldExtractAudio) {
			fileGroupOutputs.push({
				NameModifier: "_audio",
				AudioDescriptions: [
					{
						CodecSettings: {
							Codec: "AAC",
							AacSettings: {
								CodingMode: "CODING_MODE_2_0",
								Bitrate: audioBitrate,
								SampleRate: 48000,
							},
						},
					},
				],
			});
		}

		// Handle Full HD (1080p or greater)
		if (metadata.width >= 1080) {
			let scaleFactor = Math.min(metadata.videoBitrate / 1800000, 1);
			const videoBitrate =
				metadata.videoBitrate > 1800000 ? 1800000 : metadata.videoBitrate;
			const jobTemplate = shouldExtractAudio
				? MomentJobTemplate.FULLHD_MOMENT_WITH_AUDIO_TEMPLATE
				: MomentJobTemplate.FULLHD_MOMENT_NO_AUDIO_TEMPLATE;

			return {
				JobTemplate: jobTemplate,
				Role: process.env.AWS_ELEMENTAL_ROLE_ARN,
				Settings: {
					Inputs: [{ FileInput: inputFileUrl }],
					OutputGroups: [
						{
							// DASH outputs at multiple quality levels
							Outputs: [
								// Full HD output
								{
									NameModifier: "_fullHd",
									VideoDescription: {
										CodecSettings: {
											Codec: "VP9",
											Vp9Settings: {
												Bitrate: videoBitrate,
												MaxBitrate: Math.round(
													videoBitrate * 1.45
												),
												GopSize: Math.round(
													2 *
														(outputFrameRateNumerator /
															outputFrameRateDenominator)
												),
												FramerateNumerator:
													outputFrameRateNumerator,
												FramerateDenominator:
													outputFrameRateDenominator,
											},
										},
									},
								},
								// Audio output
								{
									NameModifier: "_audio",
									AudioDescriptions: [
										{
											CodecSettings: {
												Codec: "AAC",
												AacSettings: { Bitrate: audioBitrate },
											},
										},
									],
								},
								// HD, SD, and Low bitrate outputs
								{
									NameModifier: "_hd",
									VideoDescription: {
										CodecSettings: {
											Codec: "VP9",
											Vp9Settings: {
												Bitrate: Math.round(
													1024000 * scaleFactor
												),
												MaxBitrate: Math.round(
													10240000 * scaleFactor * 1.45
												),
												GopSize: Math.round(
													2 *
														(outputFrameRateNumerator /
															outputFrameRateDenominator)
												),
												FramerateNumerator:
													outputFrameRateNumerator,
												FramerateDenominator:
													outputFrameRateDenominator,
											},
										},
									},
								},
								{
									NameModifier: "_sd",
									VideoDescription: {
										CodecSettings: {
											Codec: "VP9",
											Vp9Settings: {
												Bitrate: Math.round(750000 * scaleFactor),
												MaxBitrate: Math.round(
													750000 * scaleFactor * 1.45
												),
												GopSize: Math.round(
													2 *
														(outputFrameRateNumerator /
															outputFrameRateDenominator)
												),
												FramerateNumerator:
													outputFrameRateNumerator,
												FramerateDenominator:
													outputFrameRateDenominator,
											},
										},
									},
								},
								{
									NameModifier: "_low",
									VideoDescription: {
										CodecSettings: {
											Codec: "VP9",
											Vp9Settings: {
												Bitrate: Math.round(276000 * scaleFactor),
												MaxBitrate: Math.round(
													276000 * scaleFactor * 1.45
												),
												GopSize: Math.round(
													2 *
														(outputFrameRateNumerator /
															outputFrameRateDenominator)
												),
												FramerateNumerator:
													outputFrameRateNumerator,
												FramerateDenominator:
													outputFrameRateDenominator,
											},
										},
									},
								},
							],
							OutputGroupSettings: {
								Type: "DASH_ISO_GROUP_SETTINGS",
								DashIsoGroupSettings: {
									Destination: `s3://${process.env.AWS_S3_BUCKET_NAME}/moment/${baseName}/stream/`,
								},
							},
						},
						// File group for preview/audio outputs
						{
							Outputs: fileGroupOutputs,
							OutputGroupSettings: {
								Type: "FILE_GROUP_SETTINGS",
								FileGroupSettings: {
									Destination: `s3://${process.env.AWS_S3_BUCKET_NAME}/moment/${baseName}/${baseName}`,
								},
							},
						},
					],
				},
			};
		}

		// Handle HD (720p)
		else if (metadata.width >= 720) {
			let scaleFactor = Math.min(metadata.videoBitrate / 1024000, 1);
			const videoBitrate =
				metadata.videoBitrate > 1024000 ? 1024000 : metadata.videoBitrate;
			const jobTemplate = shouldExtractAudio
				? MomentJobTemplate.HD_MOMENT_WITH_AUDIO_TEMPLATE
				: MomentJobTemplate.HD_MOMENT_NO_AUDIO_TEMPLATE;

			return {
				JobTemplate: jobTemplate,
				Role: process.env.AWS_ELEMENTAL_ROLE_ARN,
				Settings: {
					Inputs: [{ FileInput: inputFileUrl }],
					OutputGroups: [
						{
							Outputs: [
								{
									NameModifier: "_audio",
									AudioDescriptions: [
										{
											CodecSettings: {
												Codec: "AAC",
												AacSettings: { Bitrate: audioBitrate },
											},
										},
									],
								},
								{
									NameModifier: "_hd",
									VideoDescription: {
										CodecSettings: {
											Codec: "VP9",
											Vp9Settings: {
												Bitrate: videoBitrate,
												MaxBitrate: Math.round(
													videoBitrate * 1.45
												),
												GopSize: Math.round(
													2 *
														(outputFrameRateNumerator /
															outputFrameRateDenominator)
												),
												FramerateNumerator:
													outputFrameRateNumerator,
												FramerateDenominator:
													outputFrameRateDenominator,
											},
										},
									},
								},
								{
									NameModifier: "_sd",
									VideoDescription: {
										CodecSettings: {
											Codec: "VP9",
											Vp9Settings: {
												Bitrate: Math.round(750000 * scaleFactor),
												MaxBitrate: Math.round(
													750000 * scaleFactor * 1.45
												),
												GopSize: Math.round(
													2 *
														(outputFrameRateNumerator /
															outputFrameRateDenominator)
												),
												FramerateNumerator:
													outputFrameRateNumerator,
												FramerateDenominator:
													outputFrameRateDenominator,
											},
										},
									},
								},
								{
									NameModifier: "_low",
									VideoDescription: {
										CodecSettings: {
											Codec: "VP9",
											Vp9Settings: {
												Bitrate: Math.round(276000 * scaleFactor),
												MaxBitrate: Math.round(
													276000 * scaleFactor * 1.45
												),
												GopSize: Math.round(
													2 *
														(outputFrameRateNumerator /
															outputFrameRateDenominator)
												),
												FramerateNumerator:
													outputFrameRateNumerator,
												FramerateDenominator:
													outputFrameRateDenominator,
											},
										},
									},
								},
							],
							OutputGroupSettings: {
								Type: "DASH_ISO_GROUP_SETTINGS",
								DashIsoGroupSettings: {
									Destination: `s3://${process.env.AWS_S3_BUCKET_NAME}/moment/${baseName}/stream/`,
								},
							},
						},
						{
							Outputs: fileGroupOutputs,
							OutputGroupSettings: {
								Type: "FILE_GROUP_SETTINGS",
								FileGroupSettings: {
									Destination: `s3://${process.env.AWS_S3_BUCKET_NAME}/moment/${baseName}/${baseName}`,
								},
							},
						},
					],
				},
			};
		}

		// Handle SD (480p)
		else if (metadata.width >= 480) {
			let scaleFactor = Math.min(metadata.videoBitrate / 750000, 1);
			const videoBitrate =
				metadata.videoBitrate > 750000 ? 750000 : metadata.videoBitrate;
			const jobTemplate = shouldExtractAudio
				? MomentJobTemplate.SD_MOMENT_WITH_AUDIO_TEMPLATE
				: MomentJobTemplate.SD_MOMENT_NO_AUDIO_TEMPLATE;

			return {
				JobTemplate: jobTemplate,
				Role: process.env.AWS_ELEMENTAL_ROLE_ARN,
				Settings: {
					Inputs: [{ FileInput: inputFileUrl }],
					OutputGroups: [
						{
							Outputs: [
								{
									NameModifier: "_audio",
									AudioDescriptions: [
										{
											CodecSettings: {
												Codec: "AAC",
												AacSettings: { Bitrate: audioBitrate },
											},
										},
									],
								},
								{
									NameModifier: "_sd",
									VideoDescription: {
										CodecSettings: {
											Codec: "VP9",
											Vp9Settings: {
												Bitrate: videoBitrate,
												MaxBitrate: Math.round(
													videoBitrate * 1.45
												),
												GopSize: Math.round(
													2 *
														(outputFrameRateNumerator /
															outputFrameRateDenominator)
												),
												FramerateNumerator:
													outputFrameRateNumerator,
												FramerateDenominator:
													outputFrameRateDenominator,
											},
										},
									},
								},
								{
									NameModifier: "_low",
									VideoDescription: {
										CodecSettings: {
											Codec: "VP9",
											Vp9Settings: {
												Bitrate: Math.round(276000 * scaleFactor),
												MaxBitrate: Math.round(
													276000 * scaleFactor * 1.45
												),
												GopSize: Math.round(
													2 *
														(outputFrameRateNumerator /
															outputFrameRateDenominator)
												),
												FramerateNumerator:
													outputFrameRateNumerator,
												FramerateDenominator:
													outputFrameRateDenominator,
											},
										},
									},
								},
							],
							OutputGroupSettings: {
								Type: "DASH_ISO_GROUP_SETTINGS",
								DashIsoGroupSettings: {
									Destination: `s3://${process.env.AWS_S3_BUCKET_NAME}/moment/${baseName}/stream/`,
								},
							},
						},
						{
							Outputs: fileGroupOutputs,
							OutputGroupSettings: {
								Type: "FILE_GROUP_SETTINGS",
								FileGroupSettings: {
									Destination: `s3://${process.env.AWS_S3_BUCKET_NAME}/moment/${baseName}/${baseName}`,
								},
							},
						},
					],
				},
			};
		}

		// Handle low resolution (< 480)
		else {
			const videoBitrate =
				metadata.videoBitrate > 276000 ? 276000 : metadata.videoBitrate;
			const jobTemplate = shouldExtractAudio
				? MomentJobTemplate.LOW_MOMENT_WITH_AUDIO_TEMPLATE
				: MomentJobTemplate.LOW_MOMENT_NO_AUDIO_TEMPLATE;

			return {
				JobTemplate: jobTemplate,
				Role: process.env.AWS_ELEMENTAL_ROLE_ARN,
				Settings: {
					Inputs: [{ FileInput: inputFileUrl }],
					OutputGroups: [
						{
							Outputs: [
								{
									NameModifier: "_audio",
									AudioDescriptions: [
										{
											CodecSettings: {
												Codec: "AAC",
												AacSettings: { Bitrate: audioBitrate },
											},
										},
									],
								},
								{
									NameModifier: "_low",
									VideoDescription: {
										CodecSettings: {
											Codec: "VP9",
											Vp9Settings: {
												Bitrate: videoBitrate,
												MaxBitrate: Math.round(
													videoBitrate * 1.45
												),
												GopSize: Math.round(
													2 *
														(outputFrameRateNumerator /
															outputFrameRateDenominator)
												),
												FramerateNumerator:
													outputFrameRateNumerator,
												FramerateDenominator:
													outputFrameRateDenominator,
											},
										},
									},
								},
							],
							OutputGroupSettings: {
								Type: "DASH_ISO_GROUP_SETTINGS",
								DashIsoGroupSettings: {
									Destination: `s3://${process.env.AWS_S3_BUCKET_NAME}/moment/${baseName}/stream/`,
								},
							},
						},
						{
							Outputs: fileGroupOutputs,
							OutputGroupSettings: {
								Type: "FILE_GROUP_SETTINGS",
								FileGroupSettings: {
									Destination: `s3://${process.env.AWS_S3_BUCKET_NAME}/moment/${baseName}/${baseName}`,
								},
							},
						},
					],
				},
			};
		}
	} catch (error) {
		// Rethrow error to be handled by the caller
		throw error;
	}
}

// ----------------------------------------------------- Clip File ---------------------------------------------------------

export function clipPostJobGenerator(
	metadata: FileMetadata,
	filename: string
): CreateJobCommandInput {
	try {
		if (!metadata.audioBitrate || !metadata.frameRate || !metadata.videoBitrate) {
			throw new AppError("Invalid request", HttpStatusCodes.BAD_REQUEST);
		}
		const baseName = filename.split(".")[0];
		const inputFileUrl = urlGenerator(filename, "clip", "video");
		const audioBitrate =
			metadata.audioBitrate < 96000 ? metadata.audioBitrate : 96000;
		const aspectRatio = metadata.width / metadata.height;
		let outputFrameRateNumerator = 30;
		let outputFrameRateDenominator = 1;
		if (metadata.frameRate >= 30) {
			outputFrameRateNumerator = 30;
			outputFrameRateDenominator = 1;
		} else if (metadata.frameRate >= 24 && metadata.frameRate < 30) {
			outputFrameRateNumerator = 24;
			outputFrameRateDenominator = 1;
		} else if (metadata.frameRate >= 20 && metadata.frameRate < 24) {
			outputFrameRateNumerator = 24000;
			outputFrameRateDenominator = 1001;
		} else {
			outputFrameRateNumerator = 15;
			outputFrameRateDenominator = 1;
		}
		if (aspectRatio > 1) {
			if (metadata.height >= 1080) {
				let scaleFactor = Math.min(metadata.videoBitrate / 1800000, 1);
				const videoBitrate =
					metadata.videoBitrate > 1800000 ? 1800000 : metadata.videoBitrate;
				const jobTemplate = ClipJobTemplate.FULLHD_CLIP_TEMPLATE;
				const frameWidth_fullHd = Math.round(1080 * aspectRatio);
				const frameHeight_fullHd = 1080;
				const frameWidth_hd = Math.round(720 * aspectRatio);
				const frameHeight_hd = 720;
				const frameWidth_sd = Math.round(480 * aspectRatio);
				const frameHeight_sd = 480;
				const frameWidth_low = Math.round(360 * aspectRatio);
				const frameHeight_low = 360;
				return {
					JobTemplate: jobTemplate,
					Role: process.env.AWS_ELEMENTAL_ROLE_ARN,
					Settings: {
						Inputs: [
							{
								FileInput: inputFileUrl,
							},
						],
						OutputGroups: [
							{
								Outputs: [
									{
										NameModifier: "_fullHd",
										VideoDescription: {
											Height: frameHeight_fullHd,
											Width:
												frameWidth_fullHd % 2 === 0
													? frameWidth_fullHd
													: frameWidth_fullHd - 1,
											CodecSettings: {
												Codec: "VP9",
												Vp9Settings: {
													Bitrate: videoBitrate,
													MaxBitrate: Math.round(
														videoBitrate * 1.45
													),
													GopSize: Math.round(
														2 *
															(outputFrameRateNumerator /
																outputFrameRateDenominator)
													),
													FramerateNumerator:
														outputFrameRateNumerator,
													FramerateDenominator:
														outputFrameRateDenominator,
												},
											},
										},
									},
									{
										NameModifier: "_audio",
										AudioDescriptions: [
											{
												CodecSettings: {
													Codec: "AAC",
													AacSettings: {
														Bitrate: audioBitrate,
													},
												},
											},
										],
									},
									{
										NameModifier: "_hd",
										VideoDescription: {
											Height: frameHeight_hd,
											Width:
												frameWidth_hd % 2 === 0
													? frameWidth_hd
													: frameWidth_hd - 1,
											CodecSettings: {
												Codec: "VP9",
												Vp9Settings: {
													Bitrate: Math.round(
														1024000 * scaleFactor
													),
													MaxBitrate: Math.round(
														10240000 * scaleFactor * 1.45
													),
													GopSize: Math.round(
														2 *
															(outputFrameRateNumerator /
																outputFrameRateDenominator)
													),
													FramerateNumerator:
														outputFrameRateNumerator,
													FramerateDenominator:
														outputFrameRateDenominator,
												},
											},
										},
									},
									{
										NameModifier: "_sd",
										VideoDescription: {
											Height: frameHeight_sd,
											Width:
												frameWidth_sd % 2 === 0
													? frameWidth_sd
													: frameWidth_sd - 1,
											CodecSettings: {
												Codec: "VP9",
												Vp9Settings: {
													Bitrate: Math.round(
														750000 * scaleFactor
													),
													MaxBitrate: Math.round(
														750000 * scaleFactor * 1.45
													),
													GopSize: Math.round(
														2 *
															(outputFrameRateNumerator /
																outputFrameRateDenominator)
													),
													FramerateNumerator:
														outputFrameRateNumerator,
													FramerateDenominator:
														outputFrameRateDenominator,
												},
											},
										},
									},
									{
										NameModifier: "_low",
										VideoDescription: {
											Height: frameHeight_low,
											Width:
												frameWidth_low % 2 === 0
													? frameWidth_low
													: frameWidth_low - 1,
											CodecSettings: {
												Codec: "VP9",
												Vp9Settings: {
													Bitrate: Math.round(
														276000 * scaleFactor
													),
													MaxBitrate: Math.round(
														276000 * scaleFactor * 1.45
													),
													GopSize: Math.round(
														2 *
															(outputFrameRateNumerator /
																outputFrameRateDenominator)
													),
													FramerateNumerator:
														outputFrameRateNumerator,
													FramerateDenominator:
														outputFrameRateDenominator,
												},
											},
										},
									},
								],
								OutputGroupSettings: {
									Type: "DASH_ISO_GROUP_SETTINGS",
									DashIsoGroupSettings: {
										Destination: `s3://${process.env.AWS_S3_BUCKET_NAME}/clip/${baseName}/stream/`,
									},
								},
							},
							{
								OutputGroupSettings: {
									Type: "FILE_GROUP_SETTINGS",
									FileGroupSettings: {
										Destination: `s3://${process.env.AWS_S3_BUCKET_NAME}/clip/${baseName}/${baseName}`,
									},
								},
							},
						],
					},
				};
			} else if (metadata.height >= 720) {
				let scaleFactor = Math.min(metadata.videoBitrate / 1024000, 1);
				const videoBitrate =
					metadata.videoBitrate > 1024000 ? 1024000 : metadata.videoBitrate;
				const jobTemplate = ClipJobTemplate.HD_CLIP_TEMPLATE;
				const frameWidth_hd = Math.round(720 * aspectRatio);
				const frameHeight_hd = 720;
				const frameWidth_sd = Math.round(480 * aspectRatio);
				const frameHeight_sd = 480;
				const frameWidth_low = Math.round(360 * aspectRatio);
				const frameHeight_low = 360;
				return {
					JobTemplate: jobTemplate,
					Role: process.env.AWS_ELEMENTAL_ROLE_ARN,
					Settings: {
						Inputs: [
							{
								FileInput: inputFileUrl,
							},
						],
						OutputGroups: [
							{
								Outputs: [
									{
										NameModifier: "_audio",
										AudioDescriptions: [
											{
												CodecSettings: {
													Codec: "AAC",
													AacSettings: {
														Bitrate: audioBitrate,
													},
												},
											},
										],
									},
									{
										NameModifier: "_hd",
										VideoDescription: {
											Height: frameHeight_hd,
											Width:
												frameWidth_hd % 2 === 0
													? frameWidth_hd
													: frameWidth_hd - 1,
											CodecSettings: {
												Codec: "VP9",
												Vp9Settings: {
													Bitrate: videoBitrate,
													MaxBitrate: Math.round(
														videoBitrate * 1.45
													),
													GopSize: Math.round(
														2 *
															(outputFrameRateNumerator /
																outputFrameRateDenominator)
													),
													FramerateNumerator:
														outputFrameRateNumerator,
													FramerateDenominator:
														outputFrameRateDenominator,
												},
											},
										},
									},
									{
										NameModifier: "_sd",
										VideoDescription: {
											Height: frameHeight_sd,
											Width:
												frameWidth_sd % 2 === 0
													? frameWidth_sd
													: frameWidth_sd - 1,
											CodecSettings: {
												Codec: "VP9",
												Vp9Settings: {
													Bitrate: Math.round(
														750000 * scaleFactor
													),
													MaxBitrate: Math.round(
														750000 * scaleFactor * 1.45
													),
													GopSize: Math.round(
														2 *
															(outputFrameRateNumerator /
																outputFrameRateDenominator)
													),
													FramerateNumerator:
														outputFrameRateNumerator,
													FramerateDenominator:
														outputFrameRateDenominator,
												},
											},
										},
									},
									{
										NameModifier: "_low",
										VideoDescription: {
											Height: frameHeight_low,
											Width:
												frameWidth_low % 2 === 0
													? frameWidth_low
													: frameWidth_low - 1,
											CodecSettings: {
												Codec: "VP9",
												Vp9Settings: {
													Bitrate: Math.round(
														276000 * scaleFactor
													),
													MaxBitrate: Math.round(
														276000 * scaleFactor * 1.45
													),
													GopSize: Math.round(
														2 *
															(outputFrameRateNumerator /
																outputFrameRateDenominator)
													),
													FramerateNumerator:
														outputFrameRateNumerator,
													FramerateDenominator:
														outputFrameRateDenominator,
												},
											},
										},
									},
								],
								OutputGroupSettings: {
									Type: "DASH_ISO_GROUP_SETTINGS",
									DashIsoGroupSettings: {
										Destination: `s3://${process.env.AWS_S3_BUCKET_NAME}/clip/${baseName}/stream/`,
									},
								},
							},
							{
								OutputGroupSettings: {
									Type: "FILE_GROUP_SETTINGS",
									FileGroupSettings: {
										Destination: `s3://${process.env.AWS_S3_BUCKET_NAME}/clip/${baseName}/${baseName}`,
									},
								},
							},
						],
					},
				};
			} else if (metadata.height >= 480) {
				let scaleFactor = Math.min(metadata.videoBitrate / 750000, 1);
				const videoBitrate =
					metadata.videoBitrate > 750000 ? 750000 : metadata.videoBitrate;
				const jobTemplate = ClipJobTemplate.SD_CLIP_TEMPLATE;
				const frameWidth_sd = Math.round(480 * aspectRatio);
				const frameHeight_sd = 480;
				const frameWidth_low = Math.round(360 * aspectRatio);
				const frameHeight_low = 360;
				return {
					JobTemplate: jobTemplate,
					Role: process.env.AWS_ELEMENTAL_ROLE_ARN,
					Settings: {
						Inputs: [
							{
								FileInput: inputFileUrl,
							},
						],
						OutputGroups: [
							{
								Outputs: [
									{
										NameModifier: "_audio",
										AudioDescriptions: [
											{
												CodecSettings: {
													Codec: "AAC",
													AacSettings: {
														Bitrate: audioBitrate,
													},
												},
											},
										],
									},
									{
										NameModifier: "_sd",
										VideoDescription: {
											Height: frameHeight_sd,
											Width:
												frameWidth_sd % 2 === 0
													? frameWidth_sd
													: frameWidth_sd - 1,
											CodecSettings: {
												Codec: "VP9",
												Vp9Settings: {
													Bitrate: videoBitrate,
													MaxBitrate: Math.round(
														videoBitrate * 1.45
													),
													GopSize: Math.round(
														2 *
															(outputFrameRateNumerator /
																outputFrameRateDenominator)
													),
													FramerateNumerator:
														outputFrameRateNumerator,
													FramerateDenominator:
														outputFrameRateDenominator,
												},
											},
										},
									},
									{
										NameModifier: "_low",
										VideoDescription: {
											Height: frameHeight_low,
											Width:
												frameWidth_low % 2 === 0
													? frameWidth_low
													: frameWidth_low - 1,
											CodecSettings: {
												Codec: "VP9",
												Vp9Settings: {
													Bitrate: Math.round(
														276000 * scaleFactor
													),
													MaxBitrate: Math.round(
														276000 * scaleFactor * 1.45
													),
													GopSize: Math.round(
														2 *
															(outputFrameRateNumerator /
																outputFrameRateDenominator)
													),
													FramerateNumerator:
														outputFrameRateNumerator,
													FramerateDenominator:
														outputFrameRateDenominator,
												},
											},
										},
									},
								],
								OutputGroupSettings: {
									Type: "DASH_ISO_GROUP_SETTINGS",
									DashIsoGroupSettings: {
										Destination: `s3://${process.env.AWS_S3_BUCKET_NAME}/clip/${baseName}/stream/`,
									},
								},
							},
							{
								OutputGroupSettings: {
									Type: "FILE_GROUP_SETTINGS",
									FileGroupSettings: {
										Destination: `s3://${process.env.AWS_S3_BUCKET_NAME}/clip/${baseName}/${baseName}`,
									},
								},
							},
						],
					},
				};
			} else {
				const videoBitrate =
					metadata.videoBitrate > 276000 ? 276000 : metadata.videoBitrate;
				const jobTemplate = ClipJobTemplate.LOW_CLIP_TEMPLATE;
				const frameWidth_low = Math.round(360 * aspectRatio);
				const frameHeight_low = 360;
				return {
					JobTemplate: jobTemplate,
					Role: process.env.AWS_ELEMENTAL_ROLE_ARN,
					Settings: {
						Inputs: [
							{
								FileInput: inputFileUrl,
							},
						],
						OutputGroups: [
							{
								Outputs: [
									{
										NameModifier: "_audio",
										AudioDescriptions: [
											{
												CodecSettings: {
													Codec: "AAC",
													AacSettings: {
														Bitrate: audioBitrate,
													},
												},
											},
										],
									},
									{
										NameModifier: "_low",
										VideoDescription: {
											Height: frameHeight_low,
											Width:
												frameWidth_low % 2 === 0
													? frameWidth_low
													: frameWidth_low - 1,
											CodecSettings: {
												Codec: "VP9",
												Vp9Settings: {
													Bitrate: videoBitrate,
													MaxBitrate: Math.round(
														videoBitrate * 1.45
													),
													GopSize: Math.round(
														2 *
															(outputFrameRateNumerator /
																outputFrameRateDenominator)
													),
													FramerateNumerator:
														outputFrameRateNumerator,
													FramerateDenominator:
														outputFrameRateDenominator,
												},
											},
										},
									},
								],
								OutputGroupSettings: {
									Type: "DASH_ISO_GROUP_SETTINGS",
									DashIsoGroupSettings: {
										Destination: `s3://${process.env.AWS_S3_BUCKET_NAME}/clip/${baseName}/stream/`,
									},
								},
							},
							{
								OutputGroupSettings: {
									Type: "FILE_GROUP_SETTINGS",
									FileGroupSettings: {
										Destination: `s3://${process.env.AWS_S3_BUCKET_NAME}/clip/${baseName}/${baseName}`,
									},
								},
							},
						],
					},
				};
			}
		} else if (aspectRatio < 1) {
			if (metadata.width >= 1080) {
				let scaleFactor = Math.min(metadata.videoBitrate / 1800000, 1);
				const videoBitrate =
					metadata.videoBitrate > 1800000 ? 1800000 : metadata.videoBitrate;
				const jobTemplate = ClipJobTemplate.FULLHD_CLIP_TEMPLATE;
				const frameWidth_fullHd = 1080;
				const frameHeight_fullHd = Math.round(1080 / aspectRatio);
				const frameWidth_hd = 720;
				const frameHeight_hd = Math.round(720 / aspectRatio);
				const frameWidth_sd = 480;
				const frameHeight_sd = Math.round(480 * aspectRatio);
				const frameWidth_low = 360;
				const frameHeight_low = Math.round(360 * aspectRatio);
				return {
					JobTemplate: jobTemplate,
					Role: process.env.AWS_ELEMENTAL_ROLE_ARN,
					Settings: {
						Inputs: [
							{
								FileInput: inputFileUrl,
							},
						],
						OutputGroups: [
							{
								Outputs: [
									{
										NameModifier: "_fullHd",
										VideoDescription: {
											Width: frameWidth_fullHd,
											Height:
												frameHeight_fullHd % 2 === 0
													? frameHeight_fullHd
													: frameHeight_fullHd - 1,
											CodecSettings: {
												Codec: "VP9",
												Vp9Settings: {
													Bitrate: videoBitrate,
													MaxBitrate: Math.round(
														videoBitrate * 1.45
													),
													GopSize: Math.round(
														2 *
															(outputFrameRateNumerator /
																outputFrameRateDenominator)
													),
													FramerateNumerator:
														outputFrameRateNumerator,
													FramerateDenominator:
														outputFrameRateDenominator,
												},
											},
										},
									},
									{
										NameModifier: "_audio",
										AudioDescriptions: [
											{
												CodecSettings: {
													Codec: "AAC",
													AacSettings: {
														Bitrate: audioBitrate,
													},
												},
											},
										],
									},
									{
										NameModifier: "_hd",
										VideoDescription: {
											Width: frameWidth_hd,
											Height:
												frameHeight_hd % 2 === 0
													? frameHeight_hd
													: frameHeight_hd - 1,
											CodecSettings: {
												Codec: "VP9",
												Vp9Settings: {
													Bitrate: Math.round(
														1024000 * scaleFactor
													),
													MaxBitrate: Math.round(
														10240000 * scaleFactor * 1.45
													),
													GopSize: Math.round(
														2 *
															(outputFrameRateNumerator /
																outputFrameRateDenominator)
													),
													FramerateNumerator:
														outputFrameRateNumerator,
													FramerateDenominator:
														outputFrameRateDenominator,
												},
											},
										},
									},
									{
										NameModifier: "_sd",
										VideoDescription: {
											Width: frameWidth_sd,
											Height:
												frameHeight_sd % 2 === 0
													? frameHeight_sd
													: frameHeight_sd - 1,
											CodecSettings: {
												Codec: "VP9",
												Vp9Settings: {
													Bitrate: Math.round(
														750000 * scaleFactor
													),
													MaxBitrate: Math.round(
														750000 * scaleFactor * 1.45
													),
													GopSize: Math.round(
														2 *
															(outputFrameRateNumerator /
																outputFrameRateDenominator)
													),
													FramerateNumerator:
														outputFrameRateNumerator,
													FramerateDenominator:
														outputFrameRateDenominator,
												},
											},
										},
									},
									{
										NameModifier: "_low",
										VideoDescription: {
											Width: frameWidth_low,
											Height:
												frameHeight_low % 2 === 0
													? frameHeight_low
													: frameHeight_low - 1,
											CodecSettings: {
												Codec: "VP9",
												Vp9Settings: {
													Bitrate: Math.round(
														276000 * scaleFactor
													),
													MaxBitrate: Math.round(
														276000 * scaleFactor * 1.45
													),
													GopSize: Math.round(
														2 *
															(outputFrameRateNumerator /
																outputFrameRateDenominator)
													),
													FramerateNumerator:
														outputFrameRateNumerator,
													FramerateDenominator:
														outputFrameRateDenominator,
												},
											},
										},
									},
								],
								OutputGroupSettings: {
									Type: "DASH_ISO_GROUP_SETTINGS",
									DashIsoGroupSettings: {
										Destination: `s3://${process.env.AWS_S3_BUCKET_NAME}/clip/${baseName}/stream/`,
									},
								},
							},
							{
								OutputGroupSettings: {
									Type: "FILE_GROUP_SETTINGS",
									FileGroupSettings: {
										Destination: `s3://${process.env.AWS_S3_BUCKET_NAME}/clip/${baseName}/${baseName}`,
									},
								},
							},
						],
					},
				};
			} else if (metadata.width >= 720) {
				let scaleFactor = Math.min(metadata.videoBitrate / 1024000, 1);
				const videoBitrate =
					metadata.videoBitrate > 1024000 ? 1024000 : metadata.videoBitrate;
				const jobTemplate = ClipJobTemplate.HD_CLIP_TEMPLATE;
				const frameWidth_hd = 720;
				const frameHeight_hd = Math.round(720 / aspectRatio);
				const frameWidth_sd = 480;
				const frameHeight_sd = Math.round(480 * aspectRatio);
				const frameWidth_low = 360;
				const frameHeight_low = Math.round(360 * aspectRatio);
				return {
					JobTemplate: jobTemplate,
					Role: process.env.AWS_ELEMENTAL_ROLE_ARN,
					Settings: {
						Inputs: [
							{
								FileInput: inputFileUrl,
							},
						],
						OutputGroups: [
							{
								Outputs: [
									{
										NameModifier: "_audio",
										AudioDescriptions: [
											{
												CodecSettings: {
													Codec: "AAC",
													AacSettings: {
														Bitrate: audioBitrate,
													},
												},
											},
										],
									},
									{
										NameModifier: "_hd",
										VideoDescription: {
											Width: frameWidth_hd,
											Height:
												frameHeight_hd % 2 === 0
													? frameHeight_hd
													: frameHeight_hd - 1,
											CodecSettings: {
												Codec: "VP9",
												Vp9Settings: {
													Bitrate: videoBitrate,
													MaxBitrate: Math.round(
														videoBitrate * 1.45
													),
													GopSize: Math.round(
														2 *
															(outputFrameRateNumerator /
																outputFrameRateDenominator)
													),
													FramerateNumerator:
														outputFrameRateNumerator,
													FramerateDenominator:
														outputFrameRateDenominator,
												},
											},
										},
									},
									{
										NameModifier: "_sd",
										VideoDescription: {
											Width: frameWidth_sd,
											Height:
												frameHeight_sd % 2 === 0
													? frameHeight_sd
													: frameHeight_sd - 1,
											CodecSettings: {
												Codec: "VP9",
												Vp9Settings: {
													Bitrate: Math.round(
														750000 * scaleFactor
													),
													MaxBitrate: Math.round(
														750000 * scaleFactor * 1.45
													),
													GopSize: Math.round(
														2 *
															(outputFrameRateNumerator /
																outputFrameRateDenominator)
													),
													FramerateNumerator:
														outputFrameRateNumerator,
													FramerateDenominator:
														outputFrameRateDenominator,
												},
											},
										},
									},
									{
										NameModifier: "_low",
										VideoDescription: {
											Width: frameWidth_low,
											Height:
												frameHeight_low % 2 === 0
													? frameHeight_low
													: frameHeight_low - 1,
											CodecSettings: {
												Codec: "VP9",
												Vp9Settings: {
													Bitrate: Math.round(
														276000 * scaleFactor
													),
													MaxBitrate: Math.round(
														276000 * scaleFactor * 1.45
													),
													GopSize: Math.round(
														2 *
															(outputFrameRateNumerator /
																outputFrameRateDenominator)
													),
													FramerateNumerator:
														outputFrameRateNumerator,
													FramerateDenominator:
														outputFrameRateDenominator,
												},
											},
										},
									},
								],
								OutputGroupSettings: {
									Type: "DASH_ISO_GROUP_SETTINGS",
									DashIsoGroupSettings: {
										Destination: `s3://${process.env.AWS_S3_BUCKET_NAME}/clip/${baseName}/stream/`,
									},
								},
							},
							{
								OutputGroupSettings: {
									Type: "FILE_GROUP_SETTINGS",
									FileGroupSettings: {
										Destination: `s3://${process.env.AWS_S3_BUCKET_NAME}/clip/${baseName}/${baseName}`,
									},
								},
							},
						],
					},
				};
			} else if (metadata.width >= 480) {
				let scaleFactor = Math.min(metadata.videoBitrate / 750000, 1);
				const videoBitrate =
					metadata.videoBitrate > 750000 ? 750000 : metadata.videoBitrate;
				const jobTemplate = ClipJobTemplate.SD_CLIP_TEMPLATE;
				const frameWidth_sd = 480;
				const frameHeight_sd = Math.round(480 * aspectRatio);
				const frameWidth_low = 360;
				const frameHeight_low = Math.round(360 * aspectRatio);
				return {
					JobTemplate: jobTemplate,
					Role: process.env.AWS_ELEMENTAL_ROLE_ARN,
					Settings: {
						Inputs: [
							{
								FileInput: inputFileUrl,
							},
						],
						OutputGroups: [
							{
								Outputs: [
									{
										NameModifier: "_audio",
										AudioDescriptions: [
											{
												CodecSettings: {
													Codec: "AAC",
													AacSettings: {
														Bitrate: audioBitrate,
													},
												},
											},
										],
									},
									{
										NameModifier: "_sd",
										VideoDescription: {
											Width: frameWidth_sd,
											Height:
												frameHeight_sd % 2 === 0
													? frameHeight_sd
													: frameHeight_sd - 1,
											CodecSettings: {
												Codec: "VP9",
												Vp9Settings: {
													Bitrate: videoBitrate,
													MaxBitrate: Math.round(
														videoBitrate * 1.45
													),
													GopSize: Math.round(
														2 *
															(outputFrameRateNumerator /
																outputFrameRateDenominator)
													),
													FramerateNumerator:
														outputFrameRateNumerator,
													FramerateDenominator:
														outputFrameRateDenominator,
												},
											},
										},
									},
									{
										NameModifier: "_low",
										VideoDescription: {
											Width: frameWidth_low,
											Height:
												frameHeight_low % 2 === 0
													? frameHeight_low
													: frameHeight_low - 1,
											CodecSettings: {
												Codec: "VP9",
												Vp9Settings: {
													Bitrate: Math.round(
														276000 * scaleFactor
													),
													MaxBitrate: Math.round(
														276000 * scaleFactor * 1.45
													),
													GopSize: Math.round(
														2 *
															(outputFrameRateNumerator /
																outputFrameRateDenominator)
													),
													FramerateNumerator:
														outputFrameRateNumerator,
													FramerateDenominator:
														outputFrameRateDenominator,
												},
											},
										},
									},
								],
								OutputGroupSettings: {
									Type: "DASH_ISO_GROUP_SETTINGS",
									DashIsoGroupSettings: {
										Destination: `s3://${process.env.AWS_S3_BUCKET_NAME}/clip/${baseName}/stream/`,
									},
								},
							},
							{
								OutputGroupSettings: {
									Type: "FILE_GROUP_SETTINGS",
									FileGroupSettings: {
										Destination: `s3://${process.env.AWS_S3_BUCKET_NAME}/clip/${baseName}/${baseName}`,
									},
								},
							},
						],
					},
				};
			} else {
				const videoBitrate =
					metadata.videoBitrate > 276000 ? 276000 : metadata.videoBitrate;
				const jobTemplate = ClipJobTemplate.LOW_CLIP_TEMPLATE;
				const frameWidth_low = 360;
				const frameHeight_low = Math.round(360 * aspectRatio);
				return {
					JobTemplate: jobTemplate,
					Role: process.env.AWS_ELEMENTAL_ROLE_ARN,
					Settings: {
						Inputs: [
							{
								FileInput: inputFileUrl,
							},
						],
						OutputGroups: [
							{
								Outputs: [
									{
										NameModifier: "_audio",
										AudioDescriptions: [
											{
												CodecSettings: {
													Codec: "AAC",
													AacSettings: {
														Bitrate: audioBitrate,
													},
												},
											},
										],
									},
									{
										NameModifier: "_low",
										VideoDescription: {
											Width: frameWidth_low,
											Height:
												frameHeight_low % 2 === 0
													? frameHeight_low
													: frameHeight_low - 1,
											CodecSettings: {
												Codec: "VP9",
												Vp9Settings: {
													Bitrate: videoBitrate,
													MaxBitrate: Math.round(
														videoBitrate * 1.45
													),
													GopSize: Math.round(
														2 *
															(outputFrameRateNumerator /
																outputFrameRateDenominator)
													),
													FramerateNumerator:
														outputFrameRateNumerator,
													FramerateDenominator:
														outputFrameRateDenominator,
												},
											},
										},
									},
								],
								OutputGroupSettings: {
									Type: "DASH_ISO_GROUP_SETTINGS",
									DashIsoGroupSettings: {
										Destination: `s3://${process.env.AWS_S3_BUCKET_NAME}/clip/${baseName}/stream/`,
									},
								},
							},
							{
								OutputGroupSettings: {
									Type: "FILE_GROUP_SETTINGS",
									FileGroupSettings: {
										Destination: `s3://${process.env.AWS_S3_BUCKET_NAME}/clip/${baseName}/${baseName}`,
									},
								},
							},
						],
					},
				};
			}
		} else {
			if (metadata.width >= 1080) {
				let scaleFactor = Math.min(metadata.videoBitrate / 1800000, 1);
				const videoBitrate =
					metadata.videoBitrate > 1800000 ? 1800000 : metadata.videoBitrate;
				const jobTemplate = ClipJobTemplate.FULLHD_CLIP_TEMPLATE;

				return {
					JobTemplate: jobTemplate,
					Role: process.env.AWS_ELEMENTAL_ROLE_ARN,
					Settings: {
						Inputs: [
							{
								FileInput: inputFileUrl,
							},
						],
						OutputGroups: [
							{
								Outputs: [
									{
										NameModifier: "_fullHd",
										VideoDescription: {
											Width: 1080,
											Height: 1080,
											CodecSettings: {
												Codec: "VP9",
												Vp9Settings: {
													Bitrate: videoBitrate,
													MaxBitrate: Math.round(
														videoBitrate * 1.45
													),
													GopSize: Math.round(
														2 *
															(outputFrameRateNumerator /
																outputFrameRateDenominator)
													),
													FramerateNumerator:
														outputFrameRateNumerator,
													FramerateDenominator:
														outputFrameRateDenominator,
												},
											},
										},
									},
									{
										NameModifier: "_audio",
										AudioDescriptions: [
											{
												CodecSettings: {
													Codec: "AAC",
													AacSettings: {
														Bitrate: audioBitrate,
													},
												},
											},
										],
									},
									{
										NameModifier: "_hd",
										VideoDescription: {
											Width: 720,
											Height: 720,
											CodecSettings: {
												Codec: "VP9",
												Vp9Settings: {
													Bitrate: Math.round(
														1024000 * scaleFactor
													),
													MaxBitrate: Math.round(
														10240000 * scaleFactor * 1.45
													),
													GopSize: Math.round(
														2 *
															(outputFrameRateNumerator /
																outputFrameRateDenominator)
													),
													FramerateNumerator:
														outputFrameRateNumerator,
													FramerateDenominator:
														outputFrameRateDenominator,
												},
											},
										},
									},
									{
										NameModifier: "_sd",
										VideoDescription: {
											Width: 480,
											Height: 480,
											CodecSettings: {
												Codec: "VP9",
												Vp9Settings: {
													Bitrate: Math.round(
														750000 * scaleFactor
													),
													MaxBitrate: Math.round(
														750000 * scaleFactor * 1.45
													),
													GopSize: Math.round(
														2 *
															(outputFrameRateNumerator /
																outputFrameRateDenominator)
													),
													FramerateNumerator:
														outputFrameRateNumerator,
													FramerateDenominator:
														outputFrameRateDenominator,
												},
											},
										},
									},
									{
										NameModifier: "_low",
										VideoDescription: {
											Width: 360,
											Height: 360,
											CodecSettings: {
												Codec: "VP9",
												Vp9Settings: {
													Bitrate: Math.round(
														276000 * scaleFactor
													),
													MaxBitrate: Math.round(
														276000 * scaleFactor * 1.45
													),
													GopSize: Math.round(
														2 *
															(outputFrameRateNumerator /
																outputFrameRateDenominator)
													),
													FramerateNumerator:
														outputFrameRateNumerator,
													FramerateDenominator:
														outputFrameRateDenominator,
												},
											},
										},
									},
								],
								OutputGroupSettings: {
									Type: "DASH_ISO_GROUP_SETTINGS",
									DashIsoGroupSettings: {
										Destination: `s3://${process.env.AWS_S3_BUCKET_NAME}/clip/${baseName}/stream/`,
									},
								},
							},
							{
								OutputGroupSettings: {
									Type: "FILE_GROUP_SETTINGS",
									FileGroupSettings: {
										Destination: `s3://${process.env.AWS_S3_BUCKET_NAME}/clip/${baseName}/${baseName}`,
									},
								},
							},
						],
					},
				};
			} else if (metadata.width >= 720) {
				let scaleFactor = Math.min(metadata.videoBitrate / 1024000, 1);
				const videoBitrate =
					metadata.videoBitrate > 1024000 ? 1024000 : metadata.videoBitrate;
				const jobTemplate = ClipJobTemplate.HD_CLIP_TEMPLATE;
				return {
					JobTemplate: jobTemplate,
					Role: process.env.AWS_ELEMENTAL_ROLE_ARN,
					Settings: {
						Inputs: [
							{
								FileInput: inputFileUrl,
							},
						],
						OutputGroups: [
							{
								Outputs: [
									{
										NameModifier: "_audio",
										AudioDescriptions: [
											{
												CodecSettings: {
													Codec: "AAC",
													AacSettings: {
														Bitrate: audioBitrate,
													},
												},
											},
										],
									},
									{
										NameModifier: "_hd",
										VideoDescription: {
											Width: 720,
											Height: 720,
											CodecSettings: {
												Codec: "VP9",
												Vp9Settings: {
													Bitrate: videoBitrate,
													MaxBitrate: Math.round(
														videoBitrate * 1.45
													),
													GopSize: Math.round(
														2 *
															(outputFrameRateNumerator /
																outputFrameRateDenominator)
													),
													FramerateNumerator:
														outputFrameRateNumerator,
													FramerateDenominator:
														outputFrameRateDenominator,
												},
											},
										},
									},
									{
										NameModifier: "_sd",
										VideoDescription: {
											Width: 480,
											Height: 480,
											CodecSettings: {
												Codec: "VP9",
												Vp9Settings: {
													Bitrate: Math.round(
														750000 * scaleFactor
													),
													MaxBitrate: Math.round(
														750000 * scaleFactor * 1.45
													),
													GopSize: Math.round(
														2 *
															(outputFrameRateNumerator /
																outputFrameRateDenominator)
													),
													FramerateNumerator:
														outputFrameRateNumerator,
													FramerateDenominator:
														outputFrameRateDenominator,
												},
											},
										},
									},
									{
										NameModifier: "_low",
										VideoDescription: {
											Width: 360,
											Height: 360,
											CodecSettings: {
												Codec: "VP9",
												Vp9Settings: {
													Bitrate: Math.round(
														276000 * scaleFactor
													),
													MaxBitrate: Math.round(
														276000 * scaleFactor * 1.45
													),
													GopSize: Math.round(
														2 *
															(outputFrameRateNumerator /
																outputFrameRateDenominator)
													),
													FramerateNumerator:
														outputFrameRateNumerator,
													FramerateDenominator:
														outputFrameRateDenominator,
												},
											},
										},
									},
								],
								OutputGroupSettings: {
									Type: "DASH_ISO_GROUP_SETTINGS",
									DashIsoGroupSettings: {
										Destination: `s3://${process.env.AWS_S3_BUCKET_NAME}/moment/${baseName}/stream/`,
									},
								},
							},
							{
								OutputGroupSettings: {
									Type: "FILE_GROUP_SETTINGS",
									FileGroupSettings: {
										Destination: `s3://${process.env.AWS_S3_BUCKET_NAME}/moment/${baseName}/${baseName}`,
									},
								},
							},
						],
					},
				};
			} else if (metadata.width >= 480) {
				let scaleFactor = Math.min(metadata.videoBitrate / 750000, 1);
				const videoBitrate =
					metadata.videoBitrate > 750000 ? 750000 : metadata.videoBitrate;
				const jobTemplate = ClipJobTemplate.SD_CLIP_TEMPLATE;
				return {
					JobTemplate: jobTemplate,
					Role: process.env.AWS_ELEMENTAL_ROLE_ARN,
					Settings: {
						Inputs: [
							{
								FileInput: inputFileUrl,
							},
						],
						OutputGroups: [
							{
								Outputs: [
									{
										NameModifier: "_audio",
										AudioDescriptions: [
											{
												CodecSettings: {
													Codec: "AAC",
													AacSettings: {
														Bitrate: audioBitrate,
													},
												},
											},
										],
									},
									{
										NameModifier: "_sd",
										VideoDescription: {
											Width: 480,
											Height: 480,
											CodecSettings: {
												Codec: "VP9",
												Vp9Settings: {
													Bitrate: videoBitrate,
													MaxBitrate: Math.round(
														videoBitrate * 1.45
													),
													GopSize: Math.round(
														2 *
															(outputFrameRateNumerator /
																outputFrameRateDenominator)
													),
													FramerateNumerator:
														outputFrameRateNumerator,
													FramerateDenominator:
														outputFrameRateDenominator,
												},
											},
										},
									},
									{
										NameModifier: "_low",
										VideoDescription: {
											Width: 360,
											Height: 360,
											CodecSettings: {
												Codec: "VP9",
												Vp9Settings: {
													Bitrate: Math.round(
														276000 * scaleFactor
													),
													MaxBitrate: Math.round(
														276000 * scaleFactor * 1.45
													),
													GopSize: Math.round(
														2 *
															(outputFrameRateNumerator /
																outputFrameRateDenominator)
													),
													FramerateNumerator:
														outputFrameRateNumerator,
													FramerateDenominator:
														outputFrameRateDenominator,
												},
											},
										},
									},
								],
								OutputGroupSettings: {
									Type: "DASH_ISO_GROUP_SETTINGS",
									DashIsoGroupSettings: {
										Destination: `s3://${process.env.AWS_S3_BUCKET_NAME}/clip/${baseName}/stream/`,
									},
								},
							},
							{
								OutputGroupSettings: {
									Type: "FILE_GROUP_SETTINGS",
									FileGroupSettings: {
										Destination: `s3://${process.env.AWS_S3_BUCKET_NAME}/clip/${baseName}/${baseName}`,
									},
								},
							},
						],
					},
				};
			} else {
				const videoBitrate =
					metadata.videoBitrate > 276000 ? 276000 : metadata.videoBitrate;
				const jobTemplate = ClipJobTemplate.LOW_CLIP_TEMPLATE;
				return {
					JobTemplate: jobTemplate,
					Role: process.env.AWS_ELEMENTAL_ROLE_ARN,
					Settings: {
						Inputs: [
							{
								FileInput: inputFileUrl,
							},
						],
						OutputGroups: [
							{
								Outputs: [
									{
										NameModifier: "_audio",
										AudioDescriptions: [
											{
												CodecSettings: {
													Codec: "AAC",
													AacSettings: {
														Bitrate: audioBitrate,
													},
												},
											},
										],
									},
									{
										NameModifier: "_low",
										VideoDescription: {
											Width: 360,
											Height: 360,
											CodecSettings: {
												Codec: "VP9",
												Vp9Settings: {
													Bitrate: videoBitrate,
													MaxBitrate: Math.round(
														videoBitrate * 1.45
													),
													GopSize: Math.round(
														2 *
															(outputFrameRateNumerator /
																outputFrameRateDenominator)
													),
													FramerateNumerator:
														outputFrameRateNumerator,
													FramerateDenominator:
														outputFrameRateDenominator,
												},
											},
										},
									},
								],
								OutputGroupSettings: {
									Type: "DASH_ISO_GROUP_SETTINGS",
									DashIsoGroupSettings: {
										Destination: `s3://${process.env.AWS_S3_BUCKET_NAME}/clip/${baseName}/stream/`,
									},
								},
							},
							{
								OutputGroupSettings: {
									Type: "FILE_GROUP_SETTINGS",
									FileGroupSettings: {
										Destination: `s3://${process.env.AWS_S3_BUCKET_NAME}/clip/${baseName}/${baseName}`,
									},
								},
							},
						],
					},
				};
			}
		}
	} catch (error) {
		throw error;
	}
}

// ----------------------------------------------------- Utilities  ---------------------------------------------------------

/**
 * Generates a URL for accessing a media resource on AWS S3, based on content type and resource type.
 *
 * @param {string} file - The original file name (e.g., 'abc123.mp4' or 'xyz456.jpeg').
 * @param {"attachment" | "memory" | "photo" | "moment" | "clip" | "displayPicture"} contentType - The logical type/category of content.
 * @param {"thumbnail" | "preview" | "image" | "video" | "audio" | "stream"} [resourceType] - The specific type of resource to generate a URL for.
 * @returns {string} The generated full S3 URL pointing to the specific resource.
 *
 * @example
 * urlGenerator("abc123.mp4", "moment", "thumbnail");
 * // Returns: https://<s3-base-url>/moment/abc123/abc123_thumbnail.jpeg
 */
export function urlGenerator(
	file: string,
	contentType: "attachment" | "memory" | "photo" | "moment" | "clip" | "displayPicture",
	resourceType?: "thumbnail" | "preview" | "image" | "video" | "audio" | "stream"
): string {
	let resourceKey: string = "";

	// Strip the file extension to get the base name (e.g., "abc123.mp4" -> "abc123")
	const baseName = file.split(".")[0];

	// Determine the resource key based on contentType and resourceType
	if (contentType === "attachment") {
		// Attachments can have images, videos, or thumbnails
		if (resourceType === "video") {
			resourceKey = `${baseName}.mp4`;
		} else if (resourceType === "image") {
			resourceKey = `${baseName}.jpeg`;
		} else if (resourceType === "thumbnail") {
			resourceKey = `${baseName}_thumbnail.jpeg`;
		}
	} else if (contentType === "memory") {
		// Memory content may have videos, images, or thumbnails
		if (resourceType === "video") {
			resourceKey = `${baseName}.mp4`;
		} else if (resourceType === "image") {
			resourceKey = `${baseName}.jpeg`;
		} else if (resourceType === "thumbnail") {
			resourceKey = `${baseName}_thumbnail.jpeg`;
		}
	} else if (contentType === "photo") {
		// Photos can have images or thumbnails
		if (resourceType === "image") {
			resourceKey = `${baseName}.jpeg`;
		} else if (resourceType === "thumbnail") {
			resourceKey = `${baseName}_thumbnail.jpeg`;
		}
	} else if (contentType === "moment") {
		// Moments can include video, preview, thumbnail, audio, or stream
		if (resourceType === "video") {
			resourceKey = `${baseName}.mp4`;
		} else if (resourceType === "preview") {
			resourceKey = `${baseName}_preview.mp4`;
		} else if (resourceType === "thumbnail") {
			resourceKey = `${baseName}_thumbnail.jpeg`;
		} else if (resourceType === "audio") {
			resourceKey = `${baseName}_audio.m4a`;
		} else if (resourceType === "stream") {
			// Streams are stored in a subdirectory
			resourceKey = `stream/${baseName}.mpd`;
		}
	} else if (contentType === "clip") {
		// Clips may contain video, preview, thumbnail, or stream
		if (resourceType === "video") {
			resourceKey = `${baseName}.mp4`;
		} else if (resourceType === "preview") {
			resourceKey = `${baseName}_preview.mp4`;
		} else if (resourceType === "thumbnail") {
			resourceKey = `${baseName}_thumbnail.jpeg`;
		} else if (resourceType === "stream") {
			resourceKey = `stream/${baseName}.mpd`;
		}
	} else {
		// If no match, default to using the file as-is
		resourceKey = file;
	}

	// Return the full S3 URL
	return `${process.env.AWS_S3_BASE_URL}/${contentType}/${baseName}/${resourceKey}`;
}

export function getKeywords(input: string): string[] {
	// Convert the input string to lowercase and split into words
	let words = input.toLowerCase().split(/\W+/); // Split by non-word characters

	// Filter out stop words and empty strings
	let keywords = words.filter((word) => word && !stopWords.includes(word));

	return keywords;
}

export function getMentions(input: string): string[] {
	const mentionPattern = /@\w+/g;
	const mentions = input.match(mentionPattern) || [];
	return mentions.map((mention) => mention.substring(1)); // Remove '@' symbol
}

export function getHashtags(input: string): string[] {
	const hashtagPattern = /#\w+/g;
	const hashtags = input.match(hashtagPattern) || [];
	return hashtags.map((hashtag) => hashtag.substring(1)); // Remove '#' symbol
}

export function getEmojis(input: string): string[] {
	const emojiPattern =
		/([\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F700}-\u{1F77F}]|[\u{1F780}-\u{1F7FF}]|[\u{1F800}-\u{1F8FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{FE00}-\u{FE0F}]|[\u{1F1E6}-\u{1F1FF}])/gu;
	const emojis = input.match(emojiPattern) || [];
	return emojis;
}

export function setExpirationTime(current: Date): Date {
	const now = new Date(current); // Create a new Date based on current
	now.setHours(now.getHours() + 24);
	return now;
}

// Helper function to determine if the error is transient
export const isTransientError = (error: any): boolean => {
	return (
		error?.name === "MongoNetworkError" || // Network issues
		error?.code === 251 || // NoPrimary error
		error?.code === 112 // WriteConflict error
	);
};

export const delay = (ms: number): Promise<void> =>
	new Promise((resolve) => setTimeout(resolve, ms));

export var mcClient: MediaConvertClient;

export function initMediaConvert() {
	mcClient = new MediaConvertClient({
		region: process.env.AWS_MEDIACONVERT_REGION,
	});
}
