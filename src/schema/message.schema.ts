import { CustomValidator, Schema } from "express-validator";
import { ValidSchemaFields } from "../types/util.type";

// <----------------------------------------------------CUSTOM VALIDATOR----------------------------------------------------------->

const validateRepliedInfo: CustomValidator = (value, { req }) => {
	const repliedInfo = req.body.repliedInfo;
	if (repliedInfo) {
		if (!repliedInfo.messageId || !repliedInfo.repliedTo) {
			throw new Error("Invaild request body");
		}
	}
	return true;
};

// <----------------------------------------------------ONE TO ONE CHAT SCHEMA----------------------------------------------------------->

export const postAttachmentOneToOneChatSchema: Schema = {
	sentTo: {
		in: ["body"],
		isString: { bail: true, errorMessage: "'sentTo' must be a string" },
		trim: true,
		notEmpty: {
			options: { ignore_whitespace: true },
			bail: true,
			errorMessage: "'sentTo' cannot be empty",
		},
		isLength: {
			options: { min: 24, max: 24 },
			bail: true,
			errorMessage: "'sentTo' must be 24 characters long",
		},
		isHexadecimal: {
			bail: true,
			errorMessage: "'sentTo' must be a hexadecimal string",
		},
		errorMessage: "'sentTo' is required",
	},
	postId: {
		in: ["body"],
		isString: { bail: true, errorMessage: "'postId' must be a string" },
		trim: true,
		notEmpty: {
			options: { ignore_whitespace: true },
			bail: true,
			errorMessage: "'postId' cannot be empty",
		},
		isLength: {
			options: { min: 24, max: 24 },
			bail: true,
			errorMessage: "'postId' must be 24 characters long",
		},
		isHexadecimal: {
			bail: true,
			errorMessage: "'postId' must be a hexadecimal string",
		},
		errorMessage: "'postId' is required",
	},
	caption: {
		in: ["body"],
		optional: true,
		trim: true,
		notEmpty: { bail: true, errorMessage: "'caption' cannot be empty" },
		isString: { bail: true, errorMessage: "'caption' must be a string" },
	},
	"content-type": {
		in: ["headers"],
		equals: {
			options: "application/x-www-form-urlencoded",
			errorMessage: "Inappropriate 'content-type' header value",
		},
		errorMessage: "'content-type' header is required",
	},
	authorization: {
		in: ["headers"],
		trim: true,
		notEmpty: {
			options: { ignore_whitespace: true },
			bail: true,
			errorMessage: "'authorization' header cannot be empty",
		},
		custom: { options: () => {} },
		errorMessage: "'authorization' header is required",
	},
};

export const postAttachmentOneToOneChatValidFields: ValidSchemaFields = {
	body: ["sentTo", "postId", "caption"],
};

export const accountAttachmentOneToOneChatSchema: Schema = {
	sentTo: {
		in: ["body"],
		trim: true,
		notEmpty: {
			options: { ignore_whitespace: true },
			bail: true,
			errorMessage: "'sentTo' cannot be empty",
		},
		isString: { bail: true, errorMessage: "'sentTo' must be a string" },
		isLength: {
			options: { min: 24, max: 24 },
			bail: true,
			errorMessage: "'sentTo' must be 24 characters long",
		},
		isHexadecimal: {
			bail: true,
			errorMessage: "'sentTo' must be a hexadecimal string",
		},
		errorMessage: "'sentTo' is required",
	},
	accountId: {
		in: ["body"],
		trim: true,
		notEmpty: {
			options: { ignore_whitespace: true },
			bail: true,
			errorMessage: "'accountId' cannot be empty",
		},
		isString: { bail: true, errorMessage: "'accountId' must be a string" },
		isLength: {
			options: { min: 24, max: 24 },
			bail: true,
			errorMessage: "'accountId' must be 24 characters long",
		},
		isHexadecimal: {
			bail: true,
			errorMessage: "'accountId' must be a hexadecimal string",
		},
		errorMessage: "'accountId' is required",
	},
	caption: {
		in: ["body"],
		optional: true,
		trim: true,
		notEmpty: { bail: true, errorMessage: "'caption' cannot be empty" },
		isString: { bail: true, errorMessage: "'caption' must be a string" },
	},
	"content-type": {
		in: ["headers"],
		equals: {
			options: "application/x-www-form-urlencoded",
			errorMessage: "Inappropriate 'content-type' header value",
		},
		errorMessage: "'content-type' header is required",
	},
	authorization: {
		in: ["headers"],
		trim: true,
		notEmpty: {
			options: { ignore_whitespace: true },
			bail: true,
			errorMessage: "'authorization' header cannot be empty",
		},
		custom: { options: () => {} },
		errorMessage: "'authorization' header is required",
	},
};

export const accountAttachmentOneToOneChatValidFields: ValidSchemaFields = {
	body: ["sentTo", "accountId", "caption"],
};

export const audioAttachmentOneToOneChatSchema: Schema = {
	sentTo: {
		in: ["body"],
		trim: true,
		notEmpty: {
			options: { ignore_whitespace: true },
			bail: true,
			errorMessage: "'sentTo' cannot be empty",
		},
		isString: { bail: true, errorMessage: "'sentTo' must be a string" },
		isLength: {
			options: { min: 24, max: 24 },
			bail: true,
			errorMessage: "'sentTo' must be 24 characters long",
		},
		isHexadecimal: {
			bail: true,
			errorMessage: "'sentTo' must be a hexadecimal string",
		},
		errorMessage: "'sentTo' is required",
	},
	audioId: {
		in: ["body"],
		trim: true,
		notEmpty: {
			options: { ignore_whitespace: true },
			bail: true,
			errorMessage: "'audioId' cannot be empty",
		},
		isString: { bail: true, errorMessage: "'accountId' must be a string" },
		isLength: {
			options: { min: 24, max: 24 },
			bail: true,
			errorMessage: "'audioId' must be 24 characters long",
		},
		isHexadecimal: {
			bail: true,
			errorMessage: "'audioId' must be a hexadecimal string",
		},
		errorMessage: "'audioId' is required",
	},
	caption: {
		in: ["body"],
		optional: true,
		trim: true,
		notEmpty: { bail: true, errorMessage: "'caption' cannot be empty" },
		isString: { bail: true, errorMessage: "'caption' must be a string" },
	},
	"content-type": {
		in: ["headers"],
		equals: {
			options: "application/x-www-form-urlencoded",
			errorMessage: "Inappropriate 'content-type' header value",
		},
		errorMessage: "'content-type' header is required",
	},
	authorization: {
		in: ["headers"],
		trim: true,
		notEmpty: {
			options: { ignore_whitespace: true },
			bail: true,
			errorMessage: "'authorization' header cannot be empty",
		},
		custom: { options: () => {} },
		errorMessage: "'authorization' header is required",
	},
};

export const audioAttachmentOneToOneChatValidFields: ValidSchemaFields = {
	body: ["sentTo", "type", "audioId", "caption"],
};

export const memoryAttachmentOneToOneChatSchema: Schema = {
	sentTo: {
		in: ["body"],
		trim: true,
		notEmpty: {
			options: { ignore_whitespace: true },
			bail: true,
			errorMessage: "'sentTo' cannot be empty",
		},
		isString: { bail: true, errorMessage: "'sentTo' must be a string" },
		isLength: {
			options: { min: 24, max: 24 },
			bail: true,
			errorMessage: "'sentTo' must be 24 characters long",
		},
		isHexadecimal: {
			bail: true,
			errorMessage: "'sentTo' must be a hexadecimal string",
		},
		errorMessage: "'sentTo' is required",
	},
	memoryId: {
		in: ["body"],
		trim: true,
		notEmpty: {
			options: { ignore_whitespace: true },
			bail: true,
			errorMessage: "'memoryId' cannot be empty",
		},
		isString: { bail: true, errorMessage: "'memoryId' must be a string" },
		isLength: {
			options: { min: 24, max: 24 },
			bail: true,
			errorMessage: "'memoryId' must be 24 characters long",
		},
		isHexadecimal: {
			bail: true,
			errorMessage: "'memoryId' must be a hexadecimal string",
		},
		errorMessage: "'memoryId' is required",
	},
	caption: {
		in: ["body"],
		optional: true,
		trim: true,
		notEmpty: { bail: true, errorMessage: "'caption' cannot be empty" },
		isString: { bail: true, errorMessage: "'caption' must be a string" },
	},
	"content-type": {
		in: ["headers"],
		equals: {
			options: "application/x-www-form-urlencoded",
			errorMessage: "Inappropriate 'content-type' header value",
		},
		errorMessage: "'content-type' header is required",
	},
	authorization: {
		in: ["headers"],
		trim: true,
		notEmpty: {
			options: { ignore_whitespace: true },
			bail: true,
			errorMessage: "'authorization' header cannot be empty",
		},
		custom: { options: () => {} },
		errorMessage: "'authorization' header is required",
	},
};

export const memoryAttachmentOneToOneChatValidFields: ValidSchemaFields = {
	body: ["sentTo", "memoryId", "caption"],
};

export const highlightAttachmentOneToOneChatSchema: Schema = {
	sentTo: {
		in: ["body"],
		trim: true,
		notEmpty: {
			options: { ignore_whitespace: true },
			bail: true,
			errorMessage: "'sentTo' cannot be empty",
		},
		isString: { bail: true, errorMessage: "'sentTo' must be a string" },
		isLength: {
			options: { min: 24, max: 24 },
			bail: true,
			errorMessage: "'sentTo' must be 24 characters long",
		},
		isHexadecimal: {
			bail: true,
			errorMessage: "'sentTo' must be a hexadecimal string",
		},
		errorMessage: "'sentTo' is required",
	},
	memoryId: {
		in: ["body"],
		trim: true,
		notEmpty: {
			options: { ignore_whitespace: true },
			bail: true,
			errorMessage: "'memoryId' cannot be empty",
		},
		isString: { bail: true, errorMessage: "'memoryId' must be a string" },
		isLength: {
			options: { min: 24, max: 24 },
			bail: true,
			errorMessage: "'memoryId' must be 24 characters long",
		},
		isHexadecimal: {
			bail: true,
			errorMessage: "'memoryId' must be a hexadecimal string",
		},
		errorMessage: "'memoryId' is required",
	},
	highlightId: {
		in: ["body"],
		trim: true,
		notEmpty: {
			options: { ignore_whitespace: true },
			bail: true,
			errorMessage: "'highlightId' cannot be empty",
		},
		isString: { bail: true, errorMessage: "'highlightId' must be a string" },
		isLength: {
			options: { min: 24, max: 24 },
			bail: true,
			errorMessage: "'highlightId' must be 24 characters long",
		},
		isHexadecimal: {
			bail: true,
			errorMessage: "'highlightId' must be a hexadecimal string",
		},
		errorMessage: "'highlightId' is required",
	},
	caption: {
		in: ["body"],
		optional: true,
		trim: true,
		notEmpty: { bail: true, errorMessage: "'caption' cannot be empty" },
		isString: { bail: true, errorMessage: "'caption' must be a string" },
	},
	"content-type": {
		in: ["headers"],
		equals: {
			options: "application/x-www-form-urlencoded",
			errorMessage: "Inappropriate 'content-type' header value",
		},
		errorMessage: "'content-type' header is required",
	},
	authorization: {
		in: ["headers"],
		trim: true,
		notEmpty: {
			options: { ignore_whitespace: true },
			bail: true,
			errorMessage: "'authorization' header cannot be empty",
		},
		custom: { options: () => {} },
		errorMessage: "'authorization' header is required",
	},
};

export const highlightAttachmentOneToOneChatValidFields: ValidSchemaFields = {
	body: ["sentTo", "memoryId", "highlightId", "caption"],
};

export const oneToOneChatTextSchema: Schema = {
	sentTo: {
		in: ["body"],
		trim: true,
		notEmpty: {
			options: { ignore_whitespace: true },
			bail: true,
			errorMessage: "'sentTo' cannot be empty",
		},
		isString: { bail: true, errorMessage: "'sentTo' must be a string" },
		isLength: {
			options: { min: 24, max: 24 },
			bail: true,
			errorMessage: "'sentTo' must be 24 characters long",
		},
		isHexadecimal: {
			bail: true,
			errorMessage: "'sentTo' must be a hexadecimal string",
		},
		errorMessage: "'sentTo' is required",
	},
	content: {
		in: ["body"],
		trim: true,
		notEmpty: { bail: true, errorMessage: "'content' cannot be empty" },
		isString: { bail: true, errorMessage: "'content' must be a string" },
		errorMessage: "'content' is required",
	},
	"repliedInfo.messageId": {
		in: ["body"],
		optional: true,
		custom: { options: validateRepliedInfo },
		trim: true,
		notEmpty: {
			options: { ignore_whitespace: true },
			bail: true,
			errorMessage: "'sentTo' cannot be empty",
		},
		isString: { bail: true, errorMessage: "'sentTo' must be a string" },
		isLength: {
			options: { min: 24, max: 24 },
			bail: true,
			errorMessage: "'sentTo' must be 24 characters long",
		},
		isHexadecimal: {
			bail: true,
			errorMessage: "'sentTo' must be a hexadecimal string",
		},
		errorMessage: "'sentTo' is required",
	},
	"repliedInfo.repliedTo": {
		in: ["body"],
		optional: true,
		custom: { options: validateRepliedInfo },
		trim: true,
		notEmpty: {
			options: { ignore_whitespace: true },
			bail: true,
			errorMessage: "'sentTo' cannot be empty",
		},
		isString: { bail: true, errorMessage: "'sentTo' must be a string" },
		isLength: {
			options: { min: 24, max: 24 },
			bail: true,
			errorMessage: "'sentTo' must be 24 characters long",
		},
		isHexadecimal: {
			bail: true,
			errorMessage: "'sentTo' must be a hexadecimal string",
		},
		errorMessage: "'sentTo' is required",
	},
	"content-type": {
		in: ["headers"],
		equals: {
			options: "application/x-www-form-urlencoded",
			errorMessage: "Inappropriate 'content-type' header value",
		},
		errorMessage: "'content-type' header is required",
	},
	authorization: {
		in: ["headers"],
		trim: true,
		notEmpty: {
			options: { ignore_whitespace: true },
			bail: true,
			errorMessage: "'authorization' header cannot be empty",
		},
		custom: { options: () => {} },
		errorMessage: "'authorization' header is required",
	},
};

export const oneToOneChatTextValidFields: ValidSchemaFields = {
	body: ["sentTo", "memoryId", "caption", "repliedInfo"],
};

export const oneToOneChatFileAttachmentSchema: Schema = {
	sentTo: {
		in: ["body"],
		isString: { bail: true, errorMessage: "'sentTo' must be a string" },
		trim: true,
		notEmpty: {
			options: { ignore_whitespace: true },
			bail: true,
			errorMessage: "'sentTo' cannot be empty",
		},
		isLength: {
			options: { min: 24, max: 24 },
			bail: true,
			errorMessage: "'sentTo' must be 24 characters long",
		},
		isHexadecimal: {
			bail: true,
			errorMessage: "'sentTo' must be a hexadecimal string",
		},
		errorMessage: "'sentTo' is required",
	},
	fileDataList: {
		in: ["body"],
		isArray: {
			bail: true,
			options: { min: 1, max: 10 },
			errorMessage: "'fileDataList' must be an array",
		},
		errorMessage: "'fileDataList' is required",
	},
	"fileDataList.*.width": {
		isInt: {
			bail: true,
			errorMessage: "file width should be a number",
		},
		errorMessage: "file width is required required",
	},
	"fileDataList.*.height": {
		isInt: {
			bail: true,
			errorMessage: "file height should be a number",
		},
		errorMessage: "file height is required",
	},
	"fileDataList.*.duration": {
		optional: true,
		isFloat: {
			bail: true,
			errorMessage: "file duration should be a number",
		},
		errorMessage: "file duration is required",
	},
	"fileDataList.*.fileName": {
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
	"fileDataList.*.blurHash": {
		isString: {
			bail: true,
			errorMessage: "blurHash should be a string",
		},
		trim: true,
		notEmpty: {
			options: { ignore_whitespace: true },
			bail: true,
			errorMessage: "blurHash cannot be empty",
		},
		errorMessage: "blurHash is required",
	},
	"fileDataList.*.mediaType": {
		custom: {
			options: (value: any) => {
				if (value === "video" || value === "image") {
					return true;
				} else {
					throw new Error("mediaType must be a 'video' or 'image'.");
				}
			},
			bail: true,
		},
		errorMessage: "mediaType is required",
	},
	caption: {
		in: ["body"],
		optional: true,
		isString: { bail: true, errorMessage: "'caption' must be a string" },
		trim: true,
		notEmpty: {
			options: { ignore_whitespace: true },
			bail: true,
			errorMessage: "'caption' cannot be empty",
		},
	},
	// "content-type": {
	// 	in: ["headers"],
	// 	equals: {
	// 		options: "application/json",
	// 		errorMessage: "Inappropriate 'content-type' header value",
	// 	},
	// 	errorMessage: "'content-type' header is required",
	// },
	// authorization: {
	// 	in: ["headers"],
	// 	trim: true,
	// 	notEmpty: {
	// 		options: { ignore_whitespace: true },
	// 		bail: true,
	// 		errorMessage: "'authorization' header cannot be empty",
	// 	},
	// 	custom: { options: () => {} },
	// 	errorMessage: "'authorization' header is required",
	// },
};

export const oneToOneChatFileAttachmentValidFields: ValidSchemaFields = {
	body: ["sentTo", "caption", "fileDataList"],
};

export const oneToOneChatFileAttachmentUploadPresignSchema: Schema = {
	sentTo: {
		in: ["body"],
		trim: true,
		notEmpty: {
			options: { ignore_whitespace: true },
			bail: true,
			errorMessage: "'sentTo' cannot be empty",
		},
		isString: { bail: true, errorMessage: "'sentTo' must be a string" },
		isLength: {
			options: { min: 24, max: 24 },
			bail: true,
			errorMessage: "'sentTo' must be 24 characters long",
		},
		isHexadecimal: {
			bail: true,
			errorMessage: "'sentTo' must be a hexadecimal string",
		},
		errorMessage: "'sentTo' is required",
	},
	attachmentPresignParams: {
		in: ["body"],
		isArray: {
			bail: true,
			options: { min: 1, max: 10 },
			errorMessage: "'attachmentPresignParams' must be an array",
		},
		errorMessage: "'attachmentPresignParams' is required",
	},
	"attachmentPresignParams.*.fileName": {
		in: ["body"],
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
	"attachmentPresignParams.*.mediaType": {
		custom: {
			options: (value) => {
				if (value === "video" || value === "image") {
					return true;
				} else {
					throw new Error("file type must be a 'video' or 'image'.");
				}
			},
			bail: true,
		},
		errorMessage: "file type is required",
	},
	// "content-type": {
	// 	in: ["headers"],
	// 	equals: {
	// 		options: "application/json",
	// 		errorMessage: "Inappropriate 'content-type' header value",
	// 	},
	// 	errorMessage: "'content-type' header is required",
	// },
};

export const oneToOneChatFileAttachmentUploadPresignValidFields: ValidSchemaFields = {
	body: ["sentTo", "attachmentPresignParams"],
};

// <----------------------------------------------------GROUP CHAT SCHEMA----------------------------------------------------------->

export const postAttachmentGroupChatSchema: Schema = {
	chatId: {
		in: ["body"],
		trim: true,
		notEmpty: {
			options: { ignore_whitespace: true },
			bail: true,
			errorMessage: "'chatId' cannot be empty",
		},
		isString: { bail: true, errorMessage: "'chatId' must be a string" },
		isLength: {
			options: { min: 24, max: 24 },
			bail: true,
			errorMessage: "'chatId' must be 24 characters long",
		},
		isHexadecimal: {
			bail: true,
			errorMessage: "'chatId' must be a hexadecimal string",
		},
		errorMessage: "'chatId' is required",
	},
	postId: {
		in: ["body"],
		trim: true,
		notEmpty: {
			options: { ignore_whitespace: true },
			bail: true,
			errorMessage: "'postId' cannot be empty",
		},
		isString: { bail: true, errorMessage: "'postId' must be a string" },
		isLength: {
			options: { min: 24, max: 24 },
			bail: true,
			errorMessage: "'postId' must be 24 characters long",
		},
		isHexadecimal: {
			bail: true,
			errorMessage: "'postId' must be a hexadecimal string",
		},
		errorMessage: "'postId' is required",
	},
	caption: {
		in: ["body"],
		optional: true,
		trim: true,
		notEmpty: { bail: true, errorMessage: "'caption' cannot be empty" },
		isString: { bail: true, errorMessage: "'caption' must be a string" },
	},
	"content-type": {
		in: ["headers"],
		equals: {
			options: "application/x-www-form-urlencoded",
			errorMessage: "Inappropriate 'content-type' header value",
		},
		errorMessage: "'content-type' header is required",
	},
	authorization: {
		in: ["headers"],
		trim: true,
		notEmpty: {
			options: { ignore_whitespace: true },
			bail: true,
			errorMessage: "'authorization' header cannot be empty",
		},
		custom: { options: () => {} },
		errorMessage: "'authorization' header is required",
	},
};

export const postAttachmentGroupChatValidFields: ValidSchemaFields = {
	body: ["chatId", "postId", "caption"],
};

export const accountAttachmentGroupChatSchema: Schema = {
	chatId: {
		in: ["body"],
		trim: true,
		notEmpty: {
			options: { ignore_whitespace: true },
			bail: true,
			errorMessage: "'chatId' cannot be empty",
		},
		isString: { bail: true, errorMessage: "'chatId' must be a string" },
		isLength: {
			options: { min: 24, max: 24 },
			bail: true,
			errorMessage: "'chatId' must be 24 characters long",
		},
		isHexadecimal: {
			bail: true,
			errorMessage: "'chatId' must be a hexadecimal string",
		},
		errorMessage: "'chatId' is required",
	},
	accountId: {
		in: ["body"],
		trim: true,
		notEmpty: {
			options: { ignore_whitespace: true },
			bail: true,
			errorMessage: "'accountId' cannot be empty",
		},
		isString: { bail: true, errorMessage: "'accountId' must be a string" },
		isLength: {
			options: { min: 24, max: 24 },
			bail: true,
			errorMessage: "'accountId' must be 24 characters long",
		},
		isHexadecimal: {
			bail: true,
			errorMessage: "'accountId' must be a hexadecimal string",
		},
		errorMessage: "'accountId' is required",
	},
	caption: {
		in: ["body"],
		optional: true,
		trim: true,
		notEmpty: { bail: true, errorMessage: "'caption' cannot be empty" },
		isString: { bail: true, errorMessage: "'caption' must be a string" },
	},
	"content-type": {
		in: ["headers"],
		equals: {
			options: "application/x-www-form-urlencoded",
			errorMessage: "Inappropriate 'content-type' header value",
		},
		errorMessage: "'content-type' header is required",
	},
	authorization: {
		in: ["headers"],
		trim: true,
		notEmpty: {
			options: { ignore_whitespace: true },
			bail: true,
			errorMessage: "'authorization' header cannot be empty",
		},
		custom: { options: () => {} },
		errorMessage: "'authorization' header is required",
	},
};

export const accountAttachmentGroupChatValidFields: ValidSchemaFields = {
	body: ["chatId", "accountId", "caption"],
};

export const audioAttachmentGroupChatSchema: Schema = {
	chatId: {
		in: ["body"],
		trim: true,
		notEmpty: {
			options: { ignore_whitespace: true },
			bail: true,
			errorMessage: "'chatId' cannot be empty",
		},
		isString: { bail: true, errorMessage: "'chatId' must be a string" },
		isLength: {
			options: { min: 24, max: 24 },
			bail: true,
			errorMessage: "'chatId' must be 24 characters long",
		},
		isHexadecimal: {
			bail: true,
			errorMessage: "'chatId' must be a hexadecimal string",
		},
		errorMessage: "'chatId' is required",
	},
	audioId: {
		in: ["body"],
		trim: true,
		notEmpty: {
			options: { ignore_whitespace: true },
			bail: true,
			errorMessage: "'audioId' cannot be empty",
		},
		isString: { bail: true, errorMessage: "'accountId' must be a string" },
		isLength: {
			options: { min: 24, max: 24 },
			bail: true,
			errorMessage: "'audioId' must be 24 characters long",
		},
		isHexadecimal: {
			bail: true,
			errorMessage: "'audioId' must be a hexadecimal string",
		},
		errorMessage: "'audioId' is required",
	},
	caption: {
		in: ["body"],
		optional: true,
		trim: true,
		notEmpty: { bail: true, errorMessage: "'caption' cannot be empty" },
		isString: { bail: true, errorMessage: "'caption' must be a string" },
	},
	"content-type": {
		in: ["headers"],
		equals: {
			options: "application/x-www-form-urlencoded",
			errorMessage: "Inappropriate 'content-type' header value",
		},
		errorMessage: "'content-type' header is required",
	},
	authorization: {
		in: ["headers"],
		trim: true,
		notEmpty: {
			options: { ignore_whitespace: true },
			bail: true,
			errorMessage: "'authorization' header cannot be empty",
		},
		custom: { options: () => {} },
		errorMessage: "'authorization' header is required",
	},
};

export const audioAttachmentGroupChatValidFields: ValidSchemaFields = {
	body: ["chatId", "type", "audioId", "caption"],
};

export const memoryAttachmentGroupChatSchema: Schema = {
	chatId: {
		in: ["body"],
		trim: true,
		notEmpty: {
			options: { ignore_whitespace: true },
			bail: true,
			errorMessage: "'chatId' cannot be empty",
		},
		isString: { bail: true, errorMessage: "'chatId' must be a string" },
		isLength: {
			options: { min: 24, max: 24 },
			bail: true,
			errorMessage: "'chatId' must be 24 characters long",
		},
		isHexadecimal: {
			bail: true,
			errorMessage: "'chatId' must be a hexadecimal string",
		},
		errorMessage: "'chatId' is required",
	},
	memoryId: {
		in: ["body"],
		trim: true,
		notEmpty: {
			options: { ignore_whitespace: true },
			bail: true,
			errorMessage: "'memoryId' cannot be empty",
		},
		isString: { bail: true, errorMessage: "'memoryId' must be a string" },
		isLength: {
			options: { min: 24, max: 24 },
			bail: true,
			errorMessage: "'memoryId' must be 24 characters long",
		},
		isHexadecimal: {
			bail: true,
			errorMessage: "'memoryId' must be a hexadecimal string",
		},
		errorMessage: "'memoryId' is required",
	},
	caption: {
		in: ["body"],
		optional: true,
		trim: true,
		notEmpty: { bail: true, errorMessage: "'caption' cannot be empty" },
		isString: { bail: true, errorMessage: "'caption' must be a string" },
	},
	"content-type": {
		in: ["headers"],
		equals: {
			options: "application/x-www-form-urlencoded",
			errorMessage: "Inappropriate 'content-type' header value",
		},
		errorMessage: "'content-type' header is required",
	},
	authorization: {
		in: ["headers"],
		trim: true,
		notEmpty: {
			options: { ignore_whitespace: true },
			bail: true,
			errorMessage: "'authorization' header cannot be empty",
		},
		custom: { options: () => {} },
		errorMessage: "'authorization' header is required",
	},
};

export const memoryAttachmentGroupChatValidFields: ValidSchemaFields = {
	body: ["chatId", "memoryId", "caption"],
};

export const highlightAttachmentGroupChatSchema: Schema = {
	chatId: {
		in: ["body"],
		trim: true,
		notEmpty: {
			options: { ignore_whitespace: true },
			bail: true,
			errorMessage: "'chatId' cannot be empty",
		},
		isString: { bail: true, errorMessage: "'chatId' must be a string" },
		isLength: {
			options: { min: 24, max: 24 },
			bail: true,
			errorMessage: "'chatId' must be 24 characters long",
		},
		isHexadecimal: {
			bail: true,
			errorMessage: "'chatId' must be a hexadecimal string",
		},
		errorMessage: "'chatId' is required",
	},
	memoryId: {
		in: ["body"],
		trim: true,
		notEmpty: {
			options: { ignore_whitespace: true },
			bail: true,
			errorMessage: "'memoryId' cannot be empty",
		},
		isString: { bail: true, errorMessage: "'memoryId' must be a string" },
		isLength: {
			options: { min: 24, max: 24 },
			bail: true,
			errorMessage: "'memoryId' must be 24 characters long",
		},
		isHexadecimal: {
			bail: true,
			errorMessage: "'memoryId' must be a hexadecimal string",
		},
		errorMessage: "'memoryId' is required",
	},
	highlightId: {
		in: ["body"],
		trim: true,
		notEmpty: {
			options: { ignore_whitespace: true },
			bail: true,
			errorMessage: "'highlightId' cannot be empty",
		},
		isString: { bail: true, errorMessage: "'highlightId' must be a string" },
		isLength: {
			options: { min: 24, max: 24 },
			bail: true,
			errorMessage: "'highlightId' must be 24 characters long",
		},
		isHexadecimal: {
			bail: true,
			errorMessage: "'highlightId' must be a hexadecimal string",
		},
		errorMessage: "'highlightId' is required",
	},
	caption: {
		in: ["body"],
		optional: true,
		trim: true,
		notEmpty: { bail: true, errorMessage: "'caption' cannot be empty" },
		isString: { bail: true, errorMessage: "'caption' must be a string" },
	},
	"content-type": {
		in: ["headers"],
		equals: {
			options: "application/x-www-form-urlencoded",
			errorMessage: "Inappropriate 'content-type' header value",
		},
		errorMessage: "'content-type' header is required",
	},
	authorization: {
		in: ["headers"],
		trim: true,
		notEmpty: {
			options: { ignore_whitespace: true },
			bail: true,
			errorMessage: "'authorization' header cannot be empty",
		},
		custom: { options: () => {} },
		errorMessage: "'authorization' header is required",
	},
};

export const highlightAttachmentGroupChatValidFields: ValidSchemaFields = {
	body: ["chatId", "memoryId", "highlightId", "caption"],
};

export const groupChatTextSchema: Schema = {
	chatId: {
		in: ["body"],
		trim: true,
		notEmpty: {
			options: { ignore_whitespace: true },
			bail: true,
			errorMessage: "'chatId' cannot be empty",
		},
		isString: { bail: true, errorMessage: "'chatId' must be a string" },
		isLength: {
			options: { min: 24, max: 24 },
			bail: true,
			errorMessage: "'chatId' must be 24 characters long",
		},
		isHexadecimal: {
			bail: true,
			errorMessage: "'chatId' must be a hexadecimal string",
		},
		errorMessage: "'chatId' is required",
	},
	content: {
		in: ["body"],
		trim: true,
		notEmpty: { bail: true, errorMessage: "'content' cannot be empty" },
		isString: { bail: true, errorMessage: "'content' must be a string" },
		errorMessage: "'content' is required",
	},
	"repliedInfo.messageId": {
		in: ["body"],
		optional: true,
		custom: { options: validateRepliedInfo },
		trim: true,
		notEmpty: {
			options: { ignore_whitespace: true },
			bail: true,
			errorMessage: "'sentTo' cannot be empty",
		},
		isString: { bail: true, errorMessage: "'sentTo' must be a string" },
		isLength: {
			options: { min: 24, max: 24 },
			bail: true,
			errorMessage: "'sentTo' must be 24 characters long",
		},
		isHexadecimal: {
			bail: true,
			errorMessage: "'sentTo' must be a hexadecimal string",
		},
		errorMessage: "'sentTo' is required",
	},
	"repliedInfo.repliedTo": {
		in: ["body"],
		optional: true,
		custom: { options: validateRepliedInfo },
		trim: true,
		notEmpty: {
			options: { ignore_whitespace: true },
			bail: true,
			errorMessage: "'sentTo' cannot be empty",
		},
		isString: { bail: true, errorMessage: "'sentTo' must be a string" },
		isLength: {
			options: { min: 24, max: 24 },
			bail: true,
			errorMessage: "'sentTo' must be 24 characters long",
		},
		isHexadecimal: {
			bail: true,
			errorMessage: "'sentTo' must be a hexadecimal string",
		},
		errorMessage: "'sentTo' is required",
	},
	"content-type": {
		in: ["headers"],
		equals: {
			options: "application/x-www-form-urlencoded",
			errorMessage: "Inappropriate 'content-type' header value",
		},
		errorMessage: "'content-type' header is required",
	},
	authorization: {
		in: ["headers"],
		trim: true,
		notEmpty: {
			options: { ignore_whitespace: true },
			bail: true,
			errorMessage: "'authorization' header cannot be empty",
		},
		custom: { options: () => {} },
		errorMessage: "'authorization' header is required",
	},
};

export const groupChatTextValidFields: ValidSchemaFields = {
	body: ["chatId", "memoryId", "caption", "repliedInfo"],
};

export const groupChatFileAttachmentSchema: Schema = {
	chatId: {
		in: ["body"],
		trim: true,
		notEmpty: {
			options: { ignore_whitespace: true },
			bail: true,
			errorMessage: "'chatId' cannot be empty",
		},
		isString: { bail: true, errorMessage: "'chatId' must be a string" },
		isLength: {
			options: { min: 24, max: 24 },
			bail: true,
			errorMessage: "'chatId' must be 24 characters long",
		},
		isHexadecimal: {
			bail: true,
			errorMessage: "'chatId' must be a hexadecimal string",
		},
		errorMessage: "'chatId' is required",
	},
	fileDataList: {
		in: ["body"],
		isArray: {
			bail: true,
			options: { min: 1, max: 10 },
			errorMessage: "'fileDataList' must be an array",
		},
		errorMessage: "'fileDataList' is required",
	},
	"fileDataList.*.width": {
		isInt: {
			bail: true,
			errorMessage: "file width should be a number",
		},
		errorMessage: "file width is required required",
	},
	"fileDataList.*.height": {
		isInt: {
			bail: true,
			errorMessage: "file height should be a number",
		},
		errorMessage: "file height is required",
	},
	"fileDataList.*.duration": {
		optional: true,
		isFloat: {
			bail: true,
			errorMessage: "file duration should be a number",
		},
		errorMessage: "file duration is required",
	},
	"fileDataList.*.fileName": {
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
	"fileDataList.*.blurHash": {
		isString: {
			bail: true,
			errorMessage: "blurHash should be a string",
		},
		trim: true,
		notEmpty: {
			options: { ignore_whitespace: true },
			bail: true,
			errorMessage: "blurHash cannot be empty",
		},
		errorMessage: "blurHash is required",
	},
	"fileDataList.*.mediaType": {
		custom: {
			options: (value: any) => {
				if (value === "video" || value === "image") {
					return true;
				} else {
					throw new Error("mediaType must be a 'video' or 'image'.");
				}
			},
			bail: true,
		},
		errorMessage: "mediaType is required",
	},
	caption: {
		in: ["body"],
		optional: true,
		trim: true,
		notEmpty: { bail: true, errorMessage: "'caption' cannot be empty" },
		isString: { bail: true, errorMessage: "'caption' must be a string" },
	},
	// "content-type": {
	// 	in: ["headers"],
	// 	equals: {
	// 		options: "application/json",
	// 		errorMessage: "Inappropriate 'content-type' header value",
	// 	},
	// 	errorMessage: "'content-type' header is required",
	// },
	// authorization: {
	// 	in: ["headers"],
	// 	trim: true,
	// 	notEmpty: {
	// 		options: { ignore_whitespace: true },
	// 		bail: true,
	// 		errorMessage: "'authorization' header cannot be empty",
	// 	},
	// 	custom: { options: () => {} },
	// 	errorMessage: "'authorization' header is required",
	// },
};

export const groupChatFileAttachmentValidFields: ValidSchemaFields = {
	body: ["chatId", "caption", "fileDataList"],
};

export const groupChatFileAttachmentUploadPresignSchema: Schema = {
	sentTo: {
		in: ["body"],
		trim: true,
		notEmpty: {
			options: { ignore_whitespace: true },
			bail: true,
			errorMessage: "'sentTo' cannot be empty",
		},
		isString: { bail: true, errorMessage: "'sentTo' must be a string" },
		isLength: {
			options: { min: 24, max: 24 },
			bail: true,
			errorMessage: "'sentTo' must be 24 characters long",
		},
		isHexadecimal: {
			bail: true,
			errorMessage: "'sentTo' must be a hexadecimal string",
		},
		errorMessage: "'sentTo' is required",
	},
	attachmentPresignParams: {
		in: ["body"],
		isArray: {
			bail: true,
			options: { min: 1, max: 10 },
			errorMessage: "'attachmentPresignParams' must be an array",
		},
		errorMessage: "'attachmentPresignParams' is required",
	},
	"attachmentPresignParams.*.fileName": {
		in: ["body"],
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
	"attachmentPresignParams.*.mediaType": {
		custom: {
			options: (value) => {
				if (value === "video" || value === "image") {
					return true;
				} else {
					throw new Error("file type must be a 'video' or 'image'.");
				}
			},
			bail: true,
		},
		errorMessage: "file type is required",
	},
	// "content-type": {
	// 	in: ["headers"],
	// 	equals: {
	// 		options: "application/json",
	// 		errorMessage: "Inappropriate 'content-type' header value",
	// 	},
	// 	errorMessage: "'content-type' header is required",
	// },
};

export const groupChatFileAttachmentUploadPresignValidFields: ValidSchemaFields = {
	body: ["sentTo", "attachmentPresignParams"],
};

export const createGroupChatSchema: Schema = {
	name: {
		in: ["body"],
		trim: true,
		notEmpty: {
			options: { ignore_whitespace: true },
			bail: true,
			errorMessage: "name cannot be empty",
		},
		isString: { bail: true, errorMessage: "name must be a string" },
		errorMessage: "name is required",
	},
	participantIdList: {
		in: ["body"],
		optional: true,
		isArray: {
			bail: true,
			errorMessage: "participantIdList should be an array",
			options: { min: 2, max: 20 },
		},
	},
	"participantIdList.*": {
		isString: {
			bail: true,
			errorMessage: "participantIdList should be a string",
		},
		trim: true,
		notEmpty: {
			options: { ignore_whitespace: true },
			bail: true,
			errorMessage: "participantIdList cannot be empty",
		},
		isLength: {
			options: { min: 24, max: 24 },
			bail: true,
			errorMessage: "participantIdList must be 24 characters long",
		},
		isHexadecimal: {
			bail: true,
			errorMessage: "participantIdList must be a hexadecimal string",
		},
	},
	displayPicture: {
		in: ["body"],
		optional: true,
		trim: true,
		notEmpty: { bail: true, errorMessage: "'caption' cannot be empty" },
		isString: { bail: true, errorMessage: "'caption' must be a string" },
	},
	// "content-type": {
	// 	in: ["headers"],
	// 	equals: {
	// 		options: "application/x-www-form-urlencoded",
	// 		errorMessage: "Inappropriate 'content-type' header value",
	// 	},
	// 	errorMessage: "'content-type' header is required",
	// },
	// authorization: {
	// 	in: ["headers"],
	// 	trim: true,
	// 	notEmpty: {
	// 		options: { ignore_whitespace: true },
	// 		bail: true,
	// 		errorMessage: "'authorization' header cannot be empty",
	// 	},
	// 	custom: { options: () => {} },
	// 	errorMessage: "'authorization' header is required",
	// },
};

export const createGroupChatValidFields: ValidSchemaFields = {
	body: ["name", "participantIdList", "displayPicture"],
};

export const groupChatDisplayPictureUploadPresignSchema: Schema = {
	mediaType: {
		in: ["body"],
		trim: true,
		notEmpty: {
			options: { ignore_whitespace: true },
			bail: true,
			errorMessage: "'mediaType' cannot be empty",
		},
		isString: { bail: true, errorMessage: "'mediaType' must be a string" },
		isIn: {
			options: [["image"]],
			errorMessage: "'mediaType' must be 'image'",
		},
		errorMessage: "'mediaType' is required",
	},
	fileName: {
		in: ["body"],
		trim: true,
		notEmpty: {
			options: { ignore_whitespace: true },
			bail: true,
			errorMessage: "fileName cannot be empty",
		},
		isString: { bail: true, errorMessage: "'filename' must be a string" },
		errorMessage: "fileName is required",
	},
};

export const groupChatDisplayPictureUploadValidFields: ValidSchemaFields = {
	body: ["mediaType", "fileName"],
};
