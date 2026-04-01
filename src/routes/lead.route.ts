import {
  ArchiveSessionLeads,
  CreateExternalLeadsController,
  CreateLeadController,
  CreateLeadByUserController,
  CreateLeadViaLabelController,
  DeleteOrArchiveForLead,
  EditFollowUp,
  ExportLeadsController,
  FetchArchivedPaginatedLeads,
  FetchLeadDetails,
  FetchMissedFollowupsForADay,
  FetchTodaysFollowups,
  FetchTodaysFollowupsSuperadmin,
  GetLeadsByLabelAndChatAgentController,
  GetLeadsBySourceAndChatAgentController,
  GetLeadsByStatusAndChatAgentController,
  GetLeadsTrendByTelecallerController,
  GetMissedFollowUpsController,
  GetStatisticsBySourceController,
  GetTelecallerStatisticsController,
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
import { createRateLimiter } from "../middlewares/rate_limiter.middleware";

// 10 requests per minute per API key for external lead creation
const externalLeadRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 10,
  message: "Rate limit exceeded. You can create at most 10 leads per minute per API key.",
});

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

// Authenticated lead creation — Telecallers / Admins creating leads manually
leadRouter.post(
  "/create-by-user",
  AuthMiddleware,
  PermissionMiddleware("manage_leads"),
  CreateLeadByUserController
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
  PermissionMiddleware("assign_leads"),
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

leadRouter.post("/create/external", CreateExternalLeadsController);

// Public endpoint — Basic Auth (API key) + rate limiter + label-based lead creation
leadRouter.post(
  "/create/via-label",
  BasicAuthMiddleware,
  externalLeadRateLimiter,
  CreateLeadViaLabelController
);

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

leadRouter.get(
  "/todays-followups/superadmin",
  AuthMiddleware,
  PermissionMiddleware("manage_leads"),
  FetchTodaysFollowupsSuperadmin
);

leadRouter.get(
  "/statistics-by-source-agent",
  AuthMiddleware,
  GetLeadsBySourceAndChatAgentController
);

leadRouter.get(
  "/statistics-by-label-agent",
  AuthMiddleware,
  GetLeadsByLabelAndChatAgentController
);

leadRouter.get(
  "/statistics-by-status-agent",
  AuthMiddleware,
  GetLeadsByStatusAndChatAgentController
);

leadRouter.post(
  "/statistics-by-telecaller-label-status",
  AuthMiddleware,
  GetLeadsTrendByTelecallerController
);


leadRouter.post(
  "/telecaller-statistics",
  AuthMiddleware,
  GetTelecallerStatisticsController
)



leadRouter.get(
  "/statistics-by-source",
  AuthMiddleware,
  GetStatisticsBySourceController
)
export default leadRouter;
