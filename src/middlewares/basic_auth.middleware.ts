// middlewares/BasicAuthMiddleware.ts
import { Request, Response, NextFunction } from "express";
import Property from "../models/property.model";




export const BasicAuthMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization || "";

    console.log("Raw Auth Header:", authHeader);

    if (!authHeader.startsWith("Basic ")) {
      return res
        .status(401)
        .json({ success: false, message: "Authorization required" });
    }

    const base64Credentials = authHeader.split(" ")[1];

    if (!base64Credentials) {
      return res.status(401).json({
        success: false,
        message: "Invalid Authorization header format",
      });
    }

    console.log("API Key (Base64):", base64Credentials);

    const properties = await Property.find({
      "meta.keys.value": base64Credentials,
    });

    console.log("Properties found:", properties.length);

    if (properties.length === 0) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid API Key" });
    }

    const property = properties[0];
    const keys =
      property.meta instanceof Map
        ? property.meta.get("keys")
        : property.meta?.keys;

    if (!keys || !Array.isArray(keys)) {
      return res
        .status(401)
        .json({ success: false, message: "No keys found for property" });
    }

    const matchedKey = keys.find((k: any) => k.value === base64Credentials);

    if (!matchedKey) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid API Key" });
    }

    if (matchedKey.status !== "ACTIVE") {
      return res
        .status(403)
        .json({ success: false, message: "API Key is not active" });
    }

    if (matchedKey.expiry_at && new Date(matchedKey.expiry_at) < new Date()) {
      return res
        .status(403)
        .json({ success: false, message: "API Key has expired" });
    }

    // Attach property + API key
    (req as any).property = property;
    (req as any).apiKey = matchedKey;

    console.log(property, "prop in middleware");

    return next();
  } catch (err: any) {
    console.error("Authentication middleware error:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Authentication failed",
    });
  }
};