import {
  CreateLeadController,
  FetchLeadDetails,
  NewFollowUp,
} from "../controllers/lead.controller";

import express from "express";

import AuthMiddleware from "../middlewares/authentication.middleware";
import PermissionMiddleware from "../middlewares/permission.middleware";

const leadRouter = express.Router();

leadRouter.post(
  "/create",
  // AuthMiddleware,
  // PermissionMiddleware("manage_leads"),
  CreateLeadController
);

leadRouter.get(
  "/info",
  AuthMiddleware,
  PermissionMiddleware("view_leads"),
  FetchLeadDetails
);

leadRouter.post(
  "/follow-up",
  AuthMiddleware,
  PermissionMiddleware("manage_leads"),
  NewFollowUp
);

export default leadRouter;
