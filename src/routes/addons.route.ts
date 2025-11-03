import { CreateAddOnController } from "../controllers/addoncontroller";

import express from "express";

const addonsRouter = express.Router();

addonsRouter.post(
  "/create",

  CreateAddOnController
);

export default addonsRouter;
