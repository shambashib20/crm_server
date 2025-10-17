import cron from "node-cron";
import axios from "axios";
import { sendMarketingEmails } from "../services/email-campaign-service";
import PurchaseRecordsModel from "../models/purchaserecords.model";
import Property from "../models/property.model";
import { PurchaseStatus } from "../dtos/purchaserecords.dto";

const getDaysLeft = (validityDate: Date): number => {
  const now = new Date();
  const diffMs = validityDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  return diffDays > 0 ? diffDays : 0;
};

// cron.schedule("* * * * *", async () => {
//   console.log("Running FB sync task...");
//   try {
//     await axios.post("https://crm-server-tsnj.onrender.com/lead/webhook", {});
//     console.log("Facebook leads fetched successfully.");
//   } catch (error) {
//     console.error("Error fetching leads:", error);
//   }
// });
const BASE_URL =
  process.env.NODE_ENV === "production"
    ? "https://crm-server-tsnj.onrender.com"
    : "http://localhost:8850"; // 👈 LOCAL
cron.schedule("*/2  * * * *", async () => {
  console.log("Running FB sync task...");
  try {
    await axios.post(`${BASE_URL}/lead/webhook`, {});

    console.log(BASE_URL, "Base");
    console.log("Facebook leads fetched successfully.");
  } catch (error) {
    console.error("Error fetching leads:", error);
  }
});

// cron.schedule("0 * * * *", async () => {
//   console.log("⏰ Running hourly email campaign job...");
//   await sendMarketingEmails();
// });

cron.schedule("0 0 * * *", async () => {
  console.log("⏰ Running daily email campaign job at midnight...");
  await sendMarketingEmails();
});

// cron.schedule("0 0 * * *", async () => {
//   console.log("⏰ Running daily feature validity update job...");

//   try {
//     // 1. Fetch all properties
//     const properties = await Property.find();

//     for (const property of properties) {
//       const propertyId = property._id;

//       const purchaseRecord = await PurchaseRecordsModel.findOne({
//         property_id: propertyId,
//         status: PurchaseStatus.COMPLETED,
//       }).sort({ createdAt: -1 });

//       if (!purchaseRecord) continue;
//       if (!purchaseRecord.meta?.activated_features) continue;

//       let isUpdated = false;


//       purchaseRecord.meta.activated_features =
//         purchaseRecord.meta.activated_features.map((feature: { validity: string | number | Date; validity_left_till_expiration: number; }) => {
//           if (feature.validity) {
//             const daysLeft = getDaysLeft(new Date(feature.validity));

//             if (feature.validity_left_till_expiration !== daysLeft) {
//               feature.validity_left_till_expiration = daysLeft;
//               isUpdated = true;
//             }
//           }
//           return feature;
//         });

//       if (isUpdated) {
//         await purchaseRecord.save();
//         console.log(
//           `✅ Updated validity_left_till_expiration for property ${propertyId}`
//         );
//       }
//     }

//     console.log("🎉 Daily feature validity job completed!");
//   } catch (error) {
//     console.error("❌ Error in daily feature validity job:", error);
//   }
// });

cron.schedule("0 0 * * *", async () => {
  console.log("⏰ Running daily feature validity update job...");

  try {
    // 1. Fetch all properties
    const properties = await Property.find();

    for (const property of properties) {
      const propertyId = property._id;

      const purchaseRecord = await PurchaseRecordsModel.findOne({
        property_id: propertyId,
        status: PurchaseStatus.COMPLETED,
      }).sort({ createdAt: -1 });

      if (!purchaseRecord) continue;
      if (!purchaseRecord.meta?.activated_features) continue;

      let isUpdated = false;


      purchaseRecord.meta.activated_features =
        purchaseRecord.meta.activated_features.map((feature: { validity: string | number | Date; validity_left_till_expiration: number; }) => {
          if (feature.validity) {
            const daysLeft = getDaysLeft(new Date(feature.validity));

            if (feature.validity_left_till_expiration !== daysLeft) {
              feature.validity_left_till_expiration = daysLeft;
              isUpdated = true;
            }
          }
          return feature;
        });

      if (isUpdated) {
        purchaseRecord.markModified("meta.activated_features"); 
        await purchaseRecord.save();
        console.log(`✅ Updated validity_left_till_expiration for property ${propertyId}`);
      }
    }

    console.log("🎉 Daily feature validity job completed!");
  } catch (error) {
    console.error("❌ Error in daily feature validity job:", error);
  }
});

