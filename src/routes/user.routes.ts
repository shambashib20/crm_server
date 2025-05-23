import {
  CreateUserController,
  GetUserDetails,
} from "../controllers/user.controller";

import express from "express";
import AuthMiddleware from "../middlewares/authentication.middleware";
import PermissionMiddleware from "../middlewares/permission.middleware";

const userRouter = express.Router();

userRouter.use("/profile-info", AuthMiddleware, GetUserDetails);

userRouter.use(
  "/create-user",
  AuthMiddleware,
  PermissionMiddleware("manage_staff"),
  CreateUserController
);

userRouter.use("/all/profile-info", AuthMiddleware, GetUserDetails);

export default userRouter;
