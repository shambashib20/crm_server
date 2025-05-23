import { Types } from "mongoose";
import { _getUserdetails } from "../services/user.service";
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

export { GetUserDetails };
