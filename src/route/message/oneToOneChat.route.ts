import { Router } from "express";
import {
	oneToOneChatAccountAttachmentUploadHandler,
	oneToOneChatAudioAttachmentUploadHandler,
	oneToOneChatClipPostAttachmentUploadHandler,
	oneToOneChatFileAttachmentUploadHandler,
	oneToOneChatFileAttachmentUploadPresignHandler,
	oneToOneChatHighlightAttachmentUploadHandler,
	oneToOneChatMemoryAttachmentUploadHandler,
	oneToOneChatMomentPostAttachmentUploadHandler,
	oneToOneChatPhotoPostAttachmentUploadHandler,
	oneToOneChatTextMessageUploadHandler,
} from "../../controller/chat/oneToOneChat.controller";
import routeMethodHandler from "../../middleware/routeMethodHandler.middleware";
import { checkNoExtraFieldsMiddleware } from "../../middleware/requestValidator.middleware";
import {
	accountAttachmentOneToOneChatSchema,
	accountAttachmentOneToOneChatValidFields,
	audioAttachmentOneToOneChatSchema,
	audioAttachmentOneToOneChatValidFields,
	highlightAttachmentOneToOneChatSchema,
	highlightAttachmentOneToOneChatValidFields,
	memoryAttachmentOneToOneChatSchema,
	memoryAttachmentOneToOneChatValidFields,
	oneToOneChatFileAttachmentSchema,
	oneToOneChatFileAttachmentUploadPresignSchema,
	oneToOneChatFileAttachmentUploadPresignValidFields,
	oneToOneChatFileAttachmentValidFields,
	oneToOneChatTextSchema,
	oneToOneChatTextValidFields,
	postAttachmentOneToOneChatSchema,
	postAttachmentOneToOneChatValidFields,
} from "../../schema/message.schema";
import { checkSchema } from "express-validator";
import { getClientAccountInfo } from "../../middleware/auth.middleware";

const oneToOneChatRouter = Router();

oneToOneChatRouter
	.route("/text")
	.post(
		checkSchema(oneToOneChatTextSchema),
		checkNoExtraFieldsMiddleware(oneToOneChatTextValidFields),
		getClientAccountInfo,
		oneToOneChatTextMessageUploadHandler
	)
	.all(routeMethodHandler);

oneToOneChatRouter
	.route("/fileAttachment")
	.post(
		checkNoExtraFieldsMiddleware(oneToOneChatFileAttachmentValidFields),
		checkSchema(oneToOneChatFileAttachmentSchema),
		getClientAccountInfo,
		oneToOneChatFileAttachmentUploadHandler
	)
	.all(routeMethodHandler);

oneToOneChatRouter
	.route("/fileAttachment/presign")
	.post(
		checkNoExtraFieldsMiddleware(oneToOneChatFileAttachmentUploadPresignValidFields),
		checkSchema(oneToOneChatFileAttachmentUploadPresignSchema),
		getClientAccountInfo,
		oneToOneChatFileAttachmentUploadPresignHandler
	)
	.all(routeMethodHandler);

oneToOneChatRouter
	.route("/photoPostAttachment")
	.post(
		checkNoExtraFieldsMiddleware(postAttachmentOneToOneChatValidFields),
		checkSchema(postAttachmentOneToOneChatSchema),
		getClientAccountInfo,
		oneToOneChatPhotoPostAttachmentUploadHandler
	)
	.all(routeMethodHandler);

oneToOneChatRouter
	.route("/clipPostAttachment")
	.post(
		checkNoExtraFieldsMiddleware(postAttachmentOneToOneChatValidFields),
		checkSchema(postAttachmentOneToOneChatSchema),
		getClientAccountInfo,
		oneToOneChatClipPostAttachmentUploadHandler
	)
	.all(routeMethodHandler);

oneToOneChatRouter
	.route("/momentPostAttachment")
	.post(
		checkNoExtraFieldsMiddleware(postAttachmentOneToOneChatValidFields),
		checkSchema(postAttachmentOneToOneChatSchema),
		getClientAccountInfo,
		oneToOneChatMomentPostAttachmentUploadHandler
	)
	.all(routeMethodHandler);

oneToOneChatRouter
	.route("/accountAttachment")
	.post(
		checkNoExtraFieldsMiddleware(accountAttachmentOneToOneChatValidFields),
		checkSchema(accountAttachmentOneToOneChatSchema),
		getClientAccountInfo,
		oneToOneChatAccountAttachmentUploadHandler
	)
	.all(routeMethodHandler);

oneToOneChatRouter
	.route("/audioAttachment")
	.post(
		checkNoExtraFieldsMiddleware(audioAttachmentOneToOneChatValidFields),
		checkSchema(audioAttachmentOneToOneChatSchema),
		getClientAccountInfo,
		oneToOneChatAudioAttachmentUploadHandler
	)
	.all(routeMethodHandler);

oneToOneChatRouter
	.route("/memoryAttachment")
	.post(
		checkNoExtraFieldsMiddleware(memoryAttachmentOneToOneChatValidFields),
		checkSchema(memoryAttachmentOneToOneChatSchema),
		getClientAccountInfo,
		oneToOneChatMemoryAttachmentUploadHandler
	)
	.all(routeMethodHandler);

oneToOneChatRouter
	.route("/highlightAttachment")
	.post(
		checkNoExtraFieldsMiddleware(highlightAttachmentOneToOneChatValidFields),
		checkSchema(highlightAttachmentOneToOneChatSchema),
		getClientAccountInfo,
		oneToOneChatHighlightAttachmentUploadHandler
	)
	.all(routeMethodHandler);

export default oneToOneChatRouter;
