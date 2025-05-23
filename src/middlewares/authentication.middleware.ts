import jwt from "jsonwebtoken";
import { NextFunction, Request, Response } from "express";
import User from "../models/user.model";
import Property from "../models/property.model";
import Role from "../models/role.model";

const AuthMiddleware = async (req: any, res: any, next: any) => {
  try {
    const token = req.cookies?.access_token;

    if (!token) {
      return res
        .status(401)
        .json({ message: "Access denied. No token provided." });
    }

    const decoded: any = jwt.verify(token, process.env.JWT_SECRET as string);
    const user = await User.findById(decoded.userId)
      .select("-password")
      .populate("role");

    if (!user) {
      return res.status(401).json({ message: "User not found." });
    }

    if (user.is_banned === true) {
      return res.status(403).json({ message: "User is banned." });
    }

    const propertyId = user?.property_id;
    if (!propertyId) {
      return res
        .status(400)
        .json({ message: "Property ID missing in user metadata." });
    }

    const property = await Property.findById(propertyId);
    if (!property) {
      return res
        .status(404)
        .json({ message: "Associated property not found." });
    }

    const userRole = await Role.findOne({ _id: user.role._id });

    const roleName = (userRole?.name || "").toLowerCase();

    property.usage_count = (property.usage_count || 0) + 1;

    if (roleName !== "superadmin") {
      if (property.usage_limits <= 0) {
        return res
          .status(403)
          .json({ message: "Usage limit exceeded for this property." });
      }

      property.usage_limits -= 1;
    }

    await property.save();

    req.user = user;
    req.property = property;

    next();
  } catch (error: any) {
    console.error("AuthMiddleware error:", error);
    return res.status(401).json({
      message: "Invalid or expired token.",
      error: error.message,
    });
  }
};

export default AuthMiddleware;
