import {
  CreateUserController,
  GetUserDetails,
} from "../controllers/user.controller";

import express from "express";
import AuthMiddleware from "../middlewares/authentication.middleware";
import PermissionMiddleware from "../middlewares/permission.middleware";

const userRouter = express.Router();

userRouter.get("/profile-info", AuthMiddleware, GetUserDetails);

userRouter.post(
  "/create-user",
  AuthMiddleware,
  PermissionMiddleware("manage_staff"),
  CreateUserController
);

userRouter.get("/all/profile-info", AuthMiddleware, GetUserDetails);

export default userRouter;
