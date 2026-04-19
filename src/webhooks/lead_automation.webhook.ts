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
    const normalizedNumber = recipientNumber.replace(/^\+/, "");

    const body = {
      message,
      media: [],
      numbers: normalizedNumber,
      device_token: deviceToken,
      schedule: null,
    };

    console.log("Sending message with body:", body);
    const response = await axios.post(WAPMONKEY_API, body, {
      headers: {
        Authorization: API_KEY,
        "Content-Type": "application/json",
      },
      validateStatus: () => true,
    });

    

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

// ---------------------------------------------------
// 🔹 LABEL-BASED AUTOMATION — triggered after external lead creation
// ---------------------------------------------------
const _triggerLabelAutomationWebhook = async (
  lead: any,
  labelId: any
) => {
  try {
    console.log(
      `🚀 Triggering label automation for lead: ${lead._id}, label: ${labelId}`
    );

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
      r.label_id?.equals(labelId)
    );

    if (!rule) {
      console.log(
        `⚠️ No automation rule found for label ${labelId} — skipping.`
      );
      return;
    }

    if (!lead.assigned_to) {
      console.log(
        "⚠️ No agent assigned to this lead — cannot trigger label automation."
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
    if (!template) {
      console.log("⚠️ WhatsApp template not found for this automation rule.");
      return;
    }

    // Resolve variable map from template meta
    let variableMap: Record<string, string> = {};
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

    const normalizedNumber = recipientNumber.replace(/^\+/, "");

    // ✅ CHANGED: updated body and request config to match WapMonkey API docs
    const data = JSON.stringify({
      message,
      media: [],
      delay: "0",
      schedule: null,
      numbers: normalizedNumber,
      device_token: deviceToken,
    });

    const config = {
      method: "post",
      maxBodyLength: Infinity,
      url: WAPMONKEY_API,
      headers: {
        Authorization: API_KEY,
        "Content-Type": "application/json",
      },
      data,
      validateStatus: () => true,
    };

    console.log("Sending label automation message:", JSON.parse(data));
    const response = await axios.request(config);
    console.log("wapmonkey response", response);

    if (response.status === 200 && response.data?.status === 1) {
      console.log(
        `✅ Label automation message sent to ${recipientNumber} via ${agent.name}'s device.`
      );
    } else {
      console.warn(
        `⚠️ Label automation message may have failed. Status: ${response.status}`,
        response.data
      );
    }
  } catch (error: any) {
    console.error(
      "❌ Error in _triggerLabelAutomationWebhook:",
      error?.message ?? error
    );
  }
};

export { _triggerLeadAutomationWebhook, _triggerLabelAutomationWebhook };
