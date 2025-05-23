import { LoginSuperAdminController } from "../controllers/auth.controller";
import express from "express";

const authRouter = express.Router();

authRouter.use("/login", LoginSuperAdminController);

export default authRouter;
