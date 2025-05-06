import { Router } from "express";
import oneToOneChatRouter from "./oneToOneChat.route";
import groupChatRouter from "./groupChat.route";

const messageRouter = Router();

messageRouter.use("/oneToOneChat", oneToOneChatRouter);
messageRouter.use("/groupChat", groupChatRouter);

export default messageRouter;
