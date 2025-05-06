import { Schema } from "express-validator";
import { ValidSchemaFields } from "../types/util.type";

export const photoPostUploadSchema: Schema = {
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
		errorMessage: "locationId is required",
	},
	"taggedLocation.name": {
		optional: true,
		isString: {
			bail: true,
			errorMessage: "name should be a string",
		},
		trim: true,
		notEmpty: {
			options: { ignore_whitespace: true },
			bail: true,
			errorMessage: "name cannot be empty",
		},
		errorMessage: "name is required",
	},
	taggedAccounts: {
		in: ["body"],
		optional: true,
		isArray: {
			bail: true,
			errorMessage: "taggedAccounts should be an array",
		},
	},
	"taggedAccounts.*.accountId": {
		isString: {
			bail: true,
			errorMessage: "accountId should be a string",
		},
		trim: true,
		notEmpty: {
			options: { ignore_whitespace: true },
			bail: true,
			errorMessage: "accountId cannot be empty",
		},
		isLength: {
			options: { min: 24, max: 24 },
			bail: true,
			errorMessage: "accountId must be 24 characters long",
		},
		isHexadecimal: {
			bail: true,
			errorMessage: "accountId must be a hexadecimal string",
		},
		errorMessage: "accountId is required",
	},
	"taggedAccounts.*.position": {
		isArray: {
			bail: true,
			errorMessage: "position should be an array",
		},
		errorMessage: "position is required",
	},
	"taggedAccounts.*.position.*.index": {
		isFloat: {
			options: { min: 1, max: 10 },
			bail: true,
			errorMessage: "index should be a number",
		},
		errorMessage: "index is required",
	},
	"taggedAccounts.*.position.*.coord": {
		isObject: {
			bail: true,
			errorMessage: "coord should be an object",
		},
		errorMessage: "coord is required",
	},
	"taggedAccounts.*.position.*.coord.x": {
		isFloat: {
			bail: true,
			errorMessage: "x coordinate should be a number",
		},
		errorMessage: "x coordinate is required",
	},
	"taggedAccounts.*.position.*.coord.y": {
		isFloat: {
			bail: true,
			errorMessage: "y coordinate should be a number",
		},
		errorMessage: "y coordinate is required",
	},
	usedAudio: {
		in: ["body"],
		optional: true,
		custom: {
			options: (value: any) => {
				if (typeof value !== "object" || Array.isArray(value)) {
					throw new Error("usedAudio must be an object.");
				}
				const requiredFields = ["audioId", "usedSection"];
				const missingFields = requiredFields.filter((key) => !(key in value));
				if (missingFields.length > 0) {
					throw new Error(
						`usedAudio must include ${missingFields.join(", ")}.`
					);
				}
				return true;
			},
		},
	},
	"usedAudio.audioId": {
		optional: true,
		isString: {
			bail: true,
			errorMessage: "audioId should be a string",
		},
		trim: true,
		notEmpty: {
			options: { ignore_whitespace: true },
			bail: true,
			errorMessage: "audioId cannot be empty",
		},
		isLength: {
			options: { min: 24, max: 24 },
			bail: true,
			errorMessage: "audioId must be 24 characters long",
		},
		isHexadecimal: {
			bail: true,
			errorMessage: "audioId must be a hexadecimal string",
		},
		errorMessage: "audioId is required",
	},
	"usedAudio.usedSection": {
		optional: true,
		isArray: {
			bail: true,
			if: (value: any) => {
				if (value.length !== 2) {
					throw new Error("usedSection must be an array of 2 numbers.");
				}
				if (typeof value[0] === "number" && typeof value[1] === "number") {
					throw new Error("usedSection must be an array of 2 numbers.");
				}
				return true;
			},
			errorMessage: "usedSection must be an array.",
		},
	},
	topics: {
		in: ["body"],
		optional: true,
		custom: {
			options: (value: any[]) =>
				Array.isArray(value) && value.every((item) => typeof item === "string"),
			errorMessage: "topics must be an array of string values",
		},
	},
	postFileInfo: {
		in: ["body"],
		isArray: {
			bail: true,
			options: { min: 1, max: 10 },
			errorMessage:
				"postFileInfo must be a non-empty array with at most 10 elements.",
		},
	},
	"postFileInfo.*.fileName": {
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
	"postFileInfo.*.width": {
		isInt: {
			bail: true,
			errorMessage: "width should be an integer",
		},
		errorMessage: "width is required",
	},
	"postFileInfo.*.height": {
		isInt: {
			bail: true,
			errorMessage: "height should be an integer",
		},
		errorMessage: "height is required",
	},
	"postFileInfo.*.hash": {
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
	advancedOptions: {
		in: ["body"],
		isObject: {
			bail: true,
			errorMessage: "advancedOptions must be a object",
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
};

export const photoPostPresignSchema: Schema = {
	postFileName: {
		in: ["body"],
		isArray: {
			bail: true,
			options: { min: 1, max: 10 },
			errorMessage:
				"postFileName must be a non-empty array with at most 10 strings.",
		},
		custom: {
			options: (value: any) => {
				if (!value.every((item: unknown) => typeof item === "string")) {
					throw new Error("Each element in postFileName must be a string.");
				}

				return true;
			},
		},
	},
};

export const photoPostUploadValidFields: ValidSchemaFields = {
	body: [
		// "metadata",
		"caption",
		"taggedLocation",
		"usedAudio",
		"taggedAccounts",
		"topics",
		"postFileInfo",
		"advancedOptions",
	],
};

export const photoPostPresignValidFields: ValidSchemaFields = {
	body: ["postFileName"],
};

export const photoPostCommentUploadSchema: Schema = {
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

export const photoPostCommentUploadValidFields: ValidSchemaFields = {
	body: ["postId", "comment", "repliedTo"],
};
