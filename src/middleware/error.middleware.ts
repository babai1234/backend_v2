import { ErrorRequestHandler, NextFunction, Request, Response } from "express";
import { AppError } from "../constants/appError";
import HttpStatusCodes from "../constants/HttpStatusCodes";

const errorHandler: ErrorRequestHandler = (
	e: Error,
	req: Request,
	res: Response,
	next: NextFunction
) => {
	if (e instanceof AppError) {
		return res.status(e.statusCode).json(e.message);
	} else {
		return res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json(e.message);
	}
};

export default errorHandler;
