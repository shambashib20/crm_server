import express from "express";
import {
  connectFacebookLeads,
  facebookCallback,
  facebookLogin,
  fetchLeads,
  importFormLeadsManually,
  subscribePageLeadWebhook,
  verifyFacebookWebhook,
  handleFacebookLeadEvent,
} from "../controllers/facebook.controller";
import AuthMiddleware from "../middlewares/authentication.middleware";
import PermissionMiddleware from "../middlewares/permission.middleware";

const facebookRoutes = express.Router();

// Facebook Leadgen Webhook — no auth, raw body required (bypass in app.ts)
facebookRoutes.get("/webhook", verifyFacebookWebhook);
facebookRoutes.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  handleFacebookLeadEvent
);

facebookRoutes.get("/login", AuthMiddleware, facebookLogin);
facebookRoutes.get("/callback", facebookCallback);
facebookRoutes.post("/subscribe/:pageId", subscribePageLeadWebhook);
facebookRoutes.get("/connect", AuthMiddleware, connectFacebookLeads);

facebookRoutes.post(
  "/leads",
  AuthMiddleware,
  PermissionMiddleware("manage_leads"),
  importFormLeadsManually
);

export default facebookRoutes;
