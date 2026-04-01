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

    // Decode Base64 — Apidog (and all HTTP clients) send Base64(apikey:password).
    // We extract only the part before the colon as the actual API key value.
    const decoded = Buffer.from(base64Credentials, "base64").toString("utf-8");
    const apiKeyValue = decoded.split(":")[0];

    const properties = await Property.find({
      "meta.keys.value": apiKeyValue,
    });

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

    const matchedKey = keys.find((k: any) => k.value === apiKeyValue);

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

    if (
      matchedKey.usage_limit !== undefined &&
      matchedKey.usage_count >= matchedKey.usage_limit
    ) {
      return res
        .status(429)
        .json({ success: false, message: "API Key usage limit reached" });
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