import { FetchStatuses } from "../controllers/status.controller";

import express from "express";

import AuthMiddleware from "../middlewares/authentication.middleware";
import PermissionMiddleware from "../middlewares/permission.middleware";

const statusRouter = express.Router();

statusRouter.get(
  "/all",
  AuthMiddleware,
  PermissionMiddleware("view_dashboard"),
  FetchStatuses
);

export default statusRouter;
