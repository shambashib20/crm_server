import {
  GetTodaysLeadsGrouped,
  HomePageLeads,
} from "../controllers/lead.controller";
import express from "express";

import AuthMiddleware from "../middlewares/authentication.middleware";
import PermissionMiddleware from "../middlewares/permission.middleware";

const homeRouter = express.Router();

homeRouter.post(
  "/all/leads",
  AuthMiddleware,
  PermissionMiddleware("manage_leads"),
  HomePageLeads
);

homeRouter.get(
  "/leads/today",
  AuthMiddleware,
  PermissionMiddleware("manage_leads"),
  GetTodaysLeadsGrouped
);

export default homeRouter;
