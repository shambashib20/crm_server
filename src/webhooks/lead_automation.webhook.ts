import { Types } from "mongoose";
import axios from "axios";
import Automation from "../models/automation.model";
import Label from "../models/label.model";
import User from "../models/user.model";
import Status from "../models/status.model";
import CampaignTemplate from "../models/campaign.model";

const WAPMONKEY_API = "https://api.wapmonkey.com/v1/sendmessage";
const API_KEY = process.env.WAPMONKEY_AUTH_TOKEN!;

const _triggerLeadAutomationWebhook = async (lead: any) => {
  try {
    console.log(`🚀 Triggering automation webhook for lead: ${lead._id}`);

    // ✅ Fetch automation for FIRST_MESSAGE event
    const automation = await Automation.findOne({
      type: "LEAD_AUTOMATION",
      lead_type: "FIRST_MESSAGE",
      property_id: new Types.ObjectId(lead.property_id),
    });

    
    if (!automation) {
      console.log("⚠️ No FIRST_MESSAGE automation found for this property.");
      return;
    }

    const rule = automation.rules.find((r: any) =>
      r.status_id?.equals(lead.status)
    );

    console.log("Automation rule found:", rule);
    if (!rule) {
      console.log("⚠️ No matching automation rule found for this lead status.");
      return;
    }

    // ✅ Optional: Verify the status record
    const status = await Status.findById(rule.status_id).lean();
    if (!status) {
      console.log("⚠️ Status not found for automation rule.");
      return;
    }

    console.log("status", status);

    // ✅ Fetch the agent who was already assigned to the lead
    if (!lead.assigned_to) {
      console.log(
        "⚠️ No agent assigned to this lead — cannot trigger automation."
      );
      return;
    }

    console.log("telecaller", lead.assigned_to);

    const agent = await User.findById(lead.assigned_to).lean();
    if (!agent || !agent.meta?.whatsapp_device) {
      console.log("⚠️ Assigned agent has no WhatsApp device assigned.");
      return;
    }

    const whatsappDevice = agent.meta.whatsapp_device;
    const deviceToken = whatsappDevice.u_device_token;

    // ✅ Use the lead's phone number as recipient
    const recipientNumber = lead.phone_number;
    if (!recipientNumber) {
      console.log("⚠️ Lead has no phone number to send message to.");
      return;
    }

    const template = await CampaignTemplate.findById(rule.template_id).lean();
    if (!template) {
      console.log("⚠️ Template not found for automation rule.");
      return;
    }

    const variableMap = (template.meta?.variable_map || {}) as Record<
      string,
      string
    >;
    let message = String(template.message ?? "");

    Object.entries(variableMap).forEach(([key, field]) => {
      const fieldKey = String(field);
      const value = (lead as any)[fieldKey] ?? lead.meta?.[fieldKey] ?? "";
      message = message.replace(new RegExp(`{{${key}}}`, "g"), String(value));
    });

    // ✅ Prepare and send WhatsApp message via WapMonkey
    const body = {
      message,
      media: [],
      numbers: recipientNumber,
      device_token: deviceToken,
      u_id: whatsappDevice.u_id,
      d_id: whatsappDevice.d_id,
    };

    console.log("Sending message with body:", body);
    const response = await axios.post(WAPMONKEY_API, body, {
      headers: {
        Authorization: API_KEY,
        "Content-Type": "application/json",
      },
      validateStatus: () => true,
    });

    console.log("📬 WapMonkey API Response:");
    console.log("Status Code:", response.status);
    console.log("Response Data:", JSON.stringify(response.data, null, 2));

    if (response.status === 200 && response.data?.status === 1) {
      console.log(
        `✅ Message successfully sent to ${recipientNumber} via ${agent.name}'s device.`
      );
    } else {
      console.warn(
        `⚠️ Message sending may have failed. Status: ${response.status}`,
        response.data
      );
    }
  } catch (error: any) {
    console.error(
      "❌ Error in triggerLeadAutomationWebhook:",
      error?.message ?? error
    );
  }
};

export { _triggerLeadAutomationWebhook };
