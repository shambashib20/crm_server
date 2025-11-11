// services/razorpay-webhook-checker.ts
import axios from "axios";

/**
 * Checks if the Razorpay webhook for this backend is active and enabled.
 * Logs detailed status to console.
 */
export const checkRazorpayWebhookStatus = async () => {
  try {
    console.log("🔍 Checking Razorpay Webhook status...");

    const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || "";
    const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "";
    const RAZORPAY_WEBHOOK_URL = process.env.RAZORPAY_WEBHOOK_URL || "";

    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      console.error(
        "❌ Missing Razorpay credentials in environment variables."
      );
      return {
        success: false,
        message: "Missing Razorpay credentials in environment variables.",
      };
    }

    const response = await axios.get("https://api.razorpay.com/v1/webhooks", {
      auth: {
        username: RAZORPAY_KEY_ID,
        password: RAZORPAY_KEY_SECRET,
      },
    });

    const webhooks = response.data?.items || [];

    if (!Array.isArray(webhooks) || webhooks.length === 0) {
      console.warn("⚠️ No webhooks found in your Razorpay account!");
      return {
        success: false,
        message: "No webhooks found in Razorpay account.",
      };
    }
    const webhook = webhooks.find((w: any) =>
      w.url.includes(RAZORPAY_WEBHOOK_URL)
    );

    if (!webhook) {
      console.error(
        "❌ No matching Razorpay webhook found for:",
        RAZORPAY_WEBHOOK_URL
      );
      return {
        success: false,
        message: `No matching webhook found for URL: ${RAZORPAY_WEBHOOK_URL}`,
      };
    }

    if (webhook.enabled === false) {
      console.error(`⚠️ Razorpay webhook [${webhook.id}] is DISABLED.`);
      console.warn(
        "👉 Please go to Razorpay Dashboard > Settings > Webhooks and enable it."
      );
      return {
        success: false,
        message: `Webhook found but disabled. ID: ${webhook.id}`,
        webhookId: webhook.id,
        webhookUrl: webhook.url,
        events: Object.keys(webhook.events || {}),
      };
    }

    console.log(`✅ Razorpay webhook is ACTIVE:`);
    console.log(`   ID: ${webhook.id}`);
    console.log(`   URL: ${webhook.url}`);
    console.log(`   Events: ${Object.keys(webhook.events).join(", ")}`);
    return {
      success: true,
      message: "Webhook is active",
      webhookId: webhook.id,
      webhookUrl: webhook.url,
      events: Object.keys(webhook.events || {}),
    };
  } catch (err: any) {
    console.error("❌ Error checking Razorpay webhook status:");
    console.error(err?.response?.data || err.message || err);
  }
};
