import express from "express";
import {
  connectFacebookLeads,
  facebookCallback,
  facebookLogin,
  fetchLeads,
  subscribePageLeadWebhook,
} from "../controllers/facebook.controller";

const facebookRoutes = express.Router();

facebookRoutes.get("/login", facebookLogin);
facebookRoutes.get("/callback", facebookCallback);
facebookRoutes.post("/subscribe/:pageId", subscribePageLeadWebhook);
facebookRoutes.get("/leads/:formId", fetchLeads);
facebookRoutes.get("/connect", connectFacebookLeads);

export default facebookRoutes;
