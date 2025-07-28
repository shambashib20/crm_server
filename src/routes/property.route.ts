import {
  CreatePropertyForOnboarding,
  FetchPropertyLogs,
  PropertyDetails,
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

export default propertyRouter;
