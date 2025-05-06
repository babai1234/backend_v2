import { Request, Response, NextFunction } from "express";
import { ValidSchemaFields } from "../types/util.type";
import { matchedData, validationResult } from "express-validator";

/**
 * Middleware generator to validate that only specific fields are present in request objects.
 *
 * This higher-order function returns a middleware that checks `req.body`, `req.params`,
 * and `req.query` for any unexpected fields not listed in the specified `validFields` object.
 * If extra fields are found, it responds with a 400 status and an error message listing
 * the unexpected fields for each location.
 *
 * @param {Object} validFields - Object specifying the allowed fields for each request part.
 * @param {string[]} [validFields.body] - Array of allowed field names in `req.body`.
 * @param {string[]} [validFields.params] - Array of allowed field names in `req.params`.
 * @param {string[]} [validFields.query] - Array of allowed field names in `req.query`.
 */
export const checkNoExtraFieldsMiddleware =
	(validFields: ValidSchemaFields) =>
	(req: Request, _: Response, next: NextFunction) => {
		try {
			const findInvalidFields = (
				data: Record<string, any>,
				allowedFields: string[] = []
			) => {
				return Object.keys(data).filter((key) => !allowedFields.includes(key));
			};

			// Collect all invalid fields from each location, using empty objects if undefined
			const invalidFields = {
				body: findInvalidFields(req.body || {}, validFields.body),
				params: findInvalidFields(req.params || {}, validFields.params),
				query: findInvalidFields(req.query || {}, validFields.query),
			};

			// Aggregate all invalid field errors into a single array with context
			const errorMessages = Object.entries(invalidFields)
				.filter(([, fields]) => fields.length > 0)
				.map(([location, fields]) => `${location} fields: ${fields.join(", ")}`);

			// If any invalid fields were found, respond with an error listing them
			if (errorMessages.length > 0) {
				throw new Error(
					`Unexpected fields detected: ${errorMessages.join(" | ")}`
				);
			}

			// If no errors, proceed to the next middleware
			next();
		} catch (error) {
			next(error);
		}
	};

// Function to recursively remove undefined fields
const cleanUndefinedFields = (obj: Record<string, any>): Record<string, any> => {
	return Object.fromEntries(
		Object.entries(obj)
			.filter(([_, value]) => {
				if (value && typeof value === "object" && !Array.isArray(value)) {
					const cleaned = cleanUndefinedFields(value);
					return Object.keys(cleaned).length > 0; // Keep non-empty objects
				}
				return value !== undefined; // Remove undefined fields
			})
			.map(([key, value]) => [
				key,
				value && typeof value === "object" ? cleanUndefinedFields(value) : value,
			])
	);
};

export const validationResultMiddleware = (
	req: Request,
	_: Response,
	next: NextFunction
) => {
	const errors = validationResult(req);

	if (!errors.isEmpty()) {
		// Pass errors to the error-handling middleware
		return next(errors.array());
	}

	// Get validated data from request
	let validatedData = matchedData(req, { onlyValidData: true });

	// Sanitize: Remove fields with undefined values
	validatedData = cleanUndefinedFields(validatedData);

	// Set sanitized object back to request body
	req.body.metadata = validatedData;

	next(); // Move to the next middleware/controller
};
