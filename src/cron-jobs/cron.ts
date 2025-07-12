import cron from "node-cron";
import axios from "axios";

cron.schedule("*/5 * * * *", async () => {
  console.log("Running FB sync task...");
  try {
    await axios.get("https://crm-server-tsnj.onrender.com/lead/webhook");
    console.log("Facebook leads fetched successfully.");
  } catch (error) {
    console.error("Error fetching leads:", error);
  }
});
