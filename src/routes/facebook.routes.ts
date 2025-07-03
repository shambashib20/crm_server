import express from "express";
import {
  connectFacebookLeads,
  facebookCallback,
  facebookLogin,
  fetchLeads,
  subscribePageLeadWebhook,
} from "../controllers/facebook.controller";
import AuthMiddleware from "../middlewares/authentication.middleware";

const facebookRoutes = express.Router();

facebookRoutes.get("/login", AuthMiddleware, facebookLogin);
facebookRoutes.get("/callback", facebookCallback);
facebookRoutes.post("/subscribe/:pageId", subscribePageLeadWebhook);
facebookRoutes.get("/leads/:formId", fetchLeads);
facebookRoutes.get("/connect", AuthMiddleware, connectFacebookLeads);

export default facebookRoutes;
