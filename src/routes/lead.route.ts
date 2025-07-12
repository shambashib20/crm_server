import {
  CreateLeadController,
  FetchLeadDetails,
  GetMissedFollowUpsController,
  NewFollowUp,
  UpdateAssignmentForLead,
  UpdateLabelForLead,
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

leadRouter.get(
  "/missed-follow-ups",
  AuthMiddleware,
  PermissionMiddleware("manage_leads"),
  GetMissedFollowUpsController
);

leadRouter.patch(
  "/update",
  AuthMiddleware,
  PermissionMiddleware("manage_leads"),
  UpdateLabelForLead
);

leadRouter.patch(
  "/update-chat-agent",
  AuthMiddleware,
  PermissionMiddleware("manage_leads"),
  UpdateAssignmentForLead
);

export default leadRouter;
