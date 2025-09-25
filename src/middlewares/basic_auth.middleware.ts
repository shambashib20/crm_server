// middlewares/BasicAuthMiddleware.ts
import { Request, Response, NextFunction } from "express";
import Property from "../models/property.model";
import { decrypt } from "../utils/crypto.util";

export const BasicAuthMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // STEP 1: Extract API key from Basic Auth (username field)
    const authHeader = req.headers.authorization || "";
    if (!authHeader.startsWith("Basic ")) {
      return res
        .status(401)
        .json({ success: false, message: "Authorization required" });
    }

    // Decode base64: "username:password"
    const base64Credentials = authHeader.split(" ")[1];
    const decoded = Buffer.from(base64Credentials, "base64").toString("utf-8");

    // Extract the username (API key) before the colon
    const [apiKey, password] = decoded.split(":");

    console.log("Decoded API Key:", apiKey);
    console.log("Full decoded string:", decoded);

    if (!apiKey) {
      return res
        .status(401)
        .json({ success: false, message: "API Key missing" });
    }

    const properties = await Property.find({
      "meta.keys": { $exists: true, $ne: [] },
    });

    let matchedProperty: any = null;
    let matchedKey: any = null;

    // Debugging: Log all properties and keys being checked
    console.log(`Checking ${properties.length} properties for API key match`);

    for (const property of properties) {
      const keys =
        property.meta instanceof Map
          ? property.meta.get("keys")
          : property.meta?.keys;

      if (!keys || !Array.isArray(keys)) {
        console.log(`No keys found for property ${property._id}`);
        continue;
      }

      console.log(`Checking ${keys.length} keys in property ${property._id}`);

      for (const k of keys) {
        console.log("Checking key:", k.title);
        console.log("Stored encrypted value:", k.value);
        console.log("Key status:", k.status);

        // Try direct comparison first (in case key is stored unencrypted)
        if (k.value === apiKey) {
          console.log("Direct match found");
          matchedProperty = property;
          matchedKey = k;
          break;
        }

        // Try decryption for encrypted keys
        try {
          if (k.value.includes(":")) {
            const [plaintextPart, encryptedPart] = k.value.split(":");
            const decryptedValue = decrypt(encryptedPart);
            if (plaintextPart === apiKey || decryptedValue === apiKey) {
              matchedProperty = property;
              matchedKey = k;
              break;
            }
          } else {
            const decryptedValue = decrypt(k.value);
            if (decryptedValue === apiKey) {
              matchedProperty = property;
              matchedKey = k;
              break;
            }
          }
        } catch (decryptError) {
          console.error("Decryption failed for key:", k.value, decryptError);
          continue;
        }
      }
      if (matchedProperty) break;
    }

    if (!matchedProperty || !matchedKey) {
      console.log("No matching API key found in database");
      return res
        .status(401)
        .json({ success: false, message: "Invalid API Key" });
    }

    console.log("API Key validation successful");
    console.log("Matched Property ID:", matchedProperty._id);
    console.log("Matched Key Title:", matchedKey.title);
    console.log("Key Status:", matchedKey.status);

    if (matchedKey.status !== "ACTIVE") {
      return res.status(403).json({
        success: false,
        message: "API Key is not active",
      });
    }

    if (matchedKey.expiry_at && new Date(matchedKey.expiry_at) < new Date()) {
      return res.status(403).json({
        success: false,
        message: "API Key has expired",
      });
    }

    // Attach property and API key info to request object
    (req as any).property = matchedProperty;
    (req as any).apiKey = matchedKey;

    return next();
  } catch (err: any) {
    console.error("Authentication middleware error:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Authentication failed",
    });
  }
};
