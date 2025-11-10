import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import User from "../models/user.model";
import Property from "../models/property.model";
import { generateAccessToken } from "../utils/jwt_auth.util";

/**
 * 🔐 AuthMiddleware
 * - Verifies access_token (short-lived)
 * - If expired/missing but refresh_token is valid, regenerates a new one
 * - Automatically updates cookies without logging the user out
 */

const AuthMiddleware = async (
  req: Request & { user?: any; property?: any },
  res: Response,
  next: NextFunction
) => {
  try {
    const { access_token, refresh_token } = req.cookies;
    const isProd = process.env.NODE_ENV === "production";

    // ======================================
    // 🟥 CASE 1 — No tokens at all
    // ======================================
    if (!access_token && !refresh_token) {
      return res.status(401).json({
        message: "Access denied. No tokens provided.",
      });
    }

    // ======================================
    // 🟨 CASE 2 — Token-based logic switch
    // ======================================
    switch (true) {
      // --------------------------------------
      // 🟢 CASE 2.1 — Access token exists
      // --------------------------------------
      case !!access_token: {
        try {
          const decoded: any = jwt.verify(
            access_token,
            process.env.JWT_SECRET as string
          );

          const user = await User.findById(decoded.userId)
            .select("-password")
            .populate("role");

          if (!user)
            return res.status(401).json({ message: "User not found." });
          if (user.is_banned)
            return res.status(403).json({ message: "User is banned." });

          const property = await Property.findById(user.property_id);
          if (!property)
            return res
              .status(404)
              .json({ message: "Associated property not found." });

          req.user = user;
          req.property = property;

          return next();
        } catch (error: any) {
          // ⚠️ Token expired → try refresh
          switch (error.name) {
            case "TokenExpiredError":
              if (refresh_token) {
                console.log("🔁 Access token expired — refreshing...");
                return await handleRefreshFlow(
                  req,
                  res,
                  next,
                  refresh_token,
                  isProd
                );
              }
              break;

            default:
              console.error("❌ Invalid access token:", error.message);
              return res.status(401).json({
                message: "Invalid or expired access token.",
                error: error.message,
              });
          }
        }
        break;
      }

      // --------------------------------------
      // 🟡 CASE 2.2 — Access token missing but refresh token exists
      // --------------------------------------
      case !access_token && !!refresh_token: {
        console.log(
          "🪄 Access token missing — using refresh token to regenerate..."
        );
        return await handleRefreshFlow(req, res, next, refresh_token, isProd);
      }

      // --------------------------------------
      // 🔴 DEFAULT (Failsafe)
      // --------------------------------------
      default:
        console.error("❌ Unhandled authentication state");
        return res.status(401).json({
          message: "Authentication failed. Please log in again.",
        });
    }
  } catch (err: any) {
    console.error("💥 AuthMiddleware global error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * 🔁 Helper — Refresh token flow
 * - Verifies refresh_token validity
 * - Regenerates a new access_token if valid
 * - Updates cookies automatically
 */
const handleRefreshFlow = async (
  req: any,
  res: Response,
  next: NextFunction,
  refresh_token: string,
  isProd: boolean
) => {
  try {
    const decodedRefresh: any = jwt.verify(
      refresh_token,
      process.env.JWT_REFRESH_SECRET as string
    );

    const user = await User.findById(decodedRefresh.userId)
      .select("-password")
      .populate("role");

    if (!user) return res.status(401).json({ message: "User not found." });
    if (user.is_banned)
      return res.status(403).json({ message: "User is banned." });

    const property = await Property.findById(user.property_id);
    if (!property)
      return res
        .status(404)
        .json({ message: "Associated property not found." });

    // 🧠 Generate new short-lived access token
    const newAccessToken = generateAccessToken(
      new Types.ObjectId(user._id),
      new Types.ObjectId(user.property_id),
      user?.meta?.ray_id as string
    );

    const expiresInMs = 5 * 24 * 60 * 60 * 1000; // 5 days
    const newExpiryDate = new Date(Date.now() + expiresInMs);
    // ⏱️ Token expiry — 2 minutes for testing
    // const expiresInMs = 2 * 60 * 1000;
    // const newExpiryDate = new Date(Date.now() + expiresInMs);

    // 🍪 Reset cookies
    res.cookie("access_token", newAccessToken, {
      httpOnly: true,
      maxAge: expiresInMs,
      sameSite: isProd ? "none" : "lax",
      secure: isProd,
    });

    res.cookie("access_token_expires_at", newExpiryDate.toISOString(), {
      httpOnly: false, // visible to frontend
      sameSite: isProd ? "none" : "lax",
      secure: isProd,
    });

    req.user = user;
    req.property = property;

    console.log("✅ New access token generated successfully via refresh token");
    return next();
  } catch (refreshErr: any) {
    console.error("❌ Refresh token invalid or expired:", refreshErr.message);

    // 🧹 Clear cookies when refresh token is invalid
    res.clearCookie("access_token");
    res.clearCookie("refresh_token");
    res.clearCookie("access_token_expires_at");

    return res.status(401).json({
      message: "Session expired. Please log in again.",
    });
  }
};

export default AuthMiddleware;