import qs from "querystring";
import axios from "axios";
import Status from "../models/status.model";
import Label from "../models/label.model";
import Lead from "../models/lead.model";
import User from "../models/user.model";
import { LabelDto } from "../dtos/label.dto";
import { Types } from "mongoose";
import { LeadLogStatus } from "../dtos/lead.dto";
import Source from "../models/source.model";
import { v4 as uuidv4 } from "uuid";
const FB_AUTH_URL = "https://www.facebook.com/v21.0/dialog/oauth";
const FB_TOKEN_URL = "https://graph.facebook.com/v21.0/oauth/access_token";

const APP_ID = process.env.FB_APP_ID!;
const APP_SECRET = process.env.FB_APP_SECRET!;
const REDIRECT_URI = process.env.FB_REDIRECT_URI!;

let ACCESS_TOKEN: string = "";

const GRAPH_API_VERSION = "v22.0";
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

const _getUserPages = async (accessToken: string) => {
  try {
    const response = await axios.get(
      "https://graph.facebook.com/v21.0/me/accounts",
      {
        params: {
          access_token: accessToken,
        },
      }
    );
    return response.data.data;
  } catch (err) {
    throw new Error("Failed to fetch pages");
  }
};

const _getLeadsFromForm = async (formId: string, accessToken: string) => {
  try {
    const response = await axios.get(
      `https://graph.facebook.com/v21.0/${formId}/leads`,
      {
        params: {
          access_token: accessToken,
        },
      }
    );
    return response.data.data;
  } catch (err: any) {
    console.error(err.message);
    throw new Error("Failed to fetch leads");
  }
};

const _masterLeadService = async (
  userId: Types.ObjectId,
  labelId: Types.ObjectId
) => {
  const integration = await User.findById(userId);

  const facebookMeta = integration?.meta?.get("facebook");
  const userAccessToken = facebookMeta?.token;

  if (!userAccessToken) {
    throw new Error(
      "Facebook is not connected. Please link your account first."
    );
  }

  const targetLabel = await Label.findById(labelId);
  if (!targetLabel) {
    throw new Error("Provided label not found");
  }

  const pagesRes = await axios.get(`${GRAPH_API_BASE}/me/accounts`, {
    params: { access_token: userAccessToken },
  });

  const pages = pagesRes.data.data;
  const summary: any[] = [];

  for (const page of pages) {
    const pageAccessToken = page.access_token;

    const formsRes = await axios.get(
      `${GRAPH_API_BASE}/${page.id}/leadgen_forms`,
      {
        params: { access_token: pageAccessToken },
      }
    );

    const forms = formsRes.data.data;

    for (const form of forms) {
      if (form.status !== "ACTIVE") continue;

      const formDetailsRes = await axios.get(`${GRAPH_API_BASE}/${form.id}`, {
        params: {
          access_token: pageAccessToken,
          fields: "id,name,status,tracking_parameters",
        },
      });

      const formDetails = formDetailsRes.data;
      let matchedLabel: (LabelDto & { _id: any }) | null = null;

      if (Array.isArray(formDetails.tracking_parameters)) {
        for (const param of formDetails.tracking_parameters) {
          if (param.key === "labels") {
            
            if (
              targetLabel &&
              new RegExp(`^${param.value.trim()}$`, "i").test(targetLabel.title)
            ) {
              matchedLabel = targetLabel as any;
              break;
            }
          }
        }
      }

      if (!matchedLabel) continue;

      const leadsRes = await axios.get(`${GRAPH_API_BASE}/${form.id}/leads`, {
        params: { access_token: pageAccessToken },
      });

      const leads = leadsRes.data.data;

      for (const fbLead of leads) {
        const fields = fbLead.field_data.reduce((acc: any, field: any) => {
          acc[field.name] = field.values[0];
          return acc;
        }, {});

        let defaultStatus = await Status.findOne({
          title: "New",
          property_id: integration?.property_id,
        });

        if (!defaultStatus) {
          defaultStatus = new Status({
            title: "New",
            description: "Default status for new leads",
            property_id: integration?.property_id,
            meta: { is_active: true },
          });
          defaultStatus.markModified("meta");
          await defaultStatus.save();
        }

        const existingLead = await Lead.findOne({
          "meta.fb_lead_id": fbLead.id,
        });
        if (existingLead) continue;

        let source = await Source.findOne({
          title: "Facebook",
          property_id: integration?.property_id,
        });

        if (!source) {
          source = new Source({
            title: "Facebook",
            description: "Facebook Lead Ads",
            property_id: integration?.property_id,
            meta: { is_active: true, is_editable: false },
          });
          source.markModified("meta");
          await source.save();
        }

        await Lead.create({
          name: fields.full_name || fields.name,
          phone_number: fields.phone_number,
          email: fields.email,
          comment: "Imported from Facebook",
          labels: [matchedLabel._id],
          status: defaultStatus._id,
          meta: {
            fb_lead_id: fbLead.id,
            form_id: form.id,
            page_id: page.id,
            source: source._id,
          },
          logs: [
            {
              title: "Lead created",
              description: `Lead created by ${
                integration?.name || "Unknown"
              } and assigned the status of ${defaultStatus.title}`,
              status: LeadLogStatus.INFO,
            },
          ],
          assigned_to: integration?._id,
          property_id: integration?.property_id,
        });
      }

      summary.push({
        page: page.name,
        form: form.name,
        leads: leads.length,
      });
    }
  }

  return summary;
};

const _importLeadsByFormId = async (
  formId: string,
  labelTitle: string,
  userId: Types.ObjectId,
  pageAccessToken?: string
) => {
  const user = await User.findById(userId);
  const token = pageAccessToken || user?.meta?.get("facebook")?.token;
  if (!token) {
    throw new Error("Facebook access token is missing.");
  }
  const formDetailsRes = await axios.get(`${GRAPH_API_BASE}/${formId}`, {
    params: {
      access_token: token,
      fields: "id,name,status,tracking_parameters",
    },
  });
  const formDetails = formDetailsRes.data;
  const label = await Label.findOne({
    title: new RegExp(`^${labelTitle.trim()}$`, "i"),
  });

  if (!label) {
    throw new Error(`Label "${labelTitle}" not found.`);
  }

  const leadsRes = await axios.get(`${GRAPH_API_BASE}/${formId}/leads`, {
    params: { access_token: token },
  });

  const leads = leadsRes.data.data;
  const defaultStatus = await Status.findOne({ title: "New" });
  if (!defaultStatus) throw new Error("Default lead status not found.");

  const source = await Source.findOne({
    title: "Facebook",
  });

  if (!source) throw new Error("Source not found.");
  let importedCount = 0;

  for (const fbLead of leads) {
    const fields = fbLead.field_data.reduce((acc: any, field: any) => {
      acc[field.name] = field.values[0];
      return acc;
    }, {});

    const existing = await Lead.findOne({ "meta.fb_lead_id": fbLead.id });
    if (existing) continue;
    const ray_id = `ray-id-${uuidv4()}`;
    await Lead.create({
      name: fields.full_name || fields.name,
      phone_number: fields.phone_number,
      email: fields.email,
      comment: "Imported from Facebook (manual)",
      labels: [label._id],
      status: defaultStatus._id,
      meta: {
        fb_lead_id: fbLead.id,
        form_id: formId,
        source,
        rayId: ray_id,
      },
      logs: [
        {
          title: "Lead created",
          description: `Lead created by ${
            user?.name || "Unknown"
          } and assigned status ${defaultStatus.title}`,
          status: LeadLogStatus.INFO,
        },
      ],
      assigned_to: userId,
      property_id: user?.property_id,
    });

    importedCount++;
  }

  return {
    form: formDetails.name,
    imported: importedCount,
    label: label.title,
  };
};

export {
  _getUserPages,
  _getLeadsFromForm,
  _masterLeadService,
  _importLeadsByFormId,
};
