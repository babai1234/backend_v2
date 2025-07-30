import { Router } from "express";
import oneToOneChatRouter from "./oneToOneChat.route";
import groupChatRouter from "./groupChat.route";

const chatRouter = Router();

chatRouter.use("/oneToOneChat", oneToOneChatRouter);
chatRouter.use("/groupChat", groupChatRouter);

export default chatRouter;
