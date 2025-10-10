import express, { Router } from "express";

const mainRouter: Router = express.Router();

import authRouter from "./auth.routes";
import userRouter from "./user.routes";
import statusRouter from "./stats.routes";
import labelRouter from "./label.routes";
import leadRouter from "./lead.route";
import homeRouter from "./home.route";
import sourceRouter from "./source.routes";
import propertyRouter from "./property.route";
import permissionRouter from "./permission.route";
import fileRouter from "./file.route";
import customerRouter from "./customer.route";
import packageRouter from "./package.route";

mainRouter.use("/auth", authRouter);

mainRouter.use("/user", userRouter);
mainRouter.use("/status", statusRouter);
mainRouter.use("/label", labelRouter);
mainRouter.use("/lead", leadRouter);
mainRouter.use("/home-page", homeRouter);
mainRouter.use("/source", sourceRouter);
mainRouter.use("/property", propertyRouter);
mainRouter.use("/permission", permissionRouter);
mainRouter.use("/file", fileRouter);
mainRouter.use("/customer", customerRouter);
mainRouter.use("/package", packageRouter);

export default mainRouter;
