import { Types } from "mongoose";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();

interface DecodedAccessToken {
  userId: Types.ObjectId;
  ray_id: string;
  property_id: Types.ObjectId;
  iat: number;
  exp: number;
}
const generateAccessToken = (
  userId: Types.ObjectId,
  property_id: Types.ObjectId,
  ray_id: string
): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not defined in the environment variables");
  }
  const payload = {
    userId,
    property_id,
    ray_id,
  };
  try {
    const expiration = process.env.JWT_EXPIRATION || "1h";
    console.log(expiration, "ll");
    const token = jwt.sign(payload, secret, { expiresIn: expiration as any });

    return token;
  } catch (error) {
    console.error("Error generating JWT token:", error);
    throw new Error("Failed to generate authentication token");
  }
};

const generateRefreshToken = (userId: Types.ObjectId, ray_id: string) => {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) {
    throw new Error(
      "JWT_REFRESH_SECRET is not defined in the environment variables"
    );
  }
  const expiration = process.env.JWT_REFRESH_EXPIRATION;
  const payload = {
    userId,
    ray_id,
  };
  return jwt.sign(payload, secret, {
    expiresIn: expiration as any,
  });
};

export { generateAccessToken, generateRefreshToken };
