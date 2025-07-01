import express, { Router } from "express";

const mainRouter: Router = express.Router();

import authRouter from "./auth.routes";
import userRouter from "./user.routes";
import statusRouter from "./stats.routes";
import labelRouter from "./label.routes";
import leadRouter from "./lead.route";
import homeRouter from "./home.route";
import sourceRouter from "./source.routes";

mainRouter.use("/auth", authRouter);

mainRouter.use("/user", userRouter);
mainRouter.use("/status", statusRouter);
mainRouter.use("/label", labelRouter);
mainRouter.use("/lead", leadRouter);
mainRouter.use("/home-page", homeRouter);
mainRouter.use("/source", sourceRouter);

export default mainRouter;
