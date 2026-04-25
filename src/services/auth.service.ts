import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import User from "../models/user.model";
import Role from "../models/role.model";
import {
  generateAccessToken,
  generateRefreshToken,
} from "../utils/jwt_auth.util";
import { Types } from "mongoose";
import handlebars from "handlebars";
import { Response } from "express";
import fs from "fs";
import path from "path";
import { generateOTP } from "../utils/random_digit_generator.util";
import { sendEmail } from "../utils/email_service.util";
import Property from "../models/property.model";

const templatePath = path.join(__dirname, "../templates/otp_email.html");
const templateSource = fs.readFileSync(templatePath, "utf8");
const template = handlebars.compile(templateSource);

const _LoginForAllUsersService = async (
  email: string,
  password: string,
  res: Response
) => {
  const user = await User.findOne({ email }).populate("role");
  if (!user) {
    const err: any = new Error("Invalid email or password.");
    err.statusCode = 401;
    throw err;
  }

  const isMatch = await bcrypt.compare(password.trim(), user.password);
  if (!isMatch) {
    const err: any = new Error("Invalid email or password.");
    err.statusCode = 401;
    throw err;
  }

  if (user.meta?.get("is_active") === false) {
    const err: any = new Error("Your account has been deactivated. Please contact admin.");
    err.statusCode = 403;
    throw err;
  }

  const role = await Role.findById(user.role);

  const accessToken = generateAccessToken(
    new Types.ObjectId(user._id),
    new Types.ObjectId(user.property_id),
    user.meta?.get("ray_id") as string
  );
  const refreshToken = generateRefreshToken(
    new Types.ObjectId(user._id),
    user.meta?.get("ray_id") as string
  );
  const isProd = process.env.NODE_ENV === "production";
  res.cookie("access_token", accessToken, {
    httpOnly: true,
    maxAge: 5 * 24 * 60 * 60 * 1000,
    sameSite: isProd ? "none" : "lax",
    secure: isProd,
  });

  res.cookie("refresh_token", refreshToken, {
    httpOnly: true,
    maxAge: 30 * 24 * 60 * 60 * 1000,
    sameSite: isProd ? "none" : "lax",
    secure: isProd,
  });

  return {
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      phone_number: user.phone_number,
      role: role?.name,
    },
  };
};

const _loginSuperAdmin = async (
  email: string,
  password: string,
  res: Response
) => {
  const user = await User.findOne({ email }).populate("role");
  if (!user) {
    const err: any = new Error("Invalid email or password.");
    err.statusCode = 401;
    throw err;
  }
  if (user.is_banned)
    return res.status(403).json({ message: "User is banned." });

  const isMatch = await bcrypt.compare(password.trim(), user.password);
  if (!isMatch) {
    const err: any = new Error("Invalid email or password.");
    err.statusCode = 401;
    throw err;
  }

  if (user.meta?.get("is_active") === false) {
    return res.status(403).json({ message: "Your account has been deactivated. Please contact admin." });
  }

  const role = await Role.findById(user.role);
  const property = await Property.findById(user.property_id);
  if (property?.is_banned)
    return res.status(403).json({ message: "Vendor is banned. Please contact admin!" });

  const accessToken = generateAccessToken(
    new Types.ObjectId(user._id),
    new Types.ObjectId(user.property_id),
    user.meta?.get("ray_id") as string
  );
  const refreshToken = generateRefreshToken(
    new Types.ObjectId(user._id),
    user.meta?.get("ray_id") as string
  );
  const isProd = process.env.NODE_ENV === "production";
  res.cookie("access_token", accessToken, {
    httpOnly: true,
    maxAge: 2 * 60 * 1000,
    // maxAge: 5 * 24 * 60 * 60 * 1000,
    sameSite: isProd ? "none" : "lax",
    secure: isProd,
  });

  res.cookie("refresh_token", refreshToken, {
    httpOnly: true,
    maxAge: 30 * 24 * 60 * 60 * 1000,
    sameSite: isProd ? "none" : "lax",
    secure: isProd,
  });

  return {
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      phone_number: user.phone_number,
      role: role?.name,
      property_id: user.property_id,
    },
  };
};

const _forgotPasswordService = async (
  emailOrPhone: string
): Promise<string> => {
  const isPhone = /^\d{10}$/.test(emailOrPhone);
  const query = isPhone
    ? { phone_number: emailOrPhone }
    : { email: emailOrPhone };

  const user = await User.findOne(query);

  // Always return the same message whether the user exists or not.
  // This prevents attackers from enumerating registered emails/phones.
  if (!user) {
    return "OTP sent successfully.";
  }

  const otp = generateOTP();
  const expiration = new Date(Date.now() + 2 * 60 * 1000);

  // Update meta fields using findByIdAndUpdate
  await User.findByIdAndUpdate(
    user._id,
    {
      $set: {
        "meta.forgot_password_otp": otp,
        "meta.forgot_password_otp_expiration": expiration,
      },
    },
    { new: true }
  );

  if (isPhone) {
    // Send OTP via SMS
    // await client.messages.create({
    //   body: `Your OTP to reset password is ${otp}. It will expire in 2 minutes.`,
    //   from: twilioPhoneNumber,
    //   to: user.phone_number.startsWith("+")
    //     ? user.phone_number
    //     : `+91${user.phone_number}`,
    // });
  } else {
    // Send OTP via Email
    const emailSubject = "Reset Password OTP";
    const emailText = `Your OTP is ${otp}. It will expire in 2 minutes.`;
    const emailHtml = template({ username: user.name, OTP: otp });

    await sendEmail(user.email, emailSubject, emailText, emailHtml);
  }

  return "OTP sent successfully.";
};

const _resetPasswordService = async (
  otp: string,
  newPassword: string
): Promise<string> => {
  const user = await User.findOne({
    "meta.forgot_password_otp": otp,
  });

  if (!user) {
    throw new Error("Invalid OTP.");
  }

  const now = new Date();
  const expiration = new Date(user.meta?.get("forgot_password_otp_expiration"));

  if (expiration.getTime() < now.getTime()) {
    throw new Error("OTP has expired.");
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  await User.findByIdAndUpdate(
    user._id,
    {
      $set: {
        password: hashedPassword,
        "meta.forgot_password_otp": "",
        "meta.forgot_password_otp_expiration": null,
      },
    },
    { new: true }
  );

  return "Password reset successfully.";
};

const _updatePasswordService = async (
  rayId: string,
  newPassword: string
): Promise<string> => {
  const user = await User.findOne({
    "meta.ray_id": rayId,
  });

  if (!user) {
    throw new Error("Can't find the user!");
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  await User.findByIdAndUpdate(
    user._id,
    {
      $set: {
        password: hashedPassword,
      },
    },
    { new: true }
  );

  return "Password reset successfully.";
};

/**
 * Rotates the user's ray_id on logout so any stolen tokens are immediately
 * invalidated — the next request with the old token will fail ray_id validation.
 */
const _logoutService = async (
  accessToken?: string,
  refreshToken?: string
): Promise<void> => {
  const token = accessToken || refreshToken;
  const secret = accessToken
    ? process.env.JWT_SECRET
    : process.env.JWT_REFRESH_SECRET;

  if (!token || !secret) return;

  let userId: string | null = null;

  try {
    const decoded: any = jwt.verify(token, secret);
    userId = decoded.userId;
  } catch (e: any) {
    // Token may be expired but we still need the userId to rotate ray_id
    if (e.name === "TokenExpiredError") {
      const decoded: any = jwt.decode(token);
      userId = decoded?.userId ?? null;
    }
  }

  if (!userId) return;

  await User.findByIdAndUpdate(userId, {
    $set: { "meta.ray_id": `ray-id-${uuidv4()}` },
  });
};

export {
  _LoginForAllUsersService,
  _loginSuperAdmin,
  _forgotPasswordService,
  _resetPasswordService,
  _updatePasswordService,
  _logoutService,
};
