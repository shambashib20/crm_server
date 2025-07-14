import cron from "node-cron";
import axios from "axios";

cron.schedule("* * * * *", async () => {
  console.log("Running FB sync task...");
  try {
    await axios.post("https://crm-server-tsnj.onrender.com/lead/webhook");
    console.log("Facebook leads fetched successfully.");
  } catch (error) {
    console.error("Error fetching leads:", error);
  }
});
