import cron from "node-cron";
import axios from "axios";
import { sendMarketingEmails } from "../services/email-campaign-service";

// cron.schedule("* * * * *", async () => {
//   console.log("Running FB sync task...");
//   try {
//     await axios.post("https://crm-server-tsnj.onrender.com/lead/webhook", {});
//     console.log("Facebook leads fetched successfully.");
//   } catch (error) {
//     console.error("Error fetching leads:", error);
//   }
// });

cron.schedule("*/15 * * * *", async () => {
  console.log("Running FB sync task...");
  try {
    await axios.post("https://crm-server-tsnj.onrender.com/lead/webhook", {});
    console.log("Facebook leads fetched successfully.");
  } catch (error) {
    console.error("Error fetching leads:", error);
  }
});

// cron.schedule("0 * * * *", async () => {
//   console.log("⏰ Running hourly email campaign job...");
//   await sendMarketingEmails();
// });

// cron.schedule("*/2 * * * *", async () => {
//   console.log("⏰ Running test email campaign job (every 2 mins)...");
//   await sendMarketingEmails();
// });
