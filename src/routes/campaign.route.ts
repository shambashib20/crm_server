import {
  CreateCampaignTemplateController,
  EditCampaignTemplateController,
  FetchCampaignTemplatesController,
  FetchCampaignTemplatesInMasterPanelController,
  FetchWhatsAppTemplateByIdController,
  EditWhatsAppTemplateController,
  FetchCampaignTemplateByIdController,
  EditCampaignTemplateByIdController,
  DeleteCampaignTemplateController,
} from "../controllers/campaign.controller";

import express from "express";
import AuthMiddleware from "../middlewares/authentication.middleware";
import { upload } from "../middlewares/multer.middleware";

const campaignRouter = express.Router();

campaignRouter.post(
  "/create",
  AuthMiddleware,
  upload.array("attachments", 5),
  CreateCampaignTemplateController
);

campaignRouter.get("/fetch", AuthMiddleware, FetchCampaignTemplatesController);
campaignRouter.put(
  "/edit/:id",
  AuthMiddleware,
  upload.array("attachments", 5),
  EditCampaignTemplateController
);



campaignRouter.get(
  "/master-panel/fetch",
  AuthMiddleware,
  FetchCampaignTemplatesInMasterPanelController
);

campaignRouter.get(
  "/whatsapp/:id",
  AuthMiddleware,
  FetchWhatsAppTemplateByIdController
);

campaignRouter.put(
  "/whatsapp/edit/:id",
  AuthMiddleware,
  upload.array("attachments", 5),
  EditWhatsAppTemplateController
);

campaignRouter.get("/template/:id", AuthMiddleware, FetchCampaignTemplateByIdController);
campaignRouter.patch(
  "/template/:id",
  AuthMiddleware,
  upload.array("attachments", 5),
  EditCampaignTemplateByIdController
);
campaignRouter.delete("/template/:id", AuthMiddleware, DeleteCampaignTemplateController);

export default campaignRouter;
