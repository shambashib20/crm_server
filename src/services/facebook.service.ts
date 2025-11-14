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
import Role from "../models/role.model";
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

        // 🔹 Build formatted comment string
        let commentLines: string[] = [];
        commentLines.push(`label::${targetLabel.title}`);

        for (const field of fbLead.field_data) {
          commentLines.push(`${field.name}::${field.values[0]}`);
        }

        const formattedComment = commentLines.join("\n");

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

        // ✅ ROUND-ROBIN LOGIC (EXACTLY from _createLeadService)
        let assignedToId: Types.ObjectId | null = null;

        const label = await Label.findById(matchedLabel._id);

        if (label) {
          if (!label.meta) {
            label.meta = {};
          }

          const assignedAgents = (label.meta.assigned_agents || []) as {
            agent_id: Types.ObjectId;
            assigned_at: Date;
          }[];

          if (assignedAgents.length > 0) {
            const lastIndex =
              (label.meta.last_assigned_index as number | undefined) ?? -1;
            const nextIndex = (lastIndex + 1) % assignedAgents.length;

            assignedToId = assignedAgents[nextIndex].agent_id;

            label.meta.last_assigned_index = nextIndex;
            label.markModified("meta");
            await label.save();
          }
        }

        // ✅ Fallback: Superadmin (same as _createLeadService)
        if (!assignedToId) {
          const superAdminRole = await Role.findOne({ name: "Superadmin" });
          if (!superAdminRole) {
            throw new Error("Superadmin role not found in this property!");
          }

          const superAdminUser = await User.findOne({
            property_id: integration?.property_id,
            role: superAdminRole._id,
          });

          if (!superAdminUser) {
            throw new Error("No Superadmin user found in this property!");
          }

          assignedToId = superAdminUser._id;
        }

        // ✅ Create the Lead with correct assigned_to
        await Lead.create({
          name: fields.full_name || fields.name,
          phone_number: fields.phone_number,
          email: fields.email,
          comment: formattedComment,
          reference: "From Facebook",
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
          assigned_to: assignedToId,
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
  if (!token) throw new Error("Facebook access token is missing.");

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
  if (!label) throw new Error(`Label "${labelTitle}" not found.`);

  // ---------------------------
  // 🚀 FETCH ALL LEADS WITH PAGINATION
  // ---------------------------
  let allLeads: any[] = [];
  let nextUrl:
    | string
    | null = `${GRAPH_API_BASE}/${formId}/leads?access_token=${token}&limit=200`;

  while (nextUrl) {
    const res = await axios.get(nextUrl);

    if (res.data?.data?.length) {
      allLeads.push(...res.data.data);
    }

    nextUrl = res.data?.paging?.next ?? null;
  }

  console.log("Total leads fetched:", allLeads.length);

  // ---------------------------
  // 🚀 PREPARE BULK INSERT DATA
  // ---------------------------

  const defaultStatus = await Status.findOne({ title: "New" });
  if (!defaultStatus) throw new Error("Default lead status not found.");

  const source = await Source.findOne({ title: "Facebook" });
  if (!source) throw new Error("Source not found.");

  // Fetch already existing FB lead IDs once (speed up)
  const existingDocs = await Lead.find(
    { "meta.fb_lead_id": { $in: allLeads.map((l) => l.id) } },
    { "meta.fb_lead_id": 1 }
  );

  const existingIds = new Set(
    existingDocs
      .map((doc) => doc.meta?.fb_lead_id)
      .filter((id) => id !== undefined)
  );

  const docsToInsert: any[] = [];

  for (const fbLead of allLeads) {
    if (existingIds.has(fbLead.id)) continue;

    const fields = fbLead.field_data.reduce((acc: any, field: any) => {
      acc[field.name] = field.values[0];
      return acc;
    }, {});

    const commentLines = [`label::${label.title}`];
    for (const field of fbLead.field_data) {
      commentLines.push(`${field.name}::${field.values[0]}`);
    }
    const formattedComment = commentLines.join("\n");

    docsToInsert.push({
      name: fields.full_name || fields.name,
      phone_number: fields.phone_number,
      email: fields.email,
      comment: formattedComment,
      labels: [label._id],
      status: defaultStatus._id,
      meta: {
        fb_lead_id: fbLead.id,
        form_id: formId,
        source,
        rayId: `ray-id-${uuidv4()}`,
      },
      logs: [
        {
          title: "Lead created",
          description: `Lead created by ${
            user?.name || "Unknown"
          } with status ${defaultStatus.title}`,
          status: LeadLogStatus.INFO,
        },
      ],
      assigned_to: userId,
      property_id: user?.property_id,
    });
  }

  // ---------------------------
  // 🚀 BULK INSERT
  // ---------------------------

  let insertedCount = 0;
  if (docsToInsert.length > 0) {
    await Lead.insertMany(docsToInsert, { ordered: false });
    insertedCount = docsToInsert.length;
  }

  return {
    form: formDetails.name,
    imported: insertedCount,
    label: label.title,
  };
};



export {
  _getUserPages,
  _getLeadsFromForm,
  _masterLeadService,
  _importLeadsByFormId,
};
