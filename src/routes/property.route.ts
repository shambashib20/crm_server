import { FetchPropertyLogs } from "../controllers/property.controller";

import express from "express";
import AuthMiddleware from "../middlewares/authentication.middleware";
import PermissionMiddleware from "../middlewares/permission.middleware";

const propertyRouter = express.Router();

propertyRouter.get(
  "/fetch/:id",
  AuthMiddleware,
  PermissionMiddleware("manage_leads"),
  FetchPropertyLogs
);

export default propertyRouter;
