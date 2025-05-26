import qs from "querystring";
import axios from "axios";
import Status from "../models/status.model";
import Label from "../models/label.model";
import Lead from "../models/lead.model";
import User from "../models/user.model";
import { LabelDto } from "../dtos/label.dto";
import { Types } from "mongoose";
import { LeadLogStatus } from "../dtos/lead.dto";

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

const _masterLeadService = async (userId: Types.ObjectId, fbCode?: string) => {
  const integration = await User.findOne({ _id: userId });
  console.log(integration, "user");
  let userAccessToken = integration?.meta?.facebook?.userAccessToken;

  if (!userAccessToken && fbCode) {
    const tokenRes = await axios.get(`${GRAPH_API_BASE}/oauth/access_token`, {
      params: {
        client_id: APP_ID,
        client_secret: APP_SECRET,
        redirect_uri: REDIRECT_URI,
        code: fbCode,
      },
    });

    const shortLived = tokenRes.data.access_token;

    const longLivedRes = await axios.get(
      `${GRAPH_API_BASE}/oauth/access_token`,
      {
        params: {
          grant_type: "fb_exchange_token",
          client_id: APP_ID,
          client_secret: APP_SECRET,
          fb_exchange_token: shortLived,
        },
      }
    );

    userAccessToken = longLivedRes.data.access_token;

    await User.updateOne(
      { userId },
      {
        $set: {
          "meta.facebook.userAccessToken": userAccessToken,
        },
      }
    );
  }

  if (!userAccessToken) {
    throw new Error(
      "Facebook is not connected. Please login and provide ?code=..."
    );
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
            matchedLabel = await Label.findOne({
              title: new RegExp(`^${param.value.trim()}$`, "i"),
            });
            if (matchedLabel) break;
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

        const defaultStatus = await Status.findOne({ title: "New" });
        if (!defaultStatus) continue;

        const existingLead = await Lead.findOne({
          "meta.fb_lead_id": fbLead.id,
        });
        if (existingLead) continue;

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
export { _getUserPages, _getLeadsFromForm, _masterLeadService };
