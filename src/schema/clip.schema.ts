import { Schema } from "express-validator";
import { ValidSchemaFields } from "../types/util.type";

export const clipPostUploadSchema: Schema = {
	// metadata: {
	// 	in: ["body"],
	// 	isObject: {
	// 		bail: true,
	// 		errorMessage: "Metadata must be an object.",
	// 	},
	// 	notEmpty: {
	// 		bail: true,
	// 		errorMessage: "Metadata cannot be an empty object.",
	// 	},
	// 	errorMessage: "Metadata is required.",
	// },
	caption: {
		in: ["body"],
		optional: true,
		isString: {
			bail: true,
			errorMessage: "caption should be a string",
		},
		trim: true,
		notEmpty: {
			options: { ignore_whitespace: true },
			bail: true,
			errorMessage: "caption cannot be empty",
		},
		isLength: {
			options: { max: 400, min: 1 },
			bail: true,
			errorMessage: "caption should be atleast 1 and not exceed 400 characters",
		},
	},
	taggedLocation: {
		in: ["body"],
		optional: true,
		custom: {
			options: (value: any) => {
				if (typeof value !== "object" || Array.isArray(value)) {
					throw new Error("taggedLocation must be an object.");
				}
				const requiredFields = ["locationId", "name"];
				const missingFields = requiredFields.filter((key) => !(key in value));
				if (missingFields.length > 0) {
					throw new Error(
						`taggedLocation must include ${missingFields.join(", ")}.`
					);
				}
				return true;
			},
			bail: true,
		},
	},
	"taggedLocation.locationId": {
		optional: true,
		isString: {
			bail: true,
			errorMessage: "locationId should be a string",
		},
		trim: true,
		notEmpty: {
			options: { ignore_whitespace: true },
			bail: true,
			errorMessage: "locationId cannot be empty",
		},
		isLength: {
			options: { min: 24, max: 24 },
			bail: true,
			errorMessage: "locationId must be 24 characters long",
		},
		isHexadecimal: {
			bail: true,
			errorMessage: "location id must be a hexadecimal string",
		},
		errorMessage: "locationId is required",
	},
	"taggedLocation.name": {
		optional: true,
		isString: {
			bail: true,
			errorMessage: "location name should be a string",
		},
		trim: true,
		notEmpty: {
			options: { ignore_whitespace: true },
			bail: true,
			errorMessage: "location name cannot be empty",
		},
		errorMessage: "location name is required",
	},
	taggedAccounts: {
		in: ["body"],
		optional: true,
		isArray: {
			bail: true,
			errorMessage: "taggedAccounts should be an array",
			options: { min: 1 },
		},
	},
	"taggedAccounts.*": {
		isString: {
			bail: true,
			errorMessage: "accountId should be a string",
		},
		trim: true,
		notEmpty: {
			options: { ignore_whitespace: true },
			bail: true,
			errorMessage: "locationId cannot be empty",
		},
		isLength: {
			options: { min: 24, max: 24 },
			bail: true,
			errorMessage: "locationId must be 24 characters long",
		},
		isHexadecimal: {
			bail: true,
			errorMessage: "location id must be a hexadecimal string",
		},
		errorMessage: "accountId is required",
	},
	postFileInfo: {
		in: ["body"],
		custom: {
			options: (value: any) => {
				if (typeof value !== "object" || Array.isArray(value)) {
					throw new Error("taggedLocation must be an object.");
				}
				const requiredFields = [
					"fileName",
					"width",
					"height",
					"hash",
					"videoBitrate",
					"audioBitrate",
					"frameRate",
					"duration",
				];
				const missingFields = requiredFields.filter((key) => !(key in value));
				if (missingFields.length > 0) {
					throw new Error(
						`taggedLocation must include ${missingFields.join(", ")}.`
					);
				}
				return true;
			},
		},
	},
	"postFileInfo.fileName": {
		isString: {
			bail: true,
			errorMessage: "fileName should be a string",
		},
		trim: true,
		notEmpty: {
			options: { ignore_whitespace: true },
			bail: true,
			errorMessage: "fileName cannot be empty",
		},
		errorMessage: "fileName is required",
	},
	"postFileInfo.width": {
		isInt: {
			bail: true,
			errorMessage: "width should be an integer",
		},
		errorMessage: "width is required",
	},
	"postFileInfo.height": {
		isInt: {
			bail: true,
			errorMessage: "height should be an integer",
		},
		errorMessage: "height is required",
	},
	"postFileInfo.hash": {
		isString: {
			bail: true,
			errorMessage: "hash should be a string",
		},
		trim: true,
		notEmpty: {
			options: { ignore_whitespace: true },
			bail: true,
			errorMessage: "hash cannot be empty",
		},
		errorMessage: "hash is required",
	},
	"postFileInfo.duration": {
		isInt: {
			bail: true,
			options: [{ max: 900, min: 0 }],
			errorMessage: "duration should be an integer between 0 and 59",
		},
		errorMessage: "duration is required",
	},
	"postFileInfo.audioBitrate": {
		isInt: {
			bail: true,
			errorMessage: "audioBitrate should be an integer",
		},
		errorMessage: "audioBitrate is required",
	},
	"postFileInfo.videoBitrate": {
		isInt: {
			bail: true,
			errorMessage: "videoBitrate should be an integer",
		},
		errorMessage: "videoBitrate is required",
	},
	"postFileInfo.frameRate": {
		isFloat: {
			bail: true,
			errorMessage: "frameRate should be an number",
		},
		errorMessage: "frameRate is required",
	},
	topics: {
		in: ["body"],
		optional: true,
		isArray: {
			bail: true,
			options: { min: 1 },
			errorMessage: "topics should be an array",
		},
		custom: {
			options: (value: any[]) =>
				Array.isArray(value) && value.every((item) => typeof item === "string"),
			errorMessage: "topics must contain string values",
		},
	},
	advancedOptions: {
		in: ["body"],
		custom: {
			options: (value: any) => {
				if (typeof value !== "object" || Array.isArray(value)) {
					throw new Error("advancedOptions must be an object.");
				}
				const requiredFields = ["commentDisabled", "hideEngagement"];
				const missingFields = requiredFields.filter((key) => !(key in value));
				if (missingFields.length > 0) {
					throw new Error(
						`advancedOptions must include ${missingFields.join(", ")}.`
					);
				}
				return true;
			},
		},
		errorMessage: "advancedOptions is required",
	},
	"advancedOptions.commentDisabled": {
		isBoolean: {
			bail: true,
			errorMessage: "commentDisabled should be a boolean",
		},
		errorMessage: "commentDisabled is required",
	},
	"advancedOptions.hideEngagement": {
		isBoolean: {
			bail: true,
			errorMessage: "hideEngagement should be a boolean",
		},
		errorMessage: "hideEngagement is required",
	},
	videoCategory: {
		optional: true,
		isString: {
			bail: true,
			errorMessage: "videoCategory should be a string",
		},
		errorMessage: "videoCategory is required",
	},
};

export const clipPostUploadValidFields: ValidSchemaFields = {
	body: [
		"caption",
		"taggedLocation",
		"taggedAccounts",
		"postFileInfo",
		"topics",
		"advancedOptions",
		"videoCategory",
	],
};

export const clipPostPresignSchema: Schema = {
	postFileName: {
		in: ["body"],
		isString: {
			bail: true,
			errorMessage: "postFileName must be a  string.",
		},
		trim: true,
		notEmpty: {
			options: { ignore_whitespace: true },
			bail: true,
			errorMessage: "postFileName cannot be empty",
		},
		errorMessage: "postFileName is required",
	},
};

export const clipPostRetryUploadSchema: Schema = {
	jobId: {
		in: ["body"],
		isString: {
			bail: true,
			errorMessage: "jobId must be a  string.",
		},
		trim: true,
		notEmpty: {
			options: { ignore_whitespace: true },
			bail: true,
			errorMessage: "jobId cannot be empty",
		},
		errorMessage: "jobId is required",
	},
};

export const clipPostPresignValidFields: ValidSchemaFields = {
	body: ["postFileName"],
};

export const clipPostRetryUploadValidFields: ValidSchemaFields = {
	body: ["jobId"],
};

export const clipPostCommentUploadSchema: Schema = {
	postId: {
		in: ["body"],
		isString: {
			bail: true,
			errorMessage: "postId must be a  string.",
		},
		trim: true,
		notEmpty: {
			options: { ignore_whitespace: true },
			bail: true,
			errorMessage: "postId cannot be empty",
		},
		isLength: {
			options: { min: 24, max: 24 },
			bail: true,
			errorMessage: "postId must be 24 characters long",
		},
		isHexadecimal: {
			bail: true,
			errorMessage: "post id must be a hexadecimal string",
		},
		errorMessage: "postId is required",
	},
	comment: {
		in: ["body"],
		isString: {
			bail: true,
			errorMessage: "comment should be a string",
		},
		trim: true,
		notEmpty: {
			options: { ignore_whitespace: true },
			bail: true,
			errorMessage: "comment cannot be empty",
		},
		isLength: {
			options: { max: 400, min: 1 },
			bail: true,
			errorMessage: "comment should be atleast 1 and not exceed 400 characters",
		},
	},
	repliedTo: {
		in: ["body"],
		optional: true,
		isString: {
			bail: true,
			errorMessage: "repliedTo should be a string",
		},
		trim: true,
		notEmpty: {
			options: { ignore_whitespace: true },
			bail: true,
			errorMessage: "repliedTo cannot be empty",
		},
		isLength: {
			options: { min: 24, max: 24 },
			bail: true,
			errorMessage: "repliedTo must be 24 characters long",
		},
		isHexadecimal: {
			bail: true,
			errorMessage: "repliedTo id must be a hexadecimal string",
		},
		errorMessage: "repliedTo is required",
	},
};

export const clipPostCommentUploadValidFields: ValidSchemaFields = {
	body: ["postId", "comment", "repliedTo"],
};
