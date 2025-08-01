import {
  CreateSourceController,
  FetchSourcesController,
  UpdateSourceController,
} from "../controllers/source.controller";

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

sourceRouter.put(
  "/update/:sourceId",
  AuthMiddleware,
  PermissionMiddleware("manage_sources_list"),
  UpdateSourceController
);

export default sourceRouter;
