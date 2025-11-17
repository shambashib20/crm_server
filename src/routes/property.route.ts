import {
  CreateApiKeyController,
  CreatePropertyForOnboarding,
  FetchProperties,
  FetchPropertyLogs,
  PropertyDetails,
  TogglePropertyLogReadStatus,
  UpdatePropertyById,
  UploadProfilePhotoforWorkspace,
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

propertyRouter.post(
  "/workspace-details/profile-image",
  AuthMiddleware,
  PermissionMiddleware("update_profile_for_workspace"),
  UploadProfilePhotoforWorkspace
)

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

propertyRouter.post(
  "/generate/api-key",
  AuthMiddleware,
  CreateApiKeyController
);

propertyRouter.post(
  "/all",
  // ,
  // AuthMiddleware,
  // PermissionMiddleware("manage_leads"),
  FetchProperties
);
export default propertyRouter;
