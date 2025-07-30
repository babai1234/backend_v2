import { Router } from "express";
import chatRouter from "./chat/chat.route";
import memoryRouter from "./memory/memory.route";
import postRouter from "./post/post.route";
import utilRouter from "./util/util.route";

const indexRouter = Router();

indexRouter.use("/post", postRouter);
indexRouter.use("/chat", chatRouter);
indexRouter.use("/memory", memoryRouter);
indexRouter.use("/util", utilRouter);

export default indexRouter;
