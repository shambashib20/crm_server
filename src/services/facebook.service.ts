import qs from "querystring";
import axios from "axios";
import Status from "../models/status.model";
import Label from "../models/label.model";
import Lead from "../models/lead.model";

const FB_AUTH_URL = "https://www.facebook.com/v21.0/dialog/oauth";
const FB_TOKEN_URL = "https://graph.facebook.com/v21.0/oauth/access_token";

const APP_ID = process.env.FB_APP_ID!;
const APP_SECRET = process.env.FB_APP_SECRET!;
const REDIRECT_URI = process.env.FB_REDIRECT_URI!;

let ACCESS_TOKEN: string = "";

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

const _masterLeadService = async (code: string) => {
  const tokenRes = await axios.get(
    `${FB_TOKEN_URL}?${qs.stringify({
      client_id: APP_ID,
      redirect_uri: REDIRECT_URI,
      client_secret: APP_SECRET,
      code,
    })}`
  );
  const accessToken = tokenRes.data.access_token;

  const pages = await _getUserPages(accessToken);

  const summary: any = [];

  for (const page of pages) {
    const pageAccessToken = page.access_token;

    const formsRes = await axios.get(
      `https://graph.facebook.com/v22.0/${page.id}/leadgen_forms`,
      {
        params: { access_token: pageAccessToken },
      }
    );

    for (const form of formsRes.data.data) {
      if (form.status === "ACTIVE") {
        const formDetailsRes = await axios.get(
          `https://graph.facebook.com/v22.0/${form.id}`,
          {
            params: {
              access_token: pageAccessToken,
              fields: "id,name,status,tracking_parameters",
            },
          }
        );

        const formDetails = formDetailsRes.data;
        let matchedLabel: (typeof Label.prototype & { _id: any }) | null = null;

        if (Array.isArray(formDetails.tracking_parameters)) {
          for (const param of formDetails.tracking_parameters) {
            if (param.key === "label") {
              matchedLabel = await Label.findOne({
                title: new RegExp(`^${param.value.trim()}$`, "i"),
              });
              if (matchedLabel) break;
            }
          }
        }

        if (matchedLabel) {
          const leads = await _getLeadsFromForm(form.id, pageAccessToken);

          for (const fbLead of leads) {
            const fields = fbLead.field_data.reduce((acc: any, field: any) => {
              acc[field.name] = field.values[0];
              return acc;
            }, {});

            const defaultStatus = await Status.findOne({ title: "New" });
            if (!defaultStatus) {
              console.warn(
                `Status with title "New" not found. Skipping lead import for form ${form.id}.`
              );
              continue;
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
              },
            });
          }

          summary.push({
            page: page.name,
            form: form.name,
            leads: leads.length,
          });
        } else {
          console.log(
            `No matching label found for form ${form.id} with tracking parameters:`,
            formDetails.tracking_parameters
          );
        }
      } else {
        throw new Error("Something wrong happened!");
      }
    }
  }
};






export { _getUserPages, _getLeadsFromForm, _masterLeadService };
