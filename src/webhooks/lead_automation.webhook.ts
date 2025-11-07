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

    // ✅ Find the rule matching the lead's status
    const rule = automation.rules.find((r: any) =>
      r.status_id?.equals(lead.status)
    );
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

    // ✅ Fetch the agent who was already assigned to the lead
    if (!lead.assigned_to) {
      console.log(
        "⚠️ No agent assigned to this lead — cannot trigger automation."
      );
      return;
    }

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

    // ✅ Fetch the template from automation rule
    const template = await CampaignTemplate.findById(rule.template_id).lean();
    if (!template) {
      console.log("⚠️ Template not found for automation rule.");
      return;
    }

    // ✅ Build dynamic message text
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
      device_token: deviceToken, // agent’s sending device
    };

    await axios.post(WAPMONKEY_API, body, {
      headers: {
        Authorization: API_KEY,
        "Content-Type": "application/json",
      },
    });

    console.log(
      `✅ Message sent to lead (${recipientNumber}) via ${agent.name}'s device.`
    );
  } catch (error: any) {
    console.error(
      "❌ Error in triggerLeadAutomationWebhook:",
      error?.message ?? error
    );
  }
};

export { _triggerLeadAutomationWebhook };
