import {
  _fetchCustomersInAllProperties,
  _getUsersWithRolesInAllProperties,
} from "../services/master.service";
import SuccessResponse from "../middlewares/success.middleware";

const GetCustomersInAllProperties = async (req: any, res: any) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const result = await _fetchCustomersInAllProperties(page, limit);

    return res
      .status(200)
      .json(new SuccessResponse("Customers fetched successfully", 200, result));
  } catch (error: any) {
    return res
      .status(500)
      .json(
        new SuccessResponse(error.message || "Failed to fetch customers", 500)
      );
  }
};

const GetUsersWithRolesInAllPropertiesController = async (
  req: any,
  res: any
) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const data = await _getUsersWithRolesInAllProperties(page, limit);

    return res
      .status(200)
      .json(
        new SuccessResponse(
          "Users with roles across all properties fetched successfully!",
          200,
          data
        )
      );
  } catch (err: any) {
    return res.status(500).json({
      status: "ERROR",
      message: "Failed to fetch users with roles across all properties.",
      error: err.message || err,
    });
  }
};

export {
  GetCustomersInAllProperties,
  GetUsersWithRolesInAllPropertiesController,
};
