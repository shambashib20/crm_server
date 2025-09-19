import { Request, Response } from "express";
import axios from "axios";
import qs from "querystring";
import {
  _getLeadsFromForm,
  _getUserPages,
  _importLeadsByFormId,
  _masterLeadService,
} from "../services/facebook.service";
import Label from "../models/label.model";
import Lead from "../models/lead.model";
import Status from "../models/status.model";
import SuccessResponse from "../middlewares/success.middleware";
import { Types } from "mongoose";
import User from "../models/user.model";

const FB_AUTH_URL = "https://www.facebook.com/v21.0/dialog/oauth";
const FB_TOKEN_URL = "https://graph.facebook.com/v21.0/oauth/access_token";

const APP_ID = process.env.FB_APP_ID!;
const APP_SECRET = process.env.FB_APP_SECRET!;
const REDIRECT_URI = process.env.FB_REDIRECT_URI!;

let ACCESS_TOKEN: string = "";

const facebookLogin = (req: any, res: any) => {
  const user_id = req.user._id;

  const authUrl = `${FB_AUTH_URL}?client_id=${APP_ID}&redirect_uri=${REDIRECT_URI}&state=${user_id}${user_id}&scope=pages_show_list,pages_read_engagement,leads_retrieval`;
  return res.json({ login_url: authUrl });
};

// const facebookCallback = async (req: any, res: any) => {
//   const code = req.query.code as string;

//   try {
//     const tokenRes = await axios.get(
//       `${FB_TOKEN_URL}?${qs.stringify({
//         client_id: APP_ID,
//         redirect_uri: REDIRECT_URI,
//         client_secret: APP_SECRET,
//         code,
//       })}`
//     );

//     ACCESS_TOKEN = tokenRes.data.access_token;
//     console.log("✅ Access Token Received:", ACCESS_TOKEN);

//     const pages = await _getUserPages(ACCESS_TOKEN);
//     return res.json({
//       message: "Authentication successful",
//       accessToken: ACCESS_TOKEN,
//       pages,
//     });
//   } catch (err) {
//     console.error(err);
//     return res.status(500).json({ message: "Facebook login failed" });
//   }
// };

const facebookCallback = async (req: any, res: any) => {
  const { code, state } = req.query;

  if (!code || !state) {
    return res.status(400).json({ error: "Missing code or user ID" });
  }

  const user_id = state.toString().slice(0, 24);

  const redirectUri = process.env.FB_REDIRECT_URI;
  const appId = process.env.FB_APP_ID;
  const appSecret = process.env.FB_APP_SECRET;

  try {
    const tokenRes = await axios.get(
      `https://graph.facebook.com/v18.0/oauth/access_token`,
      {
        params: {
          client_id: appId,
          client_secret: appSecret,
          redirect_uri: redirectUri,
          code,
        },
      }
    );

    const accessToken = tokenRes.data.access_token;

    // Get user FB profile
    const profileRes = await axios.get(
      `https://graph.facebook.com/v18.0/me?fields=id,name,email`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const fbProfile = profileRes.data;

    const pagesRes = await axios.get(
      `https://graph.facebook.com/v18.0/me/accounts?fields=id,name,access_token`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const pages = pagesRes.data.data;

    if (!pages.length) {
      return res
        .status(400)
        .json({ error: "No pages found for this Facebook account" });
    }
    const firstPage = pages[0];
    const pageId = firstPage.id;
    const pageAccessToken = firstPage.access_token;

    const formsRes = await axios.get(
      `https://graph.facebook.com/v18.0/${pageId}/leadgen_forms?fields=id,name`,
      {
        headers: {
          Authorization: `Bearer ${pageAccessToken}`,
        },
      }
    );

    const forms = formsRes.data.data;
    const formId = forms.length > 0 ? forms[0].id : null;

    const updatedUser = await User.findByIdAndUpdate(user_id, {
      $set: {
        "meta.facebook.token": accessToken,
        "meta.facebook.id": fbProfile.id,
        "meta.facebook.name": fbProfile.name,
        "meta.facebook.email": fbProfile.email || "",
        "meta.facebook.code": code,
        "meta.facebook.page_id": pageId,
        "meta.facebook.page_name": firstPage.name,
        "meta.facebook.page_token": pageAccessToken,
        "meta.facebook.form_id": formId,
      },
    });

    res.send(`
  <script>
    localStorage.setItem('fb_integration_success', 'true');
    window.close();
  </script>
`);

    return res.json({
      success: true,
      message: "Facebook account linked successfully",
      // updatedUser,
    });
  } catch (error: any) {
    console.error("Facebook Callback Error:", error.response?.data || error);
    return res.status(500).json({ error: "Facebook authentication failed" });
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
  const userId = req.user._id;
  const { labelId } = req.query;
  try {
    const result = await _masterLeadService(userId, labelId);

    return res
      .status(201)
      .json(new SuccessResponse("Leads fetched successfully!", 201, result));
  } catch (err: any) {
    return res.status(500).json(new SuccessResponse(err.message, 500));
  }
};

const importFormLeadsManually = async (req: any, res: any) => {
  const { formId, labelTitle } = req.body;
  const userId = req.user._id;

  try {
    const result = await _importLeadsByFormId(formId, labelTitle, userId);
    return res
      .status(200)
      .json(new SuccessResponse("Leads imported.", 200, result));
  } catch (error: any) {
    console.error("Import Error:", error.message);
    return res.status(500).json({ error: error.message });
  }
};

export {
  facebookLogin,
  facebookCallback,
  subscribePageLeadWebhook,
  fetchLeads,
  connectFacebookLeads,
  importFormLeadsManually,
};
