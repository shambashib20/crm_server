import SuccessResponse from "../middlewares/success.middleware";
import { _getAllPermissionsByRole } from "../services/permission.service";

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

export { GetAllPermissions };
