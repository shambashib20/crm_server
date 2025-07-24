import {
  CreateCustomerFromLead,
  GetCustomersInProperty,
} from "../controllers/customer.controller";

import express from "express";

import AuthMiddleware from "../middlewares/authentication.middleware";
import PermissionMiddleware from "../middlewares/permission.middleware";

const customerRouter = express.Router();

customerRouter.post(
  "/create",
  AuthMiddleware,
  PermissionMiddleware("convert_lead_to_customer"),
  CreateCustomerFromLead
);

customerRouter.get("/fetch", AuthMiddleware, GetCustomersInProperty);
export default customerRouter;
