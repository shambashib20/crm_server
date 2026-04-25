import cron from "node-cron";
import axios from "axios";
import { sendMarketingEmails } from "../services/email-campaign-service";
import PurchaseRecordsModel from "../models/purchaserecords.model";
import Property from "../models/property.model";
import { PurchaseStatus } from "../dtos/purchaserecords.dto";
import { _fetchAndSyncWapMonkeyDevices } from "../services/wapmonkeyusers.service";
import Role from "../models/role.model";
import User from "../models/user.model";
import { WhatsAppDevice } from "../models/wapmonkeyusers.model";

const getDaysLeft = (validityDate: Date): number => {
  const now = new Date();
  const diffMs = validityDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
};

let isFbSyncRunning = false;

const BASE_URL =
  process.env.NODE_ENV === "production"
    ? "https://mk9egvjms4.ap-south-1.awsapprunner.com"
    : "http://localhost:8850";

// ─── Facebook Leads Sync — every 5 min ───────────────────────────────────────
cron.schedule("*/15 * * * *", async () => {
  if (isFbSyncRunning) {
    console.log("⚠️ FB sync already running, skipping this cycle.");
    return;
  }
  isFbSyncRunning = true;
  console.log("🚀 Running Facebook sync job...");
  try {
    await axios.post(`${BASE_URL}/lead/webhook`, {});
    console.log("Facebook leads fetched successfully.");
  } catch (error) {
    console.error("Error fetching leads:", error);
  } finally {
    isFbSyncRunning = false;
  }
});

// ─── Email Campaign — daily midnight ─────────────────────────────────────────
cron.schedule("0 0 * * *", async () => {
  console.log("⏰ Running daily email campaign job at midnight...");
  await sendMarketingEmails();
});

// ─── Feature Validity Update — every hour ────────────────────────────────────
// FIX: was doing Property.find() + N individual PurchaseRecord queries + N saves.
// Now: single query for all completed records + one bulkWrite.
cron.schedule("0 * * * *", async () => {
  console.log("⏰ Running hourly feature validity update job...");
  try {
    const purchaseRecords = await PurchaseRecordsModel.find({
      status: PurchaseStatus.COMPLETED,
      "meta.activated_features": { $exists: true },
    }).lean();

    const bulkOps: any[] = [];

    for (const record of purchaseRecords) {
      const features: any[] = record.meta?.activated_features || [];
      let isUpdated = false;

      const updatedFeatures = features.map((feature: any) => {
        if (feature.validity) {
          const daysLeft = Math.max(getDaysLeft(new Date(feature.validity)), 0);
          if (feature.validity_left_till_expiration !== daysLeft) {
            isUpdated = true;
            return { ...feature, validity_left_till_expiration: daysLeft };
          }
        }
        return feature;
      });

      if (isUpdated) {
        bulkOps.push({
          updateOne: {
            filter: { _id: record._id },
            update: { $set: { "meta.activated_features": updatedFeatures } },
          },
        });
      }
    }

    if (bulkOps.length) {
      await PurchaseRecordsModel.bulkWrite(bulkOps);
      console.log(`✅ Updated validity for ${bulkOps.length} purchase records.`);
    }

    console.log("🎉 Feature validity job completed!");
  } catch (error) {
    console.error("❌ Error in feature validity job:", error);
  }
});

// ─── WapMonkey Device Sync — every 2 min ─────────────────────────────────────
cron.schedule("*/2 * * * *", async () => {
  console.log("🔁 Checking WapMonkey devices for new entries...");
  await _fetchAndSyncWapMonkeyDevices();
});

// ─── WhatsApp Device Sync — every 2 min ──────────────────────────────────────
// FIX: was doing N individual WhatsAppDevice.findOne() + N user.save() calls.
// Now: one query for all devices + one bulkWrite across all telecallers.
cron.schedule("*/2 * * * *", async () => {
  console.log("⏰ Running WhatsApp device sync cron...");
  try {
    const telecallerRole = await Role.findOne({ name: "Telecaller" }).select("_id").lean();
    if (!telecallerRole) {
      console.log("⚠️ Telecaller role not found, skipping WhatsApp device sync.");
      return;
    }

    const telecallers = await User.find({ role: telecallerRole._id })
      .select("_id name phone_number")
      .lean();

    if (!telecallers.length) {
      console.log("⚠️ No telecallers found!");
      return;
    }

    const phoneNumbers = telecallers.map((u: any) => u.phone_number).filter(Boolean);

    const devices = await WhatsAppDevice.find({ mobile_no: { $in: phoneNumbers } }).lean();
    const deviceMap = new Map(devices.map((d: any) => [d.mobile_no, d]));

    const bulkOps: any[] = telecallers
      .filter((u: any) => u.phone_number && deviceMap.has(u.phone_number))
      .map((u: any) => ({
        updateOne: {
          filter: { _id: u._id },
          update: { $set: { "meta.whatsapp_device": deviceMap.get(u.phone_number) } },
        },
      }));

    if (bulkOps.length) {
      await User.bulkWrite(bulkOps);
      console.log(`✅ Synced ${bulkOps.length} WhatsApp devices.`);
    }

    console.log("🎉 WhatsApp device sync completed.");
  } catch (error) {
    console.error("❌ Error in WhatsApp device sync cron:", error);
  }
});
