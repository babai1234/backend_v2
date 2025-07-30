import { Router } from "express";
import audioRouter from "./audio.route";

const utilRouter = Router();

utilRouter.use("/audio", audioRouter);

export default utilRouter;
