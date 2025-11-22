import { UpdateWapMonkeyApiKeyController } from "../controllers/wapmonkeyusers.controller";

import express from "express";

import AuthMiddleware from "../middlewares/authentication.middleware";

const wapmonkeyRouter = express.Router();

wapmonkeyRouter.post(
  "/enter-api",
  AuthMiddleware,
  UpdateWapMonkeyApiKeyController
);

export default wapmonkeyRouter;
