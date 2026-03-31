import {
  _forgotPasswordService,
  _LoginForAllUsersService,
  _loginSuperAdmin,
  _resetPasswordService,
  _updatePasswordService,
  _logoutService,
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
    const status = error.statusCode || 500;
    const message = status < 500 ? error.message : "Something went wrong. Please try again.";
    return res.status(status).json(new SuccessResponse(message, status));
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
    const status = error.statusCode || 500;
    const message = status < 500 ? error.message : "Something went wrong. Please try again.";
    return res.status(status).json(new SuccessResponse(message, status));
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

  // Rotate ray_id so all previously issued tokens for this user are invalidated.
  // This means a stolen cookie becomes useless the moment the real user logs out.
  await _logoutService(accessToken, refreshToken);

  const isProd = process.env.NODE_ENV === "production";
  const cookieOptions = {
    httpOnly: true,
    sameSite: (isProd ? "none" : "lax") as "none" | "lax",
    secure: isProd,
  };

  res.clearCookie("access_token", cookieOptions);
  res.clearCookie("refresh_token", cookieOptions);
  res.clearCookie("access_token_expires_at", { ...cookieOptions, httpOnly: false });

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
