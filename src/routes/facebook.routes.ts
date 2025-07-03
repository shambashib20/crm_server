import express from "express";
import {
  connectFacebookLeads,
  facebookCallback,
  facebookLogin,
  fetchLeads,
  importFormLeadsManually,
  subscribePageLeadWebhook,
} from "../controllers/facebook.controller";
import AuthMiddleware from "../middlewares/authentication.middleware";
import PermissionMiddleware from "../middlewares/permission.middleware";

const facebookRoutes = express.Router();

facebookRoutes.get("/login", AuthMiddleware, facebookLogin);
facebookRoutes.get("/callback", facebookCallback);
facebookRoutes.post("/subscribe/:pageId", subscribePageLeadWebhook);
// facebookRoutes.get("/leads/:formId", fetchLeads);
facebookRoutes.get("/connect", AuthMiddleware, connectFacebookLeads);

facebookRoutes.post(
  "/leads",
  AuthMiddleware,
  PermissionMiddleware("manage_leads"),
  importFormLeadsManually
);

export default facebookRoutes;
