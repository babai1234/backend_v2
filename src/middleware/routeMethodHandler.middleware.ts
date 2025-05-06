import { NextFunction, Request, Response } from "express";
import ErrorCodes from "../constants/ErrorCodes";
import { AppError } from "../constants/appError";
import HttpStatusCodes from "../constants/HttpStatusCodes";

const routeMethodHandler = (req: Request, res: Response, next: NextFunction) => {
	// const error = {
	//     code: `${ErrorCodes.INVALID_REQUEST_METHOD}`,
	//     message: "Method Not Allowed",
	//     cause: "Target route doesnot support this method",
	//     timestamp: Date.now(),
	// };
	next(new AppError("METHOD_NOT_ALLOWED", HttpStatusCodes.METHOD_NOT_ALLOWED));
};

export default routeMethodHandler;
