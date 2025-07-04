import { GetAllPermissions } from "../controllers/permission.controller";

import { Router } from "express";
import AuthMiddleware from "../middlewares/authentication.middleware";

const permissionRouter = Router();

permissionRouter.get(
  "/organization/:roleKey",
  AuthMiddleware,
  GetAllPermissions
);

export default permissionRouter;
