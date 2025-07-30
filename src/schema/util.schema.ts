import { Schema } from "express-validator";
import { ValidSchemaFields } from "../types/util.type";

export const paginatedSearchQuerySchema: Schema = {
	keyword: {
		in: ["query"],
		isString: {
			errorMessage: "Keyword must be a string",
		},
		trim: true,
		notEmpty: {
			options: {
				ignore_whitespace: true,
			},
			bail: true,
			errorMessage: "Keyword cannot be empty",
		},
		isLength: {
			options: {
				min: 1,
				max: 20,
			},
			bail: true,
			errorMessage: "Keyword must be between 1 and 100 characters",
		},
		errorMessage: "Keyword is required",
	},
	page: {
		in: ["query"],
		isInt: {
			options: { min: 1 },
			bail: true,
			errorMessage: "Page must be a positive integer",
		},
		errorMessage: "Page is required",
	},
	limit: {
		in: ["query"],
		isInt: {
			options: { min: 1, max: 100 },
			bail: true,
			errorMessage: "Limit must be between 1 and 100",
		},
		errorMessage: "Limit is required",
	},
};

export const paginatedSearchQueryValidFields: ValidSchemaFields = {
	query: ["keyword", "page", "limit"],
};
