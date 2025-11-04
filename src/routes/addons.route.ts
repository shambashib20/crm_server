import {
  CreateAddOnController,
  EditAddOnController,
  FetchAddOnsController,
} from "../controllers/addoncontroller";

import express from "express";
import AuthMiddleware from "../middlewares/authentication.middleware";


const addonsRouter = express.Router();

addonsRouter.post("/create", AuthMiddleware, CreateAddOnController);
addonsRouter.get("/fetch", AuthMiddleware, FetchAddOnsController);
addonsRouter.patch("/edit", AuthMiddleware, EditAddOnController);

export default addonsRouter;
