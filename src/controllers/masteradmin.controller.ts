import {
  _fetchCustomersInAllProperties,
  _getUsersWithRolesInAllProperties,
} from "../services/master.service";
import SuccessResponse from "../middlewares/success.middleware";
import User from "../models/user.model";
import { _createPackageManually } from "../services/package.service";
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

const CreatePackageManually = async (req: any, res: any) => {
  try {
    const {
      title,
      description,
      validity,
      validity_in_days,
      price,
      features,
      status,
      createdBy,
      meta,
    } = req.body;

    const userId = req.user._id;

    const defaultMRIdCheck = await User.findOne({
      _id: userId,
      name: "MR Superadmin",
    });

    if (!defaultMRIdCheck) {
      return res.status(400).json({
        success: false,
        message: "Default MR ID is required for payment link generation",
      });
    }
    const defaultMRId = defaultMRIdCheck._id;

    const result = await _createPackageManually(
      {
        title,
        description,
        validity: new Date(validity),
        validity_in_days: parseInt(validity_in_days),
        price: parseFloat(price),
        features: Array.isArray(features) ? features : [],
        status,
        createdBy,
        meta,
      },
      defaultMRId
    );

    res.status(201).json(result);
  } catch (error: any) {
    console.error("Error in createPackage:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to create package",
    });
  }
};
export {
  GetCustomersInAllProperties,
  GetUsersWithRolesInAllPropertiesController,
  CreatePackageManually,
};
