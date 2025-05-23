import { _loginSuperAdmin } from "../services/auth.service";

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
    return res.status(500).json(new SuccessResponse(error.message, 500));
  }
};

export { LoginSuperAdminController };
