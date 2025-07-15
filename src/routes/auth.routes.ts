import {
  LoginSuperAdminController,
  LoginForAllUsers,
  LogoutForAllUsers,
  ForgotPasswordController,
  ResetPasswordController,
  UpdateNewPassword,
} from "../controllers/auth.controller";
import express from "express";

const authRouter = express.Router();

authRouter.post("/login", LoginSuperAdminController);

authRouter.post("/login/all", LoginForAllUsers);
authRouter.get("/logout", LogoutForAllUsers);
authRouter.post("/forget-password", ForgotPasswordController);
authRouter.post("/reset-password", ResetPasswordController);
authRouter.patch("/update-password", UpdateNewPassword)

export default authRouter;
