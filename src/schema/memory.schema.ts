import { Schema } from "express-validator";
import { ValidSchemaFields } from "../types/util.type";
import {
	MemoryColor,
	MemoryEnteringAnimation,
	MemoryFontFamily,
	MemoryReactionMode,
	MemoryReplyMode,
	MemoryStyle,
} from "../constants/constant";

export const memoryUploadSchema: Schema = {
	captions: {
		optional: true,
		isArray: {
			bail: true,
			errorMessage: "captions should be an array",
		},
		custom: {
			options: (value) => {
				if (Array.isArray(value) && value.length > 0 && value.length <= 10) {
					return value.every((caption: any) => {
						const requiredFields = [
							"text",
							"color",
							"style",
							"fontFamily",
							"enteringAnimation",
							"position",
							"scale",
							"rotation",
						];
						const missingFields = requiredFields.filter(
							(key) => !(key in caption)
						);
						if (missingFields.length > 0) {
							throw new Error(
								`caption must include ${missingFields.join(", ")}.`
							);
						}
						return true;
					});
				} else {
					if (!Array.isArray(value)) {
						throw new Error("captions must be an array.");
					}
					if (value.length === 0) {
						throw new Error("captions cannot be empty.");
					}
					if (value.length > 10) {
						throw new Error("captions can contain at most 10 items.");
					}
				}
			},
			bail: true,
		},
	},
	"captions.*.text": {
		optional: true,
		isString: {
			bail: true,
			errorMessage: "caption text should be a string",
		},
		trim: true,
		notEmpty: {
			options: { ignore_whitespace: true },
			bail: true,
			errorMessage: "caption text cannot be empty",
		},
		isLength: {
			options: { max: 100, min: 1 },
			bail: true,
			errorMessage:
				"caption text should be atleast 1 and not exceed 100 characters",
		},
		errorMessage: "caption text is required",
	},
	"captions.*.color": {
		optional: true,
		isString: {
			bail: true,
			errorMessage: "caption color should be a string",
		},
		trim: true,
		notEmpty: {
			options: { ignore_whitespace: true },
			bail: true,
			errorMessage: "caption color cannot be empty",
		},
		isIn: {
			options: [Object.values(MemoryColor)], // Modification required
			bail: true,
			errorMessage: "Inappropriate caption color value",
		},
		errorMessage: "caption color is required",
	},
	"captions.*.style": {
		optional: true,
		isString: {
			bail: true,
			errorMessage: "caption style should be a string",
		},
		trim: true,
		notEmpty: {
			options: { ignore_whitespace: true },
			bail: true,
			errorMessage: "caption style cannot be empty",
		},
		isIn: {
			options: [Object.values(MemoryStyle)], // Modification required
			bail: true,
			errorMessage: "Inappropriate caption style value",
		},
		errorMessage: "caption style is required",
	},
	"captions.*.fontFamily": {
		optional: true,
		isString: {
			bail: true,
			errorMessage: "caption fontFamily should be a string",
		},
		notEmpty: {
			options: { ignore_whitespace: true },
			bail: true,
			errorMessage: "caption fontFamily cannot be empty",
		},
		trim: true,
		isIn: {
			options: [Object.values(MemoryFontFamily)], // Changes required
			bail: true,
			errorMessage: "Inappropriate fontFamily value",
		},
		errorMessage: "caption fontFamily is required",
	},
	"captions.*.enteringAnimation": {
		optional: true,
		isString: {
			bail: true,
			errorMessage: "caption enteringAnimation should be a string",
		},
		trim: true,
		notEmpty: {
			options: { ignore_whitespace: true },
			bail: true,
			errorMessage: "caption enteringAnimation cannot be empty",
		},
		isIn: {
			options: [Object.values(MemoryEnteringAnimation)], // Changes required
			bail: true,
			errorMessage: "Inappropriate enteringAnimation value",
		},
		errorMessage: "caption enteringAnimation is required",
	},
	"captions.*.position": {
		optional: true,
		custom: {
			options: (value: any) => {
				if (typeof value !== "object" || Array.isArray(value)) {
					throw new Error("caption position must be an object.");
				}
				const requiredFields = ["x", "y"];
				const missingFields = requiredFields.filter((key) => !(key in value));
				if (missingFields.length > 0) {
					throw new Error(
						`Invalid caption position parameter ${missingFields.join(", ")}.`
					);
				}
				return true;
			},
			bail: true,
		},
		errorMessage: "caption position is required",
	},
	"captions.*.position.x": {
		optional: true,
		isFloat: {
			bail: true,
			errorMessage: "caption position x should be a number",
		},
		errorMessage: "caption position x is required",
	},
	"captions.*.position.y": {
		isFloat: {
			bail: true,
			errorMessage: "caption position y should be a number",
		},
		errorMessage: "caption position y is required",
	},
	"captions.*.scale": {
		isFloat: {
			bail: true,
			errorMessage: "caption scale should be a number",
		},
		errorMessage: "caption scale is required",
	},
	"captions.*.rotation": {
		isFloat: {
			options: { min: 0, max: 360 },
			bail: true,
			errorMessage: "caption rotation should be a number",
		},
		errorMessage: "caption rotation is required",
	},
	taggedLocation: {
		optional: true,
		custom: {
			options: (value: any) => {
				if (typeof value !== "object" || Array.isArray(value)) {
					throw new Error("taggedLocation must be an object.");
				}
				const requiredFields = [
					"locationId",
					"name",
					"style",
					"color",
					"position",
					"scale",
					"rotation",
				];
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
	"taggedLocation.style": {
		optional: true,
		isString: {
			bail: true,
			errorMessage: "location style should be a string",
		},
		trim: true,
		notEmpty: {
			options: { ignore_whitespace: true },
			bail: true,
			errorMessage: "location style cannot be empty",
		},
		isIn: {
			options: [], // Changes required
			bail: true,
			errorMessage: "Inappropriate taggedLocation style value",
		},
		errorMessage: "location style is required",
	},
	"taggedLocation.color": {
		optional: true,
		isString: {
			bail: true,
			errorMessage: "location color should be a string",
		},
		trim: true,
		notEmpty: {
			options: { ignore_whitespace: true },
			bail: true,
			errorMessage: "location color cannot be empty",
		},
		isIn: {
			options: [], // Changes required
			bail: true,
			errorMessage: "Inappropriate taggedLocation color value",
		},
		errorMessage: "location color is required",
	},
	"taggedLocation.position": {
		optional: true,
		custom: {
			options: (value: any) => {
				if (typeof value !== "object" || Array.isArray(value)) {
					throw new Error("taggedLocation position must be an object.");
				}
				const requiredFields = ["x", "y"];
				const missingFields = requiredFields.filter((key) => !(key in value));
				if (missingFields.length > 0) {
					throw new Error(
						`Inavlid taggedLocation parameter ${missingFields.join(", ")}.`
					);
				}
				return true;
			},
			bail: true,
		},
		errorMessage: "position is required",
	},
	"taggedLocation.position.x": {
		optional: true,
		isFloat: {
			bail: true,
			errorMessage: "location position x should be a number",
		},
		errorMessage: "location position x is required",
	},
	"taggedLocation.position.y": {
		optional: true,
		isFloat: {
			bail: true,
			errorMessage: "location position y should be a number",
		},
		errorMessage: "location position y is required",
	},
	"taggedLocation.scale": {
		optional: true,
		isFloat: {
			bail: true,
			errorMessage: "location scale should be a number",
		},
		errorMessage: "location scale is required",
	},
	"taggedLocation.rotation": {
		optional: true,
		isFloat: {
			options: { min: 0, max: 360 },
			bail: true,
			errorMessage: "location rotation should be a number",
		},
		errorMessage: "location rotation is required",
	},
	link: {
		optional: true,
		custom: {
			options: (value: any) => {
				if (typeof value !== "object" || Array.isArray(value)) {
					throw new Error("link must be an object.");
				}
				const requiredFields = [
					"title",
					"href",
					"style",
					"color",
					"position",
					"scale",
					"rotation",
				];
				const missingFields = requiredFields.filter((key) => !(key in value));
				if (missingFields.length > 0) {
					throw new Error(`link must include ${missingFields.join(", ")}.`);
				}
				return true;
			},
			bail: true,
		},
	},
	"link.title": {
		optional: true,
		isString: {
			bail: true,
			errorMessage: "link title should be a string",
		},
		trim: true,
		notEmpty: {
			options: { ignore_whitespace: true },
			bail: true,
			errorMessage: "link title cannot be empty",
		},
		errorMessage: "link title required",
	},
	"link.href": {
		optional: true,
		isURL: {
			bail: true,
			errorMessage: "link href should be a valid URL",
		},
		errorMessage: "link url required",
	},
	"link.style": {
		optional: true,
		isString: {
			bail: true,
			errorMessage: "link style should be a string",
		},
		trim: true,
		notEmpty: {
			options: { ignore_whitespace: true },
			bail: true,
			errorMessage: "link style cannot be empty",
		},
		isIn: {
			options: [], // Changes required
			bail: true,
			errorMessage: "Inappropriate link style value",
		},
		errorMessage: "link style required",
	},
	"link.color": {
		optional: true,
		isString: {
			bail: true,
			errorMessage: "link color should be a string",
		},
		trim: true,
		notEmpty: {
			options: { ignore_whitespace: true },
			bail: true,
			errorMessage: "link color cannot be empty",
		},
		isIn: {
			options: [], // Changes required
			bail: true,
			errorMessage: "Inappropriate link color value",
		},
		errorMessage: "link color required",
	},
	"link.position": {
		optional: true,
		custom: {
			options: (value: any) => {
				if (typeof value !== "object" || Array.isArray(value)) {
					throw new Error("link position must be an object.");
				}
				const requiredFields = ["x", "y"];
				const missingFields = requiredFields.filter((key) => !(key in value));
				if (missingFields.length > 0) {
					throw new Error(
						`Invalid link position parameter ${missingFields.join(", ")}.`
					);
				}
				return true;
			},
			bail: true,
		},
		errorMessage: "link position is required",
	},
	"link.position.x": {
		optional: true,
		isFloat: {
			bail: true,
			errorMessage: "link position x should be a number",
		},
		errorMessage: "link position x required",
	},
	"link.position.y": {
		optional: true,
		isFloat: {
			bail: true,
			errorMessage: "link position y should be a number",
		},
		errorMessage: "link position y required",
	},
	"link.scale": {
		optional: true,
		isFloat: {
			bail: true,
			errorMessage: "link scale should be a number",
		},
		errorMessage: "link scale required",
	},
	"link.rotation": {
		optional: true,
		isFloat: {
			options: { min: 0, max: 360 },
			bail: true,
			errorMessage: "link rotation should be a number",
		},
		errorMessage: "link rotation required",
	},
	associatedAudio: {
		optional: true,
		isString: {
			bail: true,
			errorMessage: "associatedAudio should be a string",
		},
		trim: true,
		notEmpty: {
			options: { ignore_whitespace: true },
			bail: true,
			errorMessage: "associatedAudio id cannot be empty",
		},
		isLength: {
			options: { min: 24, max: 24 },
			bail: true,
			errorMessage: "associatedAudio id must be 24 characters long",
		},
		isHexadecimal: {
			bail: true,
			errorMessage: "associatedAudio id must be a hexadecimal string",
		},
	},
	poll: {
		optional: true,
		custom: {
			options: (value: any) => {
				if (typeof value !== "object" || Array.isArray(value)) {
					throw new Error("poll must be an object.");
				}
				const requiredFields = [
					"color",
					"options",
					"title",
					"position",
					"scale",
					"rotation",
				];
				const missingFields = requiredFields.filter((key) => !(key in value));
				if (missingFields.length > 0) {
					throw new Error(
						`Invalid poll parameter ${missingFields.join(", ")}.`
					);
				}
				return true;
			},
			bail: true,
		},
	},
	"poll.color": {
		optional: true,
		isString: {
			bail: true,
			errorMessage: "poll color should be a string",
		},
		trim: true,
		notEmpty: {
			options: { ignore_whitespace: true },
			bail: true,
			errorMessage: "poll color cannot be empty",
		},
		isIn: {
			options: [], // Changes required
			bail: true,
			errorMessage: "Inappropriate poll color value",
		},
		errorMessage: "poll color required",
	},
	"poll.options": {
		optional: true,
		isArray: {
			bail: true,
			errorMessage: "poll options should be an array",
		},
		custom: {
			options: (value) =>
				Array.isArray(value) && value.length >= 2 && value.length <= 4,
			bail: true,
			errorMessage: "poll options should contain atleast 2 and atmost 4 options",
		},
	},
	"poll.options.*": {
		optional: true,
		isString: {
			bail: true,
			errorMessage: "poll options should be a string",
		},
		trim: true,
		notEmpty: {
			options: { ignore_whitespace: true },
			bail: true,
			errorMessage: "poll options cannot be empty",
		},
		errorMessage: "poll options required",
	},
	"poll.title": {
		optional: true,
		isString: {
			bail: true,
			errorMessage: "poll title should be a string",
		},
		trim: true,
		notEmpty: {
			options: { ignore_whitespace: true },
			bail: true,
			errorMessage: "poll title cannot be empty",
		},
		errorMessage: "poll title required",
	},
	"poll.position": {
		optional: true,
		custom: {
			options: (value: any) => {
				if (typeof value !== "object" || Array.isArray(value)) {
					throw new Error("poll position must be an object.");
				}
				const requiredFields = ["x", "y"];
				const missingFields = requiredFields.filter((key) => !(key in value));
				if (missingFields.length > 0) {
					throw new Error(
						`Invalid poll position parameter ${missingFields.join(", ")}.`
					);
				}
				return true;
			},
			bail: true,
		},
		errorMessage: "poll position is required",
	},
	"poll.position.x": {
		optional: true,
		isFloat: {
			bail: true,
			errorMessage: "poll position x should be a number",
		},
		errorMessage: "poll position x required",
	},
	"poll.position.y": {
		optional: true,
		isFloat: {
			bail: true,
			errorMessage: "poll position y should be a number",
		},
		errorMessage: "poll position y required",
	},
	"poll.scale": {
		optional: true,
		isFloat: {
			bail: true,
			errorMessage: "poll scale should be a number",
		},
		errorMessage: "poll scale required",
	},
	"poll.rotation": {
		optional: true,
		isFloat: {
			options: { min: 0, max: 360 },
			bail: true,
			errorMessage: "poll rotation should be a number",
		},
		errorMessage: "poll rotation required",
	},
	starRating: {
		optional: true,
		custom: {
			options: (value: any) => {
				if (typeof value !== "object" || Array.isArray(value)) {
					throw new Error("starRating must be an object.");
				}
				const requiredFields = [
					"color",
					"title",
					"position",
					"scale",
					"rotation",
				];
				const missingFields = requiredFields.filter((key) => !(key in value));
				if (missingFields.length > 0) {
					throw new Error(
						`Invalid starRating parameter ${missingFields.join(", ")}.`
					);
				}
				return true;
			},
			bail: true,
		},
	},
	"starRating.color": {
		optional: true,
		isString: {
			bail: true,
			errorMessage: "starRating color should be a string",
		},
		trim: true,
		notEmpty: {
			options: { ignore_whitespace: true },
			bail: true,
			errorMessage: "starRating color cannot be empty",
		},
		isIn: {
			options: [], // Changes required
			bail: true,
			errorMessage: "Inappropriate starRating color value",
		},
		errorMessage: "starRating color required",
	},
	"starRating.title": {
		optional: true,
		isString: {
			bail: true,
			errorMessage: "starRating title should be a string",
		},
		trim: true,
		notEmpty: {
			options: { ignore_whitespace: true },
			bail: true,
			errorMessage: "starRating title cannot be empty",
		},
		errorMessage: "starRating title required",
	},
	"starRating.position": {
		optional: true,
		custom: {
			options: (value: any) => {
				if (typeof value !== "object" || Array.isArray(value)) {
					throw new Error("starRating position must be an object.");
				}
				const requiredFields = ["x", "y"];
				const missingFields = requiredFields.filter((key) => !(key in value));
				if (missingFields.length > 0) {
					throw new Error(
						`Invalid starRating position parameter ${missingFields.join(
							", "
						)}.`
					);
				}
				return true;
			},
			bail: true,
		},
		errorMessage: "starRating position is required",
	},
	"starRating.position.x": {
		optional: true,
		isFloat: {
			bail: true,
			errorMessage: "starRating position x should be a number",
		},
		errorMessage: "starRating position x should be a number",
	},
	"starRating.position.y": {
		optional: true,
		isFloat: {
			bail: true,
			errorMessage: "starRating position y should be a number",
		},
		errorMessage: "starRating position y required",
	},
	"starRating.scale": {
		optional: true,
		isFloat: {
			bail: true,
			errorMessage: "starRating scale should be a number",
		},
		errorMessage: "starRating scale required",
	},
	"starRating.rotation": {
		optional: true,
		isFloat: {
			options: { min: 0, max: 360 },
			bail: true,
			errorMessage: "starRating rotation should be a number",
		},
		errorMessage: "starRating rotation required",
	},
	replyMode: {
		isString: {
			bail: true,
			errorMessage: "replyMode should be a string",
		},
		trim: true,
		notEmpty: {
			options: { ignore_whitespace: true },
			bail: true,
			errorMessage: "replyMode cannot be empty",
		},
		isIn: {
			options: [Object.values(MemoryReplyMode)],
			bail: true,
			errorMessage: "Invalid replyMode value",
		},
		errorMessage: "replyMode is required",
	},
	reactionMode: {
		isString: {
			bail: true,
			errorMessage: "reactionMode should be a string",
		},
		trim: true,
		notEmpty: {
			options: { ignore_whitespace: true },
			bail: true,
			errorMessage: "reactionMode cannot be empty",
		},
		isIn: {
			options: [Object.values(MemoryReactionMode)],
			bail: true,
			errorMessage: "Invalid reactionMode value",
		},
		errorMessage: "reactionMode is required",
	},
	usedAfterEffect: {
		optional: true,
		isString: {
			bail: true,
			errorMessage: "usedAfterEffect should be a string",
		},
		trim: true,
		notEmpty: {
			options: { ignore_whitespace: true },
			bail: true,
			errorMessage: "usedAfterEffect cannot be empty",
		},
		isLength: {
			options: { min: 24, max: 24 },
			bail: true,
			errorMessage: "usedAfterEffect id must be 24 characters long",
		},
		isHexadecimal: {
			bail: true,
			errorMessage: "usedAfterEffect id must be a hexadecimal string",
		},
		errorMessage: "usedAfterEffect required",
	},
	isBoomerang: {
		isBoolean: {
			bail: true,
			errorMessage: "isBoomerang should be a boolean",
		},
		errorMessage: "isBoomerang is required",
	},
	media: {
		custom: {
			options: (value: any) => {
				if (typeof value !== "object" || Array.isArray(value)) {
					throw new Error("media must be an object.");
				}
				const requiredFields = [
					"width",
					"height",
					"fileSize",
					"duration",
					"mute",
					"fileName",
					"blurHash",
					"type",
					"thumbnailWidth",
					"thumbnailHeight",
				];
				const missingFields = requiredFields.filter((key) => !(key in value));
				if (missingFields.length > 0) {
					throw new Error(
						`Invalid media parameter ${missingFields.join(", ")}.`
					);
				}
				return true;
			},
			bail: true,
		},
	},
	"media.width": {
		isFloat: {
			bail: true,
			errorMessage: "media width should be a number",
		},
		errorMessage: "media width is required required",
	},
	"media.height": {
		isFloat: {
			bail: true,
			errorMessage: "media height should be a number",
		},
		errorMessage: "media height is required",
	},
	"media.thumbnailWidth": {
		isInt: {
			bail: true,
			errorMessage: "media thumbnailWidth should be a number",
		},
		errorMessage: "media thumbnailWidth is required required",
	},
	"media.thumbnailHeight": {
		isInt: {
			bail: true,
			errorMessage: "media thumbnailHeight should be a number",
		},
		errorMessage: "media thumbnailHeight is required",
	},
	"media.fileSize": {
		isFloat: {
			bail: true,
			errorMessage: "media fileSize should be a number",
		},
		errorMessage: "media fileSize is required",
	},
	"media.duration": {
		optional: { options: { nullable: true } },
		isFloat: {
			bail: true,
			errorMessage: "media duration should be a number",
		},
		errorMessage: "media duration is required",
	},
	"media.mute": {
		optional: { options: { nullable: true } },
		isBoolean: {
			bail: true,
			errorMessage: "media mute should be a boolean",
		},
		errorMessage: "media mute is required",
	},
	"media.fileName": {
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
	"media.blurHash": {
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
	"media.type": {
		custom: {
			options: (value: any) => {
				if (value === "video" || value === "image") {
					return true;
				} else {
					throw new Error("media type must be a 'video' or 'image'.");
				}
			},
			bail: true,
		},
		errorMessage: "media type is required",
	},
};

export const memoryUploadValidFields: ValidSchemaFields = {
	body: [
		"captions",
		"taggedLocation",
		"link",
		"associatedAudio",
		"poll",
		"starRating",
		"replyMode",
		"reactionMode",
		"usedAfterEffect",
		"isBoomerang",
		"media",
	],
};

export const memoryPresignSchema: Schema = {
	mediaType: {
		in: ["body"],
		isString: {
			errorMessage: "mediaType must be a string.",
		},
		isIn: {
			options: [["video", "image"]],
			errorMessage: "mediaType must be either 'video' or 'image'.",
		},
	},
	fileName: {
		in: ["body"],
		isString: {
			errorMessage: "fileName must be a string.",
		},
		trim: true,
		notEmpty: {
			errorMessage: "fileName must not be empty.",
		},
	},
};

export const memoryPresignValidFields: ValidSchemaFields = {
	body: ["mediaType", "fileName"],
};
