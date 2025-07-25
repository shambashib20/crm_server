import {
  ArchiveSessionLeads,
  CreateLeadController,
  DeleteOrArchiveForLead,
  FetchLeadDetails,
  GetMissedFollowUpsController,
  LeadsPerSource,
  LeadsPerStatus,
  NewFollowUp,
  UpdateAssignmentForLead,
  UpdateLabelForLead,
  UpdateStatusForLead,
} from "../controllers/lead.controller";

import express from "express";

import AuthMiddleware from "../middlewares/authentication.middleware";
import PermissionMiddleware from "../middlewares/permission.middleware";
import Lead from "../models/lead.model";

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
  "/update-status",
  AuthMiddleware,
  PermissionMiddleware("manage_leads"),
  UpdateStatusForLead
);

leadRouter.patch(
  "/update-chat-agent",
  AuthMiddleware,
  PermissionMiddleware("manage_leads"),
  UpdateAssignmentForLead
);

leadRouter.patch(
  "/delete-lead",
  AuthMiddleware,
  PermissionMiddleware("manage_leads"),
  DeleteOrArchiveForLead
);

leadRouter.get(
  "/leads-per-status",
  AuthMiddleware,
  PermissionMiddleware("manage_leads"),
  LeadsPerStatus
);

leadRouter.get(
  "/leads-per-source",
  AuthMiddleware,
  PermissionMiddleware("manage_leads"),
  LeadsPerSource
);

leadRouter.get(
  "/archive-leads",
  AuthMiddleware,
  PermissionMiddleware("manage_leads"),
  ArchiveSessionLeads
);

export default leadRouter;
