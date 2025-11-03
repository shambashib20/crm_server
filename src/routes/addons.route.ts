import { CreateAddOnController, FetchAddOnsController } from "../controllers/addoncontroller";

import express from "express";
import AuthMiddleware from "../middlewares/authentication.middleware";
import { add } from "date-fns";

const addonsRouter = express.Router();

addonsRouter.post("/create", AuthMiddleware, CreateAddOnController);
addonsRouter.get("/fetch", AuthMiddleware, FetchAddOnsController);

export default addonsRouter;
