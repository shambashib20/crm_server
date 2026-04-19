import {
  CreateAutomationController,
  FetchAutomationController,
  UpdateAutomationController,
  DeleteAutomationController,
} from "../controllers/automation.controller";
import express from "express";
import AuthMiddleware from "../middlewares/authentication.middleware";

const automationRouter = express.Router();

automationRouter.post("/create", AuthMiddleware, CreateAutomationController);
automationRouter.get("/fetch", AuthMiddleware, FetchAutomationController);
automationRouter.patch("/update/:id", AuthMiddleware, UpdateAutomationController);
automationRouter.delete("/delete/:id", AuthMiddleware, DeleteAutomationController);

export default automationRouter;
