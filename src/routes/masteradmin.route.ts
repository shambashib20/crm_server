import {
  BanOrUnbanVendorsController,
  CreateFeatureController,
  CreatePackageManually,
  FeaturesFetchController,
  GetCustomersInAllProperties,
  GetUsersWithRolesInAllPropertiesController,
  ServerStatsController,
  UpdateFeatureController,
  UpdatePackageManuallyController,
} from "../controllers/masteradmin.controller";

import express from "express";

import AuthMiddleware from "../middlewares/authentication.middleware";
import PermissionMiddleware from "../middlewares/permission.middleware";

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
);



masteradminRouter.patch(
  "/feature/update",
  AuthMiddleware,
  PermissionMiddleware("manage_user_permissions"),
  UpdateFeatureController
)


masteradminRouter.post(
  "/features/fetch",
  AuthMiddleware,
  FeaturesFetchController
);



masteradminRouter.get(
  "/server/stats",
  AuthMiddleware,
  ServerStatsController
);



masteradminRouter.patch(
  "/vendor/ban-or-unban",
  AuthMiddleware,
  BanOrUnbanVendorsController
);


masteradminRouter.patch(
  "/package/update-manually",
  AuthMiddleware,
  UpdatePackageManuallyController
)
export default masteradminRouter;
