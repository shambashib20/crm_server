import { Types } from "mongoose";
import {
  _allChatAgents,
  _createUserForOrganization,
  _getUserdetails,
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
  const { roleName, name, email, phone_number, property_id } = req.body;
  const superAdminId = req.user?._id;

  try {
    if (!roleName || !name || !email || !phone_number || !property_id) {
      return res
        .status(400)
        .json(new SuccessResponse("Missing required fields", 400));
    }

    const user = await _createUserForOrganization(
      roleName.trim(),
      name.trim(),
      email.trim(),
      phone_number.trim(),
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
          "Chat agents fetched in this organization",
          200,
          result
        )
      );
  } catch (error: any) {
    return res.status(500).json(new SuccessResponse(error.message, 500));
  }
};

export { GetUserDetails, CreateUserController, FetchChatAgents };
