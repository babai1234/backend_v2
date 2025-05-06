import { NextFunction, Response } from "express";
import { CustomRequest } from "../types/util.type";
import { ObjectId } from "mongodb";
import { accountCollection } from "../models/index.model";

export const getClientAccountInfo = async (
	req: CustomRequest,
	_: Response,
	next: NextFunction
): Promise<void> => {
	try {
		const accountInfo = await accountCollection.findOne({
			_id: new ObjectId("6795f14d04fad95877136430"),
		});
		req.clientAccountInfo = accountInfo ? accountInfo : undefined;
		next();
	} catch (error) {
		next(error);
	}
};
