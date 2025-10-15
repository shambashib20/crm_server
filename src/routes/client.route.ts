import { CreateClient, FetchClients } from "../controllers/client.controller";

import express from "express";
const clientRouter = express.Router();

clientRouter.post("/create-client", CreateClient);
clientRouter.post("/all", FetchClients);

export default clientRouter;
