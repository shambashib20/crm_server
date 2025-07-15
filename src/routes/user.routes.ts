import {
  CreateUserController,
  FetchChatAgents,
  GetUserDetails,
  UploadProfilePhoto,
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

userRouter.get(
  "/chat-agents/all",
  AuthMiddleware,
  PermissionMiddleware("manage_leads"),
  FetchChatAgents
);

userRouter.post(
  "/profile-details/profile-image",
  AuthMiddleware,
  UploadProfilePhoto
)

export default userRouter;
