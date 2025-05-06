import { Router } from "express";
import messageRouter from "./message/message.route";
import memoryRouter from "./memory/memory.route";
import postRouter from "./post/post.route";

const indexRouter = Router();

indexRouter.use("/post", postRouter);
indexRouter.use("/message", messageRouter);
indexRouter.use("/memory", memoryRouter);

export default indexRouter;
