import { Types } from "mongoose";
import axios from "axios";
import Automation from "../models/automation.model";

import User from "../models/user.model";
import Status from "../models/status.model";
import CampaignTemplate from "../models/campaign.model";
import { AutomationType, LeadType } from "../dtos/automation.dto";

const WAPMONKEY_API = "https://api.wapmonkey.com/v1/sendmessage";
const API_KEY = process.env.WAPMONKEY_AUTH_TOKEN!;

const _triggerLeadAutomationWebhook = async (lead: any) => {
  try {
    console.log(`🚀 Triggering automation webhook for lead: ${lead._id}`);

    // ✅ Fetch automation for FIRST_MESSAGE event
    const automation = await Automation.findOne({
      type: AutomationType.LEAD_AUTOMATION,
      lead_type: LeadType.FIRST_MESSAGE,
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

    const recipientNumber = lead.phone_number;
    if (!recipientNumber) {
      console.log("⚠️ Lead has no phone number to send message to.");
      return;
    }

    const template = await CampaignTemplate.findById(rule.template_id);

    if (!template) return;

    // read meta.map safely
    let variableMap: Record<string, string> = {};
    console.log(template?.meta, "map of template");
    if (template.meta instanceof Map) {
      const vm = template.meta.get("variable_map");

      if (vm instanceof Map) {
        variableMap = Object.fromEntries(vm);
      } else if (typeof vm === "object" && vm !== null) {
        variableMap = { ...vm };
      }
    }

    const fieldMap: Record<string, string> = {
      customerName: "name",
      customerNumber: "phone_number",
      customerEmail: "email",
      customerAddress: "address",
      customerCompany: "company_name",
      customerGST: "gst",
    };
    let message = String(template.message ?? "");

    Object.entries(variableMap).forEach(([key, alias]) => {
      const leadField = fieldMap[alias];
      const value = lead[leadField] ?? "";
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, "g");
      message = message.replace(regex, value);
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

    // console.log("📬 WapMonkey API Response:");
    // console.log("Status Code:", response.status);
    // console.log("Response Data:", JSON.stringify(response.data, null, 2));

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
