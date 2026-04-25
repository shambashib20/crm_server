import { Types } from "mongoose";
import {
  _allChatAgents,
  _allPaginatedChatAgents,
  _createUserForOrganization,
  _getUserdetails,
  _uploadProfilePicture,
  _toggleUserActiveStatus,
  _updateEmployeeDetails,
  _updateOwnProfile,
} from "../services/user.service";
import SuccessResponse from "../middlewares/success.middleware";

const GetUserDetails = async (req: any, res: any) => {
  const user = req.user;

  try {
    const result = await _getUserdetails(new Types.ObjectId(user._id));
    return res
      .status(200)
      .json(
        new SuccessResponse("User Details fetched successfully!", 200, result)
      );
  } catch (err: any) {
    return res
      .status(500)
      .json(new SuccessResponse(err.message || "Failed to resend OTP", 500));
  }
};

const CreateUserController = async (req: any, res: any) => {
  const { roleName, name, email, phone_number, password, property_id } =
    req.body;
  const superAdminId = req.user?._id;

  try {
    if (
      !roleName ||
      !name ||
      !email ||
      !phone_number ||
      !password ||
      !property_id
    ) {
      return res
        .status(400)
        .json(new SuccessResponse("Missing required fields", 400));
    }

    const user = await _createUserForOrganization(
      roleName.trim(),
      name.trim(),
      email.trim(),
      phone_number.trim(),
      password,
      new Types.ObjectId(property_id),
      new Types.ObjectId(superAdminId)
    );

    return res.status(201).json(
      new SuccessResponse("User created successfully", 201, {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone_number: user.phone_number,
        role: roleName,
      })
    );
  } catch (err: any) {
    return res
      .status(500)
      .json(new SuccessResponse(err.message || "Failed to create user", 500));
  }
};

const FetchChatAgents = async (req: any, res: any) => {
  const user = req.user;
  try {
    const result = await _allChatAgents(new Types.ObjectId(user.property_id));
    return res
      .status(200)
      .json(
        new SuccessResponse(
          "Telecallers fetched in this organization",
          200,
          result
        )
      );
  } catch (error: any) {
    return res.status(500).json(new SuccessResponse(error.message, 500));
  }
};

const FetchPaginatedChatAgents = async (req: any, res: any) => {
  const user = req.user;
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    // filter_active=true → active only | filter_active=false → inactive only | omit → all
    const filterActive =
      req.query.filter_active === "true"
        ? true
        : req.query.filter_active === "false"
        ? false
        : undefined;

    const result = await _allPaginatedChatAgents(
      new Types.ObjectId(user.property_id),
      page,
      limit,
      filterActive
    );
    return res
      .status(200)
      .json(
        new SuccessResponse(
          "Telecallers fetched in this organization",
          200,
          result
        )
      );
  } catch (error: any) {
    return res.status(500).json(new SuccessResponse(error.message, 500));
  }
};

const UploadProfilePhoto = async (req: any, res: any) => {
  const userId = req.user._id;
  const { fileUrl } = req.body;
  try {
    const result = await _uploadProfilePicture(fileUrl, userId);
    return res
      .status(200)
      .json(
        new SuccessResponse(
          "Profile picture successfully uploaded!",
          200,
          result
        )
      );
  } catch (error: any) {
    return res.status(500).json(new SuccessResponse(error.message, 500));
  }
};

const ToggleUserActiveStatusController = async (req: any, res: any) => {
  try {
    const { userId, is_active, reassign_to } = req.body;
    const requestingUserId = req.user._id;
    const propertyId = req.user.property_id;

    if (!userId || is_active === undefined || is_active === null) {
      return res
        .status(400)
        .json(
          new SuccessResponse("userId and is_active are required.", 400)
        );
    }

    const result = await _toggleUserActiveStatus(
      new Types.ObjectId(userId),
      Boolean(is_active),
      new Types.ObjectId(requestingUserId),
      new Types.ObjectId(propertyId),
      reassign_to ? new Types.ObjectId(reassign_to) : undefined
    );

    return res
      .status(200)
      .json(
        new SuccessResponse(
          `User ${is_active ? "activated" : "deactivated"} successfully.`,
          200,
          result
        )
      );
  } catch (error: any) {
    return res.status(500).json(new SuccessResponse(error.message, 500));
  }
};

const UpdateEmployeeDetailsController = async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { name, email, phone_number } = req.body;
    const requestingUserId = req.user._id;
    const propertyId = req.user.property_id;

    if (!id) {
      return res
        .status(400)
        .json(new SuccessResponse("Employee ID is required.", 400));
    }

    const result = await _updateEmployeeDetails(
      new Types.ObjectId(id),
      new Types.ObjectId(requestingUserId),
      new Types.ObjectId(propertyId),
      { name, email, phone_number }
    );

    return res
      .status(200)
      .json(new SuccessResponse("Employee details updated successfully.", 200, result));
  } catch (error: any) {
    return res.status(500).json(new SuccessResponse(error.message, 500));
  }
};

const UpdateOwnProfileController = async (req: any, res: any) => {
  const userId = new Types.ObjectId(req.user._id);
  const { name, email, phone_number, bio } = req.body;

  try {
    const result = await _updateOwnProfile(userId, { name, email, phone_number, bio });
    return res
      .status(200)
      .json(new SuccessResponse("Profile updated successfully.", 200, result));
  } catch (error: any) {
    const status = error.message.includes("already exists") ? 409 : 400;
    return res.status(status).json(new SuccessResponse(error.message, status));
  }
};

export {
  GetUserDetails,
  CreateUserController,
  FetchChatAgents,
  UploadProfilePhoto,
  FetchPaginatedChatAgents,
  ToggleUserActiveStatusController,
  UpdateEmployeeDetailsController,
  UpdateOwnProfileController,
};
