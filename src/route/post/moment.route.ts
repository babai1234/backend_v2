import { Router } from "express";
import { checkNoExtraFieldsMiddleware } from "../../middleware/requestValidator.middleware";
import { checkSchema } from "express-validator";
import routeMethodHandler from "../../middleware/routeMethodHandler.middleware";
import {
	momentPostCommentUploadSchema,
	momentPostCommentUploadValidFields,
	momentPostPresignSchema,
	momentPostPresignValidFields,
	momentPostRetryUploadSchema,
	momentPostRetryUploadValidFields,
	momentPostUploadSchema,
	momentPostUploadValidFields,
} from "../../schema/moment.schema";
import {
	momentPostCommentUploadHandler,
	momentPostRetryUploadHandler,
	momentPostUploadHandler,
	momentPostUploadPresignHandler,
} from "../../controller/post/moment.controller";
import { getClientAccountInfo } from "../../middleware/auth.middleware";

const momentPostRouter = Router();

momentPostRouter
	.route("/presign")
	.post(
		checkNoExtraFieldsMiddleware(momentPostPresignValidFields),
		checkSchema(momentPostPresignSchema),
		getClientAccountInfo,
		momentPostUploadPresignHandler
	)
	.all(routeMethodHandler);

momentPostRouter
	.route("/upload")
	.post(
		checkNoExtraFieldsMiddleware(momentPostUploadValidFields),
		checkSchema(momentPostUploadSchema),
		getClientAccountInfo,
		momentPostUploadHandler
	)
	.all(routeMethodHandler);

momentPostRouter
	.route("/comment/upload")
	.post(
		checkNoExtraFieldsMiddleware(momentPostCommentUploadValidFields),
		checkSchema(momentPostCommentUploadSchema),
		getClientAccountInfo,
		momentPostCommentUploadHandler
	)
	.all(routeMethodHandler);

momentPostRouter
	.route("/upload/retry")
	.post(
		checkNoExtraFieldsMiddleware(momentPostRetryUploadValidFields),
		checkSchema(momentPostRetryUploadSchema),
		getClientAccountInfo,
		momentPostRetryUploadHandler
	)
	.all(routeMethodHandler);

export default momentPostRouter;
