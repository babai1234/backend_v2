import { Router } from "express";
import routeMethodHandler from "../../middleware/routeMethodHandler.middleware";
import { checkNoExtraFieldsMiddleware } from "../../middleware/requestValidator.middleware";
import { checkSchema } from "express-validator";
import {
	clipPostCommentUploadHandler,
	clipPostRetryUploadHandler,
	clipPostUploadHandler,
	clipPostUploadPresignHandler,
} from "../../controller/post/clip.controller";
import {
	clipPostCommentUploadSchema,
	clipPostCommentUploadValidFields,
	clipPostPresignSchema,
	clipPostPresignValidFields,
	clipPostRetryUploadSchema,
	clipPostRetryUploadValidFields,
	clipPostUploadSchema,
	clipPostUploadValidFields,
} from "../../schema/clip.schema";
import { getClientAccountInfo } from "../../middleware/auth.middleware";

const clipPostRouter = Router();

clipPostRouter
	.route("/presign")
	.post(
		checkNoExtraFieldsMiddleware(clipPostPresignValidFields),
		checkSchema(clipPostPresignSchema),
		getClientAccountInfo,
		clipPostUploadPresignHandler
	)
	.all(routeMethodHandler);

clipPostRouter
	.route("/upload")
	.post(
		checkNoExtraFieldsMiddleware(clipPostUploadValidFields),
		checkSchema(clipPostUploadSchema),
		getClientAccountInfo,
		clipPostUploadHandler
	)
	.all(routeMethodHandler);

clipPostRouter
	.route("/comment/upload")
	.post(
		checkNoExtraFieldsMiddleware(clipPostCommentUploadValidFields),
		checkSchema(clipPostCommentUploadSchema),
		getClientAccountInfo,
		clipPostCommentUploadHandler
	)
	.all(routeMethodHandler);

clipPostRouter
	.route("/upload/retry")
	.post(
		checkNoExtraFieldsMiddleware(clipPostRetryUploadValidFields),
		checkSchema(clipPostRetryUploadSchema),
		getClientAccountInfo,
		clipPostRetryUploadHandler
	)
	.all(routeMethodHandler);

export default clipPostRouter;
