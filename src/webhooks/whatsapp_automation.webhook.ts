import axios from "axios";
import Automation from "../models/automation.model";
import { AutomationType, LeadType } from "../dtos/automation.dto";
import CampaignTemplate from "../models/campaign.model";
import User from "../models/user.model";
import { parseTemplate } from "../utils/template.util";

const WAPMONKEY_SEND_URL = process.env.WAPMONKEY_WHATSAPP_URL!;

const _triggerWhatsAppAutomation = async (lead: any) => {
  try {
    console.log("📲 Checking WhatsApp automations for this lead…");

    // prevent double fire
    if (lead.meta?.whatsapp_first_message_sent) {
      console.log("⚠️ WhatsApp automation already fired.");
      return;
    }

    const propertyId = lead.property_id;

    const automation = await Automation.findOne({
      type: AutomationType.LEAD_AUTOMATION,
      lead_type: LeadType.FIRST_MESSAGE,
      property_id: propertyId,
      "meta.is_active": true,
    });

    if (!automation) return;

    const rule = automation.rules.find(
      (r: any) =>
        String(r.status_id) === String(lead.status) &&
        String(r.label_id) === String(lead.labels?.[0])
    );

    if (!rule) return;

    // Fetch template
    const template = await CampaignTemplate.findById(rule.template_id).lean();
    if (!template) return;

    // Load telecaller
    const agent = await User.findById(lead.assigned_to);
    if (!agent) return;

    const waDevice = agent.meta?.whatsapp_device;
    if (!waDevice?.u_device_token) return;

    const rawTopMeta =
      template.meta instanceof Map
        ? Object.fromEntries(template.meta)
        : template.meta || {};

    let variableMap: Record<string, string> = {};

    const vm = rawTopMeta.variable_map;

    if (vm instanceof Map) {
      variableMap = Object.fromEntries(vm);
    } else if (typeof vm === "object" && vm !== null) {
      variableMap = { ...vm };
    } else {
      variableMap = {};
    }

    const finalTemplate = {
      message: template.message ?? "",
      meta: {
        variable_map: variableMap,
      },
    };

    const message = parseTemplate(finalTemplate, {
      customerName: lead.name || "",
      customerNumber: lead.phone_number || "",
      customerEmail: lead.email || "",
    });

    const body = {
      message,
      media: [],
      numbers: lead.phone_number,
      device_token: waDevice.u_device_token,
    };

    console.log("📤 Sending WhatsApp message…", body);

    const sendRes = await axios.post(WAPMONKEY_SEND_URL, body);
    console.log("📩 WhatsApp send response:", sendRes.data);

    // mark as fired
    lead.meta.whatsapp_first_message_sent = true;
    lead.markModified("meta");

    lead.logs.push({
      title: "WhatsApp Sent",
      description: `Sent WhatsApp message via ${agent.name}`,
      status: "INFO",
      createdAt: new Date(),
    });

    await lead.save();
  } catch (err: any) {
    console.error("❌ WhatsApp automation error:", err.message);
  }
};

export { _triggerWhatsAppAutomation };
