import {
  CreatePropertyForOnboarding,
  FetchPropertyLogs,
  PropertyDetails,
  TogglePropertyLogReadStatus,
  UpdatePropertyById,
} from "../controllers/property.controller";

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

propertyRouter.get("/workspace-details", AuthMiddleware, PropertyDetails);

propertyRouter.post("/onboarding", CreatePropertyForOnboarding);

propertyRouter.patch(
  "/update",
  AuthMiddleware,
  PermissionMiddleware("manage_leads"),
  UpdatePropertyById
);

propertyRouter.put(
  "/logs/read",
  AuthMiddleware,
  PermissionMiddleware("manage_leads"),
  TogglePropertyLogReadStatus
);

export default propertyRouter;
