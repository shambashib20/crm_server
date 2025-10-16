import { CreatePaymentProcessForPackage, CreatePurchaseRecord, FetchPricingPlans } from "../controllers/package.controller";
import express from "express";

import AuthMiddleware from "../middlewares/authentication.middleware";
import PermissionMiddleware from "../middlewares/permission.middleware";

const packageRouter = express.Router();

packageRouter.get("/pricing-plans", FetchPricingPlans);

packageRouter.post("/purchase", AuthMiddleware, CreatePurchaseRecord);



packageRouter.post(
  "/create-payment-link",
  AuthMiddleware,
  CreatePaymentProcessForPackage
);

export default packageRouter;
