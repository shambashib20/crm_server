import {
  ArchiveSessionLeads,
  CreateLeadController,
  DeleteOrArchiveForLead,
  EditFollowUp,
  ExportLeadsController,
  FetchArchivedPaginatedLeads,
  FetchLeadDetails,
  FetchMissedFollowupsForADay,
  FetchTodaysFollowups,
  GetLeadsByLabelAndChatAgentController,
  GetLeadsBySourceAndChatAgentController,
  GetLeadsByStatusAndChatAgentController,
  GetMissedFollowUpsController,
  ImportLeadsController,
  LeadsPerSource,
  LeadsPerStatus,
  NewFollowUp,
  UpdateAssignmentForLead,
  UpdateLabelForLead,
  UpdateStatusForLead,
  UploadExcelMiddleware,
} from "../controllers/lead.controller";

import express from "express";

import AuthMiddleware from "../middlewares/authentication.middleware";
import PermissionMiddleware from "../middlewares/permission.middleware";

import { BasicAuthMiddleware } from "../middlewares/basic_auth.middleware";

const leadRouter = express.Router();

leadRouter.get(
  "/overdue-followups",
  AuthMiddleware,
  FetchMissedFollowupsForADay
);

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


leadRouter.patch(
  "/update/follow-up",
  AuthMiddleware,
  PermissionMiddleware("manage_leads"),
  EditFollowUp
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

leadRouter.get("/overdue", AuthMiddleware, (req, res) => {
  res.send("ok");
});

leadRouter.post(
  "/import-leads",
  AuthMiddleware,
  UploadExcelMiddleware,
  // PermissionMiddleware("manage_leads"),
  ImportLeadsController
);
leadRouter.get(
  "/export-leads",
  AuthMiddleware,
  PermissionMiddleware("manage_leads"),
  ExportLeadsController
);

leadRouter.post("/create/external", BasicAuthMiddleware, CreateLeadController);

leadRouter.post(
  "/archived-leads",
  AuthMiddleware,
  PermissionMiddleware("manage_leads"),
  FetchArchivedPaginatedLeads
);

leadRouter.get(
  "/todays-followups",
  AuthMiddleware,
  PermissionMiddleware("manage_leads"),
  FetchTodaysFollowups
);

leadRouter.post(
  "/statistics-by-source-agent",
  AuthMiddleware,
  GetLeadsBySourceAndChatAgentController
);



leadRouter.post(
  "/statistics-by-label-agent",
  AuthMiddleware,
  GetLeadsByLabelAndChatAgentController
);


leadRouter.post(
  "/statistics-by-status-agent",
  AuthMiddleware,
  GetLeadsByStatusAndChatAgentController
);
export default leadRouter;
