import { Request, Response } from "express";
import axios from "axios";
import qs from "querystring";
import { _getLeadsFromForm, _getUserPages } from "../services/facebook.service";

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

export {
  facebookLogin,
  facebookCallback,
  subscribePageLeadWebhook,
  fetchLeads,
};
