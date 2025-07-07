import SuccessResponse from "../middlewares/success.middleware";
import {
  _assignPermissionsToRole,
  _createPermission,
  _getAllPermissionsByRole,
} from "../services/permission.service";

const CreatePermission = async (req: any, res: any) => {
  const { name, description } = req.body;

  try {
    if (!name || !description) {
      return res
        .status(400)
        .json(new SuccessResponse("Name and description are required", 400));
    }

    const permission = await _createPermission(name.trim(), description.trim());
    return res
      .status(201)
      .json(
        new SuccessResponse("Permission created successfully", 201, permission)
      );
  } catch (error: any) {
    return res
      .status(500)
      .json(
        new SuccessResponse(
          error.message || "An error occurred while creating permission",
          500,
          null
        )
      );
  }
};

const GetAllPermissions = async (req: any, res: any) => {
  try {
    const roleKey = req.params.roleKey;
    const permissions = await _getAllPermissionsByRole(roleKey);
    return res
      .status(200)
      .json(
        new SuccessResponse(
          "Permissions fetched successfully",
          200,
          permissions
        )
      );
  } catch (error: any) {
    return res
      .status(500)
      .json(
        new SuccessResponse(
          error.message || "An error occurred while fetching permissions",
          500,
          null
        )
      );
  }
};

const AssignPermissionsToRoleController = async (req: any, res: any) => {
  try {
    const { roleKey, permissionKeys } = req.body;

    if (!roleKey || !Array.isArray(permissionKeys)) {
      return res.status(400).json({ message: "Invalid request body." });
    }

    const result = await _assignPermissionsToRole(roleKey, permissionKeys);
    return res
      .status(200)
      .json(
        new SuccessResponse("Permissions assigned successfully", 200, result)
      );
  } catch (error: any) {
    return res
      .status(500)
      .json(
        new SuccessResponse(
          error.message || "An error occurred while fetching permissions",
          500,
          null
        )
      );
  }
};

export {
  GetAllPermissions,
  CreatePermission,
  AssignPermissionsToRoleController,
};
