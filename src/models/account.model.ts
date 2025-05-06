import { ClientSession, ObjectId, WithId } from "mongodb";
import { Account } from "../types/collection/account.type";
import { accountCollection } from "./index.model";
import { AppError } from "../constants/appError";
import HttpStatusCodes from "../constants/HttpStatusCodes";

/**
 * Retrieves an account by its MongoDB ObjectId.
 *
 * @param {string} accountId - The ObjectId of the account to fetch.
 * @returns {Promise<WithId<Account> | null>} A promise that resolves with the account if found, otherwise null.
 * @throws {Error} Throws if the database query fails.
 */
export async function getAccountById(accountId: string): Promise<WithId<Account> | null> {
	try {
		// Find the account document using the provided ID.
		let accountInfo = await accountCollection.findOne({
			_id: new ObjectId(accountId),
			// You can uncomment the below lines if you want to restrict to active accounts only
			// isDeleted: false,
			// isDeActivated: false,
			// suspendedTill: { $exists: false },
		});
		return accountInfo;
	} catch (error) {
		// Propagate any errors encountered during DB operation
		throw error;
	}
}

/**
 * Retrieves an account using the user's unique userId (e.g., username or handle).
 *
 * @param {string} userId - The unique user identifier (username or slug).
 * @returns {Promise<WithId<Account> | null>} A promise that resolves with the account if found, otherwise null.
 * @throws {Error} Throws if the database query fails.
 */
export async function getAccountByUserId(
	userId: string
): Promise<WithId<Account> | null> {
	try {
		// Look up account by its unique userId
		const accountInfo = accountCollection.findOne({ userId: userId });
		return accountInfo;
	} catch (error) {
		throw error;
	}
}

/**
 * Increments the number of shares recorded in the metadata of an account.
 *
 * @param {string} accountId - The ID of the account whose share count should be incremented.
 * @param {ClientSession} session - The MongoDB session used for transactional consistency.
 * @returns {Promise<void>} A promise that resolves when the operation completes.
 * @throws {Error} Throws if the database update fails.
 */
export const updateAccountShares = async (
	accountId: string,
	session: ClientSession
): Promise<void> => {
	try {
		const accountInfo = await getAccountById(accountId);
		if (!accountInfo) {
			throw new AppError("Account not found", HttpStatusCodes.NOT_FOUND);
		}
		// Atomically increment the share count in the account's metadata
		await accountCollection.updateOne(
			{ _id: new ObjectId(accountId) },
			{ $inc: { "meta.noOfShares": 1 } },
			{ session }
		);
	} catch (error) {
		throw error;
	}
};
