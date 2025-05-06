import { Router } from "express";
import photoPostRouter from "./photo.route";
import momentPostRouter from "./moment.route";
import clipPostRouter from "./clip.route";

const postRouter = Router();

postRouter.use("/photo", photoPostRouter);
postRouter.use("/moment", momentPostRouter);
postRouter.use("/clip", clipPostRouter);

export default postRouter;
