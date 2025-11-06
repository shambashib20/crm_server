import { CreateAutomationController } from "../controllers/automation.controller";
import express from "express";
import AuthMiddleware from "../middlewares/authentication.middleware";

const automationRouter = express.Router();

automationRouter.post("/create", AuthMiddleware, CreateAutomationController);

export default automationRouter;
