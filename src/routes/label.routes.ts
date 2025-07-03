import { CreateLabel, FetchLabels } from "../controllers/label.controller";

import express from "express";
import AuthMiddleware from "../middlewares/authentication.middleware";
import PermissionMiddleware from "../middlewares/permission.middleware";

const labelRouter = express.Router();

labelRouter.get(
  "/all",
  AuthMiddleware,
  PermissionMiddleware("view_dashboard"),
  FetchLabels
);

labelRouter.post(
  "/create",
  AuthMiddleware,
  PermissionMiddleware("manage_leads"),
  CreateLabel
);

export default labelRouter;
