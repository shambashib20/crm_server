import {
  _forgotPasswordService,
  _LoginForAllUsersService,
  _loginSuperAdmin,
  _resetPasswordService,
  _updatePasswordService,
} from "../services/auth.service";

import SuccessResponse from "../middlewares/success.middleware";

const LoginSuperAdminController = async (req: any, res: any) => {
  const { email, password } = req.body;

  try {
    const result = await _loginSuperAdmin(email, password, res);



    if (!result) {
      return res
        .status(400)
        .json({ message: "Login failed. Invalid credentials." });
    }
    return res
      .status(200)
      .json(new SuccessResponse("User logged in successfully!", 200, result));
  } catch (error: any) {

    console.log("error=>", error);

    return res.status(500).json(new SuccessResponse(error.message, 500));
  }
};

const LoginForAllUsers = async (req: any, res: any) => {
  const { email, password } = req.body;

  try {
    const result = await _LoginForAllUsersService(email, password, res);
    if (!result) {
      return res
        .status(400)
        .json({ message: "Login failed. Invalid credentials." });
    }
    return res
      .status(200)
      .json(new SuccessResponse("User logged in successfully!", 200, result));
  } catch (error: any) {
    return res.status(500).json(new SuccessResponse(error.message, 500));
  }
};

const ForgotPasswordController = async (req: any, res: any) => {
  const { emailOrPhone } = req.body;

  try {
    const message = await _forgotPasswordService(emailOrPhone);
    return res.status(200).json(new SuccessResponse(message, 200));
  } catch (err: any) {
    return res.status(400).json(new SuccessResponse(err.message, 400));
  }
};

const ResetPasswordController = async (req: any, res: any) => {
  const { otp, newPassword } = req.body;

  try {
    const message = await _resetPasswordService(otp, newPassword);
    return res.status(200).json(new SuccessResponse(message, 200));
  } catch (err: any) {
    return res.status(400).json(new SuccessResponse(err.message, 400));
  }
};
const LogoutForAllUsers = async (req: any, res: any) => {
  const accessToken = req.cookies?.access_token;
  const refreshToken = req.cookies?.refresh_token;

  if (!accessToken && !refreshToken) {
    return res
      .status(400)
      .json(new SuccessResponse("User is already logged out", 400));
  }
  res.clearCookie("access_token", {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
  });

  res.clearCookie("refresh_token", {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
  });

  return res
    .status(200)
    .json(new SuccessResponse("Logged out successfully", 200));
};

const UpdateNewPassword = async (req: any, res: any) => {
  const { rayId, newPassword } = req.body;

  try {
    const message = await _updatePasswordService(rayId, newPassword);
    return res
      .status(200)
      .json(new SuccessResponse(message, 200, "New Password added!"));
  } catch (err: any) {
    return res.status(400).json(new SuccessResponse(err.message, 400));
  }
};

export {
  LoginSuperAdminController,
  LoginForAllUsers,
  LogoutForAllUsers,
  ForgotPasswordController,
  ResetPasswordController,
  UpdateNewPassword,
};
