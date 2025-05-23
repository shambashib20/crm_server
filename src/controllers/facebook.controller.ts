import { Request, Response } from "express";
import axios from "axios";
import qs from "querystring";
import { _getLeadsFromForm, _getUserPages } from "../services/facebook.service";
import Label from "../models/label.model";
import Lead from "../models/lead.model";

const FB_AUTH_URL = "https://www.facebook.com/v21.0/dialog/oauth";
const FB_TOKEN_URL = "https://graph.facebook.com/v21.0/oauth/access_token";

const APP_ID = process.env.FB_APP_ID!;
const APP_SECRET = process.env.FB_APP_SECRET!;
const REDIRECT_URI = process.env.FB_REDIRECT_URI!;

let ACCESS_TOKEN: string = "";

const facebookLogin = (req: any, res: any) => {
  const authUrl = `${FB_AUTH_URL}?client_id=${APP_ID}&redirect_uri=${REDIRECT_URI}&scope=pages_show_list,pages_read_engagement,leads_retrieval`;
  return res.json({ login_url: authUrl });
};

const facebookCallback = async (req: any, res: any) => {
  const code = req.query.code as string;

  try {
    const tokenRes = await axios.get(
      `${FB_TOKEN_URL}?${qs.stringify({
        client_id: APP_ID,
        redirect_uri: REDIRECT_URI,
        client_secret: APP_SECRET,
        code,
      })}`
    );

    ACCESS_TOKEN = tokenRes.data.access_token;
    console.log("✅ Access Token Received:", ACCESS_TOKEN);

    const pages = await _getUserPages(ACCESS_TOKEN);
    return res.json({
      message: "Authentication successful",
      accessToken: ACCESS_TOKEN,
      pages,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Facebook login failed" });
  }
};

const subscribePageLeadWebhook = async (req: any, res: any) => {
  const pageId = req.params.pageId;
  const { pageAccessToken } = req.body;

  if (!pageAccessToken) {
    return res.status(400).json({ message: "Missing page access token" });
  }

  try {
    const response = await axios.post(
      `https://graph.facebook.com/v21.0/${pageId}/subscribed_apps`,
      {},
      {
        params: {
          access_token: pageAccessToken,
          subscribed_fields: "leadgen",
        },
      }
    );

    res.json({
      message: "Page subscribed to leadgen webhook",
      data: response.data,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error subscribing to page", error: err });
  }
};

const fetchLeads = async (req: Request, res: Response) => {
  const formId = req.params.formId;
  const { pageAccessToken } = req.body;
  try {
    const leads = await _getLeadsFromForm(formId, pageAccessToken);
    res.json({ leads });
  } catch (err: any) {
    console.error(err.message);
    res.status(500).json({ message: err.message, error: err.message });
  }
};

const connectFacebookLeads = async (req: any, res: any) => {
  const code = req.query.code as string;

  try {
    const tokenRes = await axios.get(
      `${FB_TOKEN_URL}?${qs.stringify({
        client_id: APP_ID,
        redirect_uri: REDIRECT_URI,
        client_secret: APP_SECRET,
        code,
      })}`
    );
    const accessToken = tokenRes.data.access_token;

    // Step 2: Fetch user's pages
    const pages = await _getUserPages(accessToken);

    const summary: any = [];

    for (const page of pages) {
      const pageAccessToken = page.access_token;

      // Step 3: Fetch all forms for the page
      const formsRes = await axios.get(
        `https://graph.facebook.com/v21.0/${page.id}/leadgen_forms`,
        {
          params: { access_token: pageAccessToken },
        }
      );

      for (const form of formsRes.data.data) {
        // Step 4: Match Facebook form tracking parameters with labels in your DB
        const { tracking_parameters } = form;

        const label = await Label.findOne({
          fb_tracking_parameter: tracking_parameters,
        });

        if (label) {
          const leads = await _getLeadsFromForm(form.id, pageAccessToken);

          for (const fbLead of leads) {
            const fields = fbLead.field_data.reduce((acc: any, field: any) => {
              acc[field.name] = field.values[0];
              return acc;
            }, {});

            await Lead.create({
              name: fields.full_name || fields.name,
              phone_number: fields.phone_number,
              email: fields.email,
              comment: "Imported from Facebook",
              labels: [label._id],
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
        }
      }
    }

    return res.json({
      message: "Facebook connected and leads imported",
      summary,
    });
  } catch (err: any) {
    console.error("Facebook connect error:", err);
    return res
      .status(500)
      .json({ message: "Facebook connection failed", error: err.message });
  }
};

export {
  facebookLogin,
  facebookCallback,
  subscribePageLeadWebhook,
  fetchLeads,
  connectFacebookLeads,
};
