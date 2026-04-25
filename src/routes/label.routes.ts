import {
  CreateLabel,
  DeleteLabelController,
  FetchLabels,
  FetchPaginatedLabelsController,
  UpdateLabelController,
} from "../controllers/label.controller";

import express from "express";
import AuthMiddleware from "../middlewares/authentication.middleware";
import PermissionMiddleware from "../middlewares/permission.middleware";
import PricingMiddleware from "../middlewares/pricing.middleware";

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
  // PricingMiddleware("Labels Limit"),
  CreateLabel
);

labelRouter.get(
  "/fetch-paginated/all",
  AuthMiddleware,
  PermissionMiddleware("manage_leads"),
  FetchPaginatedLabelsController
);

labelRouter.put(
  "/update/:labelId",
  AuthMiddleware,
  PermissionMiddleware("manage_leads"),
  UpdateLabelController
);

labelRouter.delete(
  "/delete/:labelId",
  AuthMiddleware,
  PermissionMiddleware("manage_leads"),
  DeleteLabelController
);

export default labelRouter;
