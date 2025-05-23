import bcrypt from "bcrypt";
import User from "../models/user.model";
import Role from "../models/role.model";
import {
  generateAccessToken,
  generateRefreshToken,
} from "../utils/jwt_auth.util";
import { Types } from "mongoose";

import { Response } from "express";

const _loginSuperAdmin = async (
  email: string,
  password: string,
  res: Response
) => {
  const user = await User.findOne({ email }).populate("role");
  if (!user) {
    throw new Error("Invalid email");
  }
  //   console.log("ldld", user);

  const isMatch = await bcrypt.compare(password.trim(), user.password);
  if (!isMatch) {
    throw new Error("Invalid password");
  }

  const role = await Role.findById(user.role);
  if (!role || role.name !== "Superadmin") {
    throw new Error("Access denied: Not a Superadmin");
  }
  const accessToken = generateAccessToken(
    new Types.ObjectId(user._id),
    new Types.ObjectId(user.property_id),
    user?.meta?.ray_id as string
  );
  const refreshToken = generateRefreshToken(
    new Types.ObjectId(user._id),
    user?.meta?.ray_id as string
  );

  res.cookie("access_token", accessToken, {
    httpOnly: true,
    maxAge: 5 * 24 * 60 * 60 * 1000,
    sameSite: "lax",
  });

  res.cookie("refresh_token", refreshToken, {
    httpOnly: true,
    maxAge: 30 * 24 * 60 * 60 * 1000,
    sameSite: "lax",
  });

  return {
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      phone_number: user.phone_number,
      role: role.name,
    },
  };
};

export { _loginSuperAdmin };
