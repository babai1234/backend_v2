import { Router } from "express";
import routeMethodHandler from "../../middleware/routeMethodHandler.middleware";
import {
	createGroupChatHandler,
	groupChatAccountAttachmentUploadHandler,
	groupChatAudioAttachmentUploadHandler,
	groupChatClipPostAttachmentUploadHandler,
	groupChatDisplayPictureUploadPresignHandler,
	groupChatFileAttachmentUploadHandler,
	groupChatFileAttachmentUploadPresignHandler,
	groupChatHighlightAttachmentUploadHandler,
	groupChatMemoryAttachmentUploadHandler,
	groupChatMomentPostAttachmentUploadHandler,
	groupChatPhotoPostAttachmentUploadHandler,
	groupChatTextMessageUploadHandler,
} from "../../controller/chat/groupChat.controller";
import { checkNoExtraFieldsMiddleware } from "../../middleware/requestValidator.middleware";
import {
	accountAttachmentGroupChatSchema,
	accountAttachmentGroupChatValidFields,
	audioAttachmentGroupChatSchema,
	audioAttachmentGroupChatValidFields,
	createGroupChatSchema,
	createGroupChatValidFields,
	groupChatDisplayPictureUploadPresignSchema,
	groupChatDisplayPictureUploadValidFields,
	groupChatFileAttachmentSchema,
	groupChatFileAttachmentUploadPresignSchema,
	groupChatFileAttachmentUploadPresignValidFields,
	groupChatFileAttachmentValidFields,
	groupChatTextSchema,
	groupChatTextValidFields,
	highlightAttachmentGroupChatSchema,
	highlightAttachmentGroupChatValidFields,
	memoryAttachmentGroupChatSchema,
	memoryAttachmentGroupChatValidFields,
	postAttachmentGroupChatSchema,
	postAttachmentGroupChatValidFields,
} from "../../schema/message.schema";
import { checkSchema } from "express-validator";
import { getClientAccountInfo } from "../../middleware/auth.middleware";

const groupChatRouter = Router();

groupChatRouter
	.route("/text")
	.post(
		checkNoExtraFieldsMiddleware(groupChatTextValidFields),
		checkSchema(groupChatTextSchema),
		getClientAccountInfo,
		groupChatTextMessageUploadHandler
	)
	.all(routeMethodHandler);

groupChatRouter
	.route("/create")
	.post(
		checkNoExtraFieldsMiddleware(createGroupChatValidFields),
		checkSchema(createGroupChatSchema),
		getClientAccountInfo,
		createGroupChatHandler
	)
	.all(routeMethodHandler);

groupChatRouter
	.route("/create/presign")
	.post(
		checkNoExtraFieldsMiddleware(groupChatDisplayPictureUploadValidFields),
		checkSchema(groupChatDisplayPictureUploadPresignSchema),
		getClientAccountInfo,
		groupChatDisplayPictureUploadPresignHandler
	)
	.all(routeMethodHandler);

groupChatRouter
	.route("/fileAttachment")
	.post(
		checkNoExtraFieldsMiddleware(groupChatFileAttachmentValidFields),
		checkSchema(groupChatFileAttachmentSchema),
		getClientAccountInfo,
		groupChatFileAttachmentUploadHandler
	)
	.all(routeMethodHandler);

groupChatRouter
	.route("/fileAttachment/presign")
	.post(
		checkNoExtraFieldsMiddleware(groupChatFileAttachmentUploadPresignValidFields),
		checkSchema(groupChatFileAttachmentUploadPresignSchema),
		getClientAccountInfo,
		groupChatFileAttachmentUploadPresignHandler
	)
	.all(routeMethodHandler);

groupChatRouter
	.route("/photoPostAttachment")
	.post(
		checkNoExtraFieldsMiddleware(postAttachmentGroupChatValidFields),
		checkSchema(postAttachmentGroupChatSchema),
		getClientAccountInfo,
		groupChatPhotoPostAttachmentUploadHandler
	)
	.all(routeMethodHandler);

groupChatRouter
	.route("/clipPostAttachment")
	.post(
		checkNoExtraFieldsMiddleware(postAttachmentGroupChatValidFields),
		checkSchema(postAttachmentGroupChatSchema),
		getClientAccountInfo,
		groupChatClipPostAttachmentUploadHandler
	)
	.all(routeMethodHandler);

groupChatRouter
	.route("/momentPostAttachment")
	.post(
		checkNoExtraFieldsMiddleware(postAttachmentGroupChatValidFields),
		checkSchema(postAttachmentGroupChatSchema),
		getClientAccountInfo,
		groupChatMomentPostAttachmentUploadHandler
	)
	.all(routeMethodHandler);

groupChatRouter
	.route("/accountAttachment")
	.post(
		checkNoExtraFieldsMiddleware(accountAttachmentGroupChatValidFields),
		checkSchema(accountAttachmentGroupChatSchema),
		getClientAccountInfo,
		groupChatAccountAttachmentUploadHandler
	)
	.all(routeMethodHandler);

groupChatRouter
	.route("/audioAttachment")
	.post(
		checkNoExtraFieldsMiddleware(audioAttachmentGroupChatValidFields),
		checkSchema(audioAttachmentGroupChatSchema),
		getClientAccountInfo,
		groupChatAudioAttachmentUploadHandler
	)
	.all(routeMethodHandler);

groupChatRouter
	.route("/memoryAttachment")
	.post(
		checkNoExtraFieldsMiddleware(memoryAttachmentGroupChatValidFields),
		checkSchema(memoryAttachmentGroupChatSchema),
		getClientAccountInfo,
		groupChatMemoryAttachmentUploadHandler
	)
	.all(routeMethodHandler);

groupChatRouter
	.route("/highlightAttachment")
	.post(
		checkNoExtraFieldsMiddleware(highlightAttachmentGroupChatValidFields),
		checkSchema(highlightAttachmentGroupChatSchema),
		getClientAccountInfo,
		groupChatHighlightAttachmentUploadHandler
	)
	.all(routeMethodHandler);

export default groupChatRouter;
