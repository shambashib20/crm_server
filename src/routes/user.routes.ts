import { GetUserDetails } from "../controllers/user.controller";

import express from "express";
import AuthMiddleware from "../middlewares/authentication.middleware";

const userRouter = express.Router();

userRouter.use("/profile-info", AuthMiddleware, GetUserDetails);


export default userRouter;


