import { ClientSession } from "mongodb";
import { LocationData } from "../types/util.type";
import { locationCollection } from "./index.model";
import { AppError } from "../constants/appError";
import HttpStatusCodes from "../constants/HttpStatusCodes";

export async function getTaggedLocationInfoByOsmId(osmId: string): Promise<LocationData> {
	return {} as LocationData;
}

/**
 * Increments the post usage count (`meta.noOfPostUse`) for a location identified by its OSM ID.
 *
 * This function first verifies that the specified location exists in the database using its OSM ID.
 * If the location is found, it updates the document by incrementing the `meta.noOfPostUse` field,
 * which tracks how often the location is tagged in posts. The update is executed within the provided MongoDB session.
 *
 * @param {string} osmId - The OpenStreetMap ID of the location to update.
 * @param {ClientSession} session - The MongoDB session used to ensure the operation is part of a transaction.
 * @returns {Promise<void>} - Resolves once the update operation completes.
 * @throws {AppError} If the location does not exist in the database.
 * @throws {any} Re-throws any unexpected errors during the update process.
 */
export async function updateLocationPostUse(
	osmId: string,
	session: ClientSession
): Promise<void> {
	try {
		// Fetch location document using the provided OSM ID
		const locationInfo = await getTaggedLocationInfoByOsmId(osmId);

		// If the location does not exist, throw an application-level error
		if (!locationInfo) {
			throw new AppError("Failed to upload", HttpStatusCodes.NOT_FOUND);
		}

		// Update the location document to increment the number of post usages
		await locationCollection.updateOne(
			{ osmId: osmId }, // Filter by OSM ID
			{ $inc: { "meta.noOfPostUse": 1 } }, // Increment the 'noOfPostUse' field
			{ session } // Use the provided session for transactional consistency
		);
	} catch (error) {
		// Re-throw the error to be handled by the calling function
		throw error;
	}
}

/**
 * Increments the memory usage count (`meta.noOfMemoryUse`) for a specific location identified by its OSM ID.
 *
 * This function first checks if a location with the given OSM ID exists in the database.
 * If it does not exist, it throws an application-level error.
 * If it exists, it increments the `meta.noOfMemoryUse` field, indicating that this location
 * has been tagged in a memory. The update is executed as part of a transaction using the provided session.
 *
 * @param {string} osmId - The OpenStreetMap ID of the location to update.
 * @param {ClientSession} session - The MongoDB session used to run the update within a transaction.
 * @returns {Promise<void>} - Resolves when the update is complete.
 * @throws {AppError} If the location is not found in the database.
 * @throws Will also re-throw any other unexpected database or runtime errors.
 */
export async function updateLocationMemoryUse(osmId: string, session: ClientSession) {
	try {
		// Attempt to fetch location information based on OSM ID
		const locationInfo = await getTaggedLocationInfoByOsmId(osmId);

		// If no matching location is found, throw an error
		if (!locationInfo) {
			throw new AppError("Failed to upload", HttpStatusCodes.NOT_FOUND);
		}

		// Increment the memory usage counter in the location's metadata
		await locationCollection.updateOne(
			{ osmId: osmId }, // Filter by OSM ID
			{ $inc: { "meta.noOfMemoryUse": 1 } }, // Atomically increment memory use count
			{ session } // Ensure the operation participates in the given transaction
		);
	} catch (error) {
		// Re-throw any caught errors to be handled upstream
		throw error;
	}
}
