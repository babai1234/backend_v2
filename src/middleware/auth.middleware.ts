import { NextFunction, Response, Request } from "express";
import { ObjectId } from "mongodb";
import { accountCollection } from "../models/index.model";
import { CustomRequest } from "../types/util.type";

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
