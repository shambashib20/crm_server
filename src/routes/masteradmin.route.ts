import {
  CreateFeatureController,
  CreatePackageManually,
  GetCustomersInAllProperties,
  GetUsersWithRolesInAllPropertiesController,
  ServerStatsController,
} from "../controllers/masteradmin.controller";

import express from "express";

import AuthMiddleware from "../middlewares/authentication.middleware";

const masteradminRouter = express.Router();

masteradminRouter.get(
  "/customers/fetch",
  AuthMiddleware,
  GetCustomersInAllProperties
);

masteradminRouter.get(
  "/users-with-roles/fetch",
  AuthMiddleware,
  GetUsersWithRolesInAllPropertiesController
);

masteradminRouter.post(
  "/package/create-manually",
  AuthMiddleware,
  CreatePackageManually
);


masteradminRouter.post(
  "/feature/create-manually",
  AuthMiddleware,
  CreateFeatureController
)



masteradminRouter.get(
  "/server/stats",
  AuthMiddleware,
  ServerStatsController
)
export default masteradminRouter;
