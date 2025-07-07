import {
  AssignPermissionsToRoleController,
  CreatePermission,
  GetAllPermissions,
} from "../controllers/permission.controller";

import { Router } from "express";
import AuthMiddleware from "../middlewares/authentication.middleware";

import PermissionMiddleware from "../middlewares/permission.middleware";

const permissionRouter = Router();

permissionRouter.get(
  "/organization/:roleKey",
  AuthMiddleware,
  GetAllPermissions
);

permissionRouter.post("/create", AuthMiddleware, CreatePermission);

permissionRouter.post(
  "/assign-permissions",
  AuthMiddleware,
  PermissionMiddleware("manage_permissions"),
  AssignPermissionsToRoleController
);

export default permissionRouter;
