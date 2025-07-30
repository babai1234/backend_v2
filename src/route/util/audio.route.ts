import { Router } from "express";
import { getClientAccountInfo } from "../../middleware/auth.middleware";
import {
	getNewAudioController,
	getSavedAudioController,
	getTrendingAudioController,
	searchMusicAudioController,
} from "../../controller/util/audio.controller";
import { checkNoExtraFieldsMiddleware } from "../../middleware/requestValidator.middleware";
import {
	paginatedSearchQuerySchema,
	paginatedSearchQueryValidFields,
} from "../../schema/util.schema";
import { checkSchema } from "express-validator";

const audioRouter = Router();

audioRouter.route("/new").get(getClientAccountInfo, getNewAudioController);
audioRouter.route("/trending").get(getClientAccountInfo, getTrendingAudioController);
audioRouter
	.route("/search")
	.get(
		checkNoExtraFieldsMiddleware(paginatedSearchQueryValidFields),
		checkSchema(paginatedSearchQuerySchema),
		getClientAccountInfo,
		searchMusicAudioController
	);
audioRouter.route("/saved").get(getClientAccountInfo, getSavedAudioController);

export default audioRouter;
