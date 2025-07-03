import {
  CreateStatusInProperty,
  DeleteStatusInProperty,
  FetchStatuses,
  UpdateStatusInProperty,
} from "../controllers/status.controller";

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

statusRouter.post(
  "/create",
  AuthMiddleware,
  PermissionMiddleware("view_dashboard"),
  CreateStatusInProperty
);

statusRouter.patch(
  "/update",
  AuthMiddleware,
  PermissionMiddleware("view_dashboard"),
  UpdateStatusInProperty
);

statusRouter.delete(
  "/delete/:statusId",
  AuthMiddleware,
  PermissionMiddleware("view_dashboard"),
  DeleteStatusInProperty
);

export default statusRouter;
