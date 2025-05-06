import { NextFunction, Response, Router } from "express";
import {
	photoPostCommentUploadSchema,
	photoPostCommentUploadValidFields,
	photoPostPresignSchema,
	photoPostPresignValidFields,
	photoPostUploadSchema,
	photoPostUploadValidFields,
} from "../../schema/photo.schema";
import { checkSchema } from "express-validator";
import { checkNoExtraFieldsMiddleware } from "../../middleware/requestValidator.middleware";
import {
	photoPostCommentUploadHandler,
	photoPostUploadHandler,
	photoPostUploadPresignHandler,
} from "../../controller/post/photo.controller";
import routeMethodHandler from "../../middleware/routeMethodHandler.middleware";
import { getClientAccountInfo } from "../../middleware/auth.middleware";

const photoPostRouter = Router();

photoPostRouter
	.route("/upload")
	.post(
		checkNoExtraFieldsMiddleware(photoPostUploadValidFields),
		checkSchema(photoPostUploadSchema),
		getClientAccountInfo,
		photoPostUploadHandler
	)
	.all(routeMethodHandler);

photoPostRouter
	.route("/comment/upload")
	.post(
		checkNoExtraFieldsMiddleware(photoPostCommentUploadValidFields),
		checkSchema(photoPostCommentUploadSchema),
		getClientAccountInfo,
		photoPostCommentUploadHandler
	)
	.all(routeMethodHandler);

photoPostRouter
	.route("/presign")
	.post(
		checkNoExtraFieldsMiddleware(photoPostPresignValidFields),
		checkSchema(photoPostPresignSchema),
		getClientAccountInfo,
		photoPostUploadPresignHandler
	)
	.all(routeMethodHandler);

export default photoPostRouter;
