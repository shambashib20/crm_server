import { Request, Response } from "express";
import crypto from "crypto";

import PurchaseRecordsModel from "../models/purchaserecords.model";
import Package from "../models/package.model";
import Property from "../models/property.model";
import Feature from "../models/feature.model";
import { PurchaseStatus } from "../dtos/purchaserecords.dto";
import { LogStatus } from "../dtos/property.dto";
import AddOns from "../models/addonsmodel";
import { Types } from "mongoose";

export const razorpayWebhookHandler = async (req: Request, res: Response) => {
  console.log("➡️ Razorpay webhook hit");

  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || "";
  const signature = req.headers["x-razorpay-signature"] as string;

  try {
    // 🧾 Validate and verify signature
    const bodyBuffer = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(JSON.stringify(req.body));
    const expected = crypto
      .createHmac("sha256", webhookSecret)
      .update(bodyBuffer)
      .digest("hex");

    if (expected !== signature) {
      console.error("❌ Signature verification failed");
      return res.status(400).send("Invalid signature");
    }

    console.log("✅ Signature verified successfully");
    const jsonBody = JSON.parse(bodyBuffer.toString("utf-8"));
    const event = jsonBody?.event;
    const payload = jsonBody?.payload || {};

    console.log("🟢 Event Received:", event);

    switch (event) {
      case "payment_link.paid": {
        console.log("💰 Handling event: payment_link.paid");

        const paymentEntity = payload?.payment?.entity || {};
        const paymentLinkEntity = payload?.payment_link?.entity || {};

        const paymentId = paymentEntity?.id;
        const paymentLinkId = paymentLinkEntity?.id;
        const linkNotes = paymentLinkEntity?.notes || {};

        const addonIdFromNotes = linkNotes?.addon_id;
        const propertyIdFromNotes = linkNotes?.property_id;
        const packageIdFromNotes = linkNotes?.package_id;
        const now = new Date();

        if (!propertyIdFromNotes) {
          return res.status(400).json({
            ok: false,
            message: "Missing property_id in notes",
          });
        }

        // 🔁 Idempotency check
        const existingPayment = await PurchaseRecordsModel.findOne({
          $or: [
            { "meta.payment_id": paymentId },
            { "meta.payment_link_id": paymentLinkId },
          ],
        });
        if (existingPayment) {
          console.log("ℹ️ Payment already processed:", existingPayment._id);
          return res.status(200).json({ ok: true });
        }

        // 🔄 Switch logic for Add-On or Package
        switch (true) {
          // ===================================
          // 🧩 CASE 1: ADD-ON PURCHASE
          // ===================================
          case !!addonIdFromNotes: {
            console.log("🧩 Detected Add-On purchase");

            const addon = await AddOns.findById(addonIdFromNotes);
            if (!addon) {
              return res
                .status(404)
                .json({ ok: false, message: "Add-On not found" });
            }

            const matchedLink = (addon.meta?.payment_links || []).find(
              (l: any) => l.link_id === paymentLinkId
            );
            if (!matchedLink) {
              return res
                .status(400)
                .json({ ok: false, message: "Invalid Add-On payment link" });
            }

            // mark as used
            matchedLink.is_active = false;
            matchedLink.status = "paid";
            await addon.save();

            const activatedAddon = {
              addon_id: addon._id,
              title: addon.title,
              description: addon.description,
              value: addon.value,
              status: addon.status,
              payment_link: matchedLink,
              activated_at: now,
            };

            // 🔍 Get property and verify active package
            const property = await Property.findById(propertyIdFromNotes);
            if (!property) {
              console.error("❌ Property not found");
              return res
                .status(404)
                .json({ ok: false, message: "Property not found" });
            }

            const activePackageId =
              property.meta?.active_package?._id ||
              property.meta?.active_package ||
              null;

            if (!activePackageId) {
              console.error("❌ Active package ID missing for property");
              return res.status(404).json({
                ok: false,
                message: "Active package not found for this property",
              });
            }

            // 🧠 Ensure valid ObjectId
            const purchaseRecord = await PurchaseRecordsModel.findById(
              new Types.ObjectId(activePackageId)
            );

            if (!purchaseRecord) {
              console.error("❌ Active purchase record not found");
              return res.status(404).json({
                ok: false,
                message: "Purchase record not found for property",
              });
            }

            if (!purchaseRecord.meta) purchaseRecord.meta = {};
            if (!Array.isArray(purchaseRecord.meta.activated_addons)) {
              purchaseRecord.meta.activated_addons = [];
            }

            // 🛡 Check if Add-On already exists (renewal logic)
            const existingAddonIndex =
              purchaseRecord.meta.activated_addons.findIndex(
                (a: any) => String(a.addon_id) === String(addon._id)
              );

            if (existingAddonIndex !== -1) {
              console.log("🔁 Existing Add-On found — updating it (renewal)");
              purchaseRecord.meta.activated_addons[existingAddonIndex] =
                activatedAddon;
            } else {
              console.log("✅ Adding new Add-On to existing purchase");
              purchaseRecord.meta.activated_addons.push(activatedAddon);
            }

            purchaseRecord.meta.last_updated_payment = {
              payment_id: paymentId,
              payment_link_id: paymentLinkId,
              amount: paymentEntity?.amount,
              date: now,
            };

            await purchaseRecord.save();

            // Log in property
            property.logs = property.logs || [];
            property.logs.push({
              title: "Add-On Activated",
              description: `Add-On '${addon.title}' purchased and activated.`,
              status: LogStatus.INFO,
              meta: { addon_id: addon._id, payment_id: paymentId },
              createdAt: now,
              updatedAt: now,
            });
            await property.save();

            return res.status(200).json({
              ok: true,
              message: "Add-On successfully updated in active purchase record",
            });
          }

          // ===================================
          // 🧩 CASE 2: PACKAGE PURCHASE
          // ===================================
          case !!packageIdFromNotes: {
            console.log("🧩 Detected Package purchase flow");

            const pkg = await Package.findById(packageIdFromNotes).populate(
              "features"
            );
            if (!pkg) {
              return res
                .status(404)
                .json({ ok: false, message: "Package not found" });
            }

            const validityDays = pkg.validity_in_days || 0;
            const validityDate = new Date(
              Date.now() + validityDays * 24 * 60 * 60 * 1000
            );

            const activatedFeatures = await Promise.all(
              pkg.features.map(async (f: any) => {
                const featureDoc = f?._id ? f : await Feature.findById(f);
                return {
                  feature_id: featureDoc?._id,
                  title: featureDoc?.title || "Unknown Feature",
                  limit: featureDoc?.meta?.limit ?? 0,
                  used: 0,
                  validity: validityDate,
                  validity_in_days: validityDays,
                };
              })
            );

            const newPurchase = await PurchaseRecordsModel.create({
              property_id: propertyIdFromNotes,
              package_id: pkg._id,
              status: PurchaseStatus.COMPLETED,
              meta: {
                transaction_id:
                  paymentEntity?.order_id || paymentEntity?.id || null,
                payment_method: paymentEntity?.method || "razorpay",
                payment_id: paymentId,
                payment_link_id: paymentLinkId,
                amount: paymentEntity?.amount,
                notes: linkNotes,
                raw: req.body,
                activated_features: activatedFeatures,
                activated_addons: [], // 🚨 Always empty on package purchase
              },
            });

            // Update property with this new purchase
            const property = await Property.findById(propertyIdFromNotes);
            if (property) {
              if (!property.meta) property.meta = {};
              property.meta.active_package = newPurchase._id;
              property.logs = property.logs || [];
              property.logs.push({
                title: "Package Purchased",
                description: `Package '${pkg.title}' purchased and activated.`,
                status: LogStatus.INFO,
                meta: {
                  purchaseRecordId: newPurchase._id,
                  packageId: pkg._id,
                },
                createdAt: now,
                updatedAt: now,
              });
              await property.save();
            }

            console.log("✅ New Package Purchase Created:", newPurchase._id);
            return res.status(200).json({
              ok: true,
              message: "Package purchase recorded successfully",
            });
          }

          // ===================================
          // 🚫 DEFAULT
          // ===================================
          default:
            return res.status(400).json({
              ok: false,
              message:
                "Could not determine whether this is a Package or Add-On purchase",
            });
        }
      }

      // Unhandled event fallback
      default:
        console.log("ℹ️ Ignored event:", event);
        return res.status(200).json({ ok: true });
    }
  } catch (err: any) {
    console.error("💥 Error in Razorpay Webhook Handler:", err);
    return res.status(500).json({
      ok: false,
      message: err?.message || "Webhook processing failed",
    });
  }
};

