import { CreateSourceController, FetchSourcesController } from "../controllers/source.controller";

import express from "express";
import AuthMiddleware from "../middlewares/authentication.middleware";
import PermissionMiddleware from "../middlewares/permission.middleware";

const sourceRouter = express.Router();

sourceRouter.post(
  "/create",
  AuthMiddleware,
  PermissionMiddleware("manage_sources_list"),
  CreateSourceController
);

sourceRouter.get(
  "/fetch",
  AuthMiddleware,
  PermissionMiddleware("manage_sources_list"),
  FetchSourcesController
);

export default sourceRouter;
