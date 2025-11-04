import {
  CreateCampaignTemplateController,
  EditCampaignTemplateController,
  FetchCampaignTemplatesController,
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
export default campaignRouter;
