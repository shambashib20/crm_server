import { CreateAutomationController, FetchAutomationController } from "../controllers/automation.controller";
import express from "express";
import AuthMiddleware from "../middlewares/authentication.middleware";

const automationRouter = express.Router();

automationRouter.post("/create", AuthMiddleware, CreateAutomationController);

automationRouter.get("/fetch", AuthMiddleware, FetchAutomationController);

export default automationRouter;
