import express, { Router } from "express";

const mainRouter: Router = express.Router();

import authRouter from "./auth.routes";
import userRouter from "./user.routes";

mainRouter.use("/auth", authRouter);

mainRouter.use("/user", userRouter);

export default mainRouter;
