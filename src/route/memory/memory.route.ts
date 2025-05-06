import { Router } from "express";
import routeMethodHandler from "../../middleware/routeMethodHandler.middleware";
import {
	memoryUploadHandler,
	memoryUploadPresignHandler,
} from "../../controller/memory/memory.controller";
import { checkNoExtraFieldsMiddleware } from "../../middleware/requestValidator.middleware";
import { checkSchema } from "express-validator";
import {
	memoryPresignValidFields,
	memoryPresignSchema,
	memoryUploadSchema,
	memoryUploadValidFields,
} from "../../schema/memory.schema";
import { getClientAccountInfo } from "../../middleware/auth.middleware";

const memoryRouter = Router();

memoryRouter
	.route("/upload")
	.post(
		checkNoExtraFieldsMiddleware(memoryUploadValidFields),
		checkSchema(memoryUploadSchema),
		getClientAccountInfo,
		memoryUploadHandler
	)
	.all(routeMethodHandler);

memoryRouter
	.route("/presign")
	.post(
		checkNoExtraFieldsMiddleware(memoryPresignValidFields),
		checkSchema(memoryPresignSchema),
		getClientAccountInfo,
		memoryUploadPresignHandler
	)
	.all(routeMethodHandler);

export default memoryRouter;
