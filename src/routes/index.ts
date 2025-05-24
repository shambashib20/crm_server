import express, { Router } from "express";

const mainRouter: Router = express.Router();

import authRouter from "./auth.routes";
import userRouter from "./user.routes";
import statusRouter from "./stats.routes";
import labelRouter from "./label.routes";

mainRouter.use("/auth", authRouter);

mainRouter.use("/user", userRouter);
mainRouter.use("/status", statusRouter);
mainRouter.use("/label", labelRouter);

export default mainRouter;
