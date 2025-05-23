import {
  LoginSuperAdminController,
  LoginForAllUsers,
} from "../controllers/auth.controller";
import express from "express";

const authRouter = express.Router();

authRouter.use("/login", LoginSuperAdminController);

authRouter.use("/login/all", LoginForAllUsers);

export default authRouter;
