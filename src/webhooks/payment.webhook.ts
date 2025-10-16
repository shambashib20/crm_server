import { Request, Response } from "express";
import crypto from "crypto";
import mongoose, { Types } from "mongoose";
import PurchaseRecordsModel from "../models/purchaserecords.model";
import Package from "../models/package.model";
import Property from "../models/property.model";
import Feature from "../models/feature.model";
import { PurchaseStatus } from "../dtos/purchaserecords.dto";
import { LogStatus } from "../dtos/property.dto";

export const razorpayWebhookHandler = async (req: Request, res: Response) => {
  console.log("➡️ Razorpay webhook hit");
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || "";
  const signature = req.headers["x-razorpay-signature"] as string;

  // ⚡ Use the raw buffer directly
  const bodyBuffer = req.body as Buffer;
  const bodyString = bodyBuffer.toString("utf-8");
  console.log("Raw body (string):", bodyString);
  try {
    if (!signature) {
      console.error("❌ Missing signature header");
      return res.status(400).send("Missing signature header");
    }
    if (!webhookSecret) {
      console.error("❌ Missing RAZORPAY_WEBHOOK_SECRET in env");
      return res.status(400).send("Webhook secret not configured");
    }

    // Verify signature
    const expected = crypto
      .createHmac("sha256", webhookSecret)
      .update(bodyBuffer)
      .digest("hex");

    if (expected !== signature) {
      console.error("❌ Signature verification failed");
      return res.status(400).send("Invalid signature");
    }
    console.log("✅ Signature verified");

    const jsonBody = JSON.parse(bodyString);
    const event = jsonBody?.event;
    const payload = jsonBody?.payload || {};

    console.log("Event received:", event);

    // ✅ Only handle payment_link.paid as final
    if (event !== "payment_link.paid") {
      console.log("ℹ️ Event ignored:", event);
      return res.status(200).json({ ok: true, message: "Event ignored" });
    }

    const paymentEntity = payload?.payment?.entity || {};
    const paymentLinkEntity =
      payload?.payment_link?.entity || payload?.payment_link || {};

    const paymentId = paymentEntity?.id || null;
    const paymentLinkId =
      paymentLinkEntity?.id || paymentLinkEntity?.payment_link_id || null;
    const linkNotes = paymentLinkEntity?.notes || {};

    const packageIdFromNotes = linkNotes?.package_id;
    const propertyIdFromNotes = linkNotes?.property_id;

    console.log("Payment ID:", paymentId);
    console.log("Payment Link ID:", paymentLinkId);
    console.log("Notes:", linkNotes);

    if (!packageIdFromNotes || !propertyIdFromNotes) {
      return res.status(400).json({
        ok: false,
        message: "Missing package_id or property_id in notes",
      });
    }

    // Idempotency check
    const existing = await PurchaseRecordsModel.findOne({
      $or: [
        { "meta.payment_id": paymentId },
        { "meta.payment_link_id": paymentLinkId },
      ],
    });

    if (existing) {
      console.log("ℹ️ Purchase already exists, skipping:", existing._id);
      return res.status(200).json({ ok: true, message: "Already processed" });
    }

    // Fetch package & features
    const pkg = await Package.findById(packageIdFromNotes).populate("features");
    if (!pkg) {
      console.error("❌ Package not found:", packageIdFromNotes);
      return res.status(404).json({ ok: false, message: "Package not found" });
    }
    console.log("✅ Package found:", pkg.title);

    const now = new Date();
    const validityDays = pkg.validity_in_days || 0;
    const validityDate = new Date(
      Date.now() + validityDays * 24 * 60 * 60 * 1000
    );

    // Activated features
    const populatedFeatures = Array.isArray(pkg.features) ? pkg.features : [];
    const activatedFeatures = await Promise.all(
      populatedFeatures.map(async (f: any) => {
        const featureDoc = f?._id ? f : await Feature.findById(f);
        const limit = featureDoc?.meta?.limit ?? 0;
        return {
          feature_id: featureDoc?._id,
          title: featureDoc?.title || "Unknown Feature",
          limit,
          used: 0,
          validity: validityDate,
          validity_in_days: validityDays,
          validity_left_till_expiration: Math.max(
            0,
            Math.ceil(
              (validityDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
            )
          ),
        };
      })
    );

    console.log(
      "✅ Features activated:",
      activatedFeatures.map((f) => f.title)
    );

    // Create purchase record
    const newPurchase: any = new PurchaseRecordsModel({
      property_id: new Types.ObjectId(propertyIdFromNotes),
      package_id: new Types.ObjectId(packageIdFromNotes),
      status: PurchaseStatus.COMPLETED,
      meta: {
        transaction_id: paymentEntity?.order_id || paymentEntity?.id || null,
        payment_method: paymentEntity?.method || "razorpay",
        payment_id: paymentId,
        payment_link_id: paymentLinkId,
        amount: paymentEntity?.amount || null,
        notes: linkNotes,
        raw: req.body,
        activated_features: activatedFeatures,
      },
    });

    await newPurchase.save();
    console.log("✅ Purchase record created:", newPurchase._id);
    // Update Property with active_package
    const property = await Property.findById(propertyIdFromNotes);
    if (!property) {
      console.error("❌ Property not found:", propertyIdFromNotes);
    } else {
      property.meta = property.meta || {};
      if (typeof property.meta.set === "function") {
        property.meta.set("active_package", newPurchase._id);
      } else {
        property.meta.active_package = newPurchase._id;
      }

      property.logs = property.logs || [];
      property.logs.push({
        title: "Package Purchased",
        description: `Package ${pkg.title} purchased and activated.`,
        status: LogStatus.INFO,
        meta: {
          purchaseRecordId: newPurchase._id,
          packageId: pkg._id,
          payment_id: paymentId,
        },
        createdAt: now,
        updatedAt: now,
      });

      await property.save();
      console.log("✅ Property updated with active package:", property._id);
    }

    return res
      .status(200)
      .json({ ok: true, message: "Purchase recorded successfully" });
  } catch (err: any) {
    console.error(
      "Error handling Razorpay webhook:",
      err?.response?.data || err.message || err
    );
    return res.status(500).json({
      ok: false,
      message: "Webhook processing failed",
      error: err?.message || err,
    });
  }
};
