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
import Property from "../models/property.model";
const FB_AUTH_URL = "https://www.facebook.com/v21.0/dialog/oauth";
const FB_TOKEN_URL = "https://graph.facebook.com/v21.0/oauth/access_token";
const escapeStringRegexp = (s: string) =>
  s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const APP_ID = process.env.FB_APP_ID!;
const APP_SECRET = process.env.FB_APP_SECRET!;
const REDIRECT_URI = process.env.FB_REDIRECT_URI!;

let ACCESS_TOKEN: string = "";

const GRAPH_API_VERSION = "v22.0";
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

const fetchAllPaged = async (url: string, params: any = {}) => {
  const results: any[] = [];
  let nextUrl: string | null = url;
  let nextParams = { ...params };

  console.log("Fetching paged data from:", url);
  while (nextUrl) {
    const res = await axios.get(nextUrl, { params: nextParams });
    if (!res?.data) break;

    if (Array.isArray(res.data.data)) results.push(...res.data.data);

    const pagingNext = res.data.paging?.next;
    if (pagingNext) {
      nextUrl = pagingNext;
      nextParams = {}; // Use full URL (FB auto includes limit)
    } else {
      nextUrl = null;
    }
  }

  return results;
};

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
  const userAccessToken =
    facebookMeta?.token || facebookMeta?.page_token || facebookMeta?.token;

  if (!userAccessToken) {
    throw new Error(
      "Facebook is not connected. Please link your account first."
    );
  }

  const targetLabel = await Label.findById(labelId);
  console.log("Target Label:", targetLabel?.title);
  if (!targetLabel) throw new Error("Provided label not found");

  const pagesRes = await axios.get(`${GRAPH_API_BASE}/me/accounts`, {
    params: { access_token: userAccessToken },
  });

  const pages = pagesRes.data?.data || [];
  const summary: any[] = [];

  for (const page of pages) {
    try {
      const pageAccessToken =
        page.access_token || page.page_token || userAccessToken;

      if (!pageAccessToken) {
        console.warn(`No page token for page ${page.id} - skipping`);
        continue;
      }

      // -----------------------------
      // 4) Fetch Forms
      // -----------------------------
      const forms = await fetchAllPaged(
        `${GRAPH_API_BASE}/${page.id}/leadgen_forms`,
        { access_token: pageAccessToken }
      );

      // -----------------------------
      // Loop Forms
      // -----------------------------
      for (const form of forms) {
        try {
          if (form.status && form.status !== "ACTIVE") continue;

          // Fetch form details
          const formDetailsRes = await axios.get(
            `${GRAPH_API_BASE}/${form.id}`,
            {
              params: {
                access_token: pageAccessToken,
                fields: "id,name,status,tracking_parameters",
              },
            }
          );

          const formDetails = formDetailsRes.data;
          // console.log(
          //   `Form details fetched: ${formDetails.id} - ${formDetails.name}`
          // );

          const trackingParams = Array.isArray(formDetails.tracking_parameters)
            ? formDetails.tracking_parameters
            : [];

          // -----------------------------
          // 5) Match Label
          // -----------------------------
          const targetTitle = targetLabel.title.trim().toLowerCase();
          let matchedLabel: any = null;

          for (const param of trackingParams) {
            if (!param?.key) continue;

            const key = param.key.trim().toLowerCase();
            if (key !== "label" && key !== "labels") continue;

            const paramValue = (param.value || "").trim().toLowerCase();
            if (!paramValue) continue;

            if (
              targetTitle === paramValue ||
              targetTitle.includes(paramValue) ||
              paramValue.includes(targetTitle)
            ) {
              matchedLabel = targetLabel;
              break;
            }
          }

          if (!matchedLabel) {
            console.log(
              `No tracking label match for form ${form.id} (${form.name})`
            );

            continue;
          }

          // console.log(
          //   `Matched form ${formDetails.id} -> label ${targetLabel.title}`
          // );

          // -----------------------------
          // 6) Fetch Leads (limit 200)
          // -----------------------------
          const leads = await fetchAllPaged(
            `${GRAPH_API_BASE}/${form.id}/leads`,
            {
              access_token: pageAccessToken,
              limit: 200,
            }
          );

          if (!Array.isArray(leads) || leads.length === 0) {
            console.log(`No leads returned for form ${form.id}`);
            throw new Error(`No leads found for form ${form.id}`);
          }

          // -----------------------------
          // Prepare default status
          // -----------------------------
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

          // -----------------------------
          // Prepare Source
          // -----------------------------
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

          // -----------------------------
          // ROUND-ROBIN PREP
          // -----------------------------
          const labelRecord = await Label.findById(matchedLabel._id);

          let assignedAgents: {
            agent_id: Types.ObjectId;
            assigned_at: Date;
          }[] = [];
          let lastIndex = -1;

          if (labelRecord) {
            labelRecord.meta = labelRecord.meta || {};
            assignedAgents = labelRecord.meta.assigned_agents || [];
            lastIndex = (labelRecord.meta.last_assigned_index ?? -1) as number;
          }

          // Prepare fallback superadmin
          let superAdminUser: { _id?: Types.ObjectId } | null = null;
          if (assignedAgents.length === 0) {
            const superAdminRole = await Role.findOne({ name: "Superadmin" });
            superAdminUser = await User.findOne({
              property_id: integration?.property_id,
              role: superAdminRole?._id,
            });
          }

          // -----------------------------
          // 7) BUILD BULK INSERT ARRAY
          // -----------------------------
          const toInsert: any[] = [];

          for (const fbLead of leads) {
            try {
              if (!fbLead?.id) continue;

              const exists = await Lead.exists({
                "meta.fb_lead_id": fbLead.id,
              });
              if (exists) continue;

              const fbFields = (fbLead.field_data || []).reduce(
                (acc: any, f: any) => {
                  acc[f.name] = Array.isArray(f.values)
                    ? f.values[0]
                    : f.values;
                  return acc;
                },
                {}
              );

              // -----------------------------
              // FIXED ROUND-ROBIN ASSIGNMENT
              // -----------------------------
              let assignedToId: Types.ObjectId | null = null;

              if (assignedAgents.length > 0) {
                lastIndex = (lastIndex + 1) % assignedAgents.length;
                assignedToId = assignedAgents[lastIndex].agent_id;
              } else {
                assignedToId = superAdminUser?._id || null;
              }

              
              const commentLines = [`label::${targetLabel.title}`];
              for (const f of fbLead.field_data || []) {
                commentLines.push(
                  `${f.name}::${
                    Array.isArray(f.values) ? f.values[0] : f.values
                  }`
                );
              }

              
              toInsert.push({
                name:
                  fbFields.full_name ||
                  fbFields.name ||
                  fbFields.fullName ||
                  "",
                phone_number:
                  fbFields.phone_number ||
                  fbFields.mobile ||
                  fbFields.phone ||
                  "",
                email: fbFields.email || "",
                comment: commentLines.join("\n"),
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
                    } and assigned status ${defaultStatus.title}`,
                    status: LeadLogStatus.INFO,
                  },
                ],
                assigned_to: assignedToId,
                property_id: integration?.property_id,
              });
            } catch (err: any) {
              console.error(
                `Error building payload for fbLead ${fbLead.id}:`,
                err.message
              );
              continue;
            }
          }

          // -----------------------------
          // 8) BULK INSERT
          // -----------------------------
          if (toInsert.length > 0) {
            await Lead.insertMany(toInsert, { ordered: false });
            console.log(
              `Inserted ${toInsert.length} leads for form ${form.id}`
            );
          }

          
          if (labelRecord && assignedAgents.length > 0) {
            labelRecord.meta = labelRecord.meta || {};
            labelRecord.meta.last_assigned_index = lastIndex;
            labelRecord.markModified("meta");
            await labelRecord.save();
            console.log(
              `Updated last_assigned_index for label ${labelRecord.title} -> ${lastIndex}`
            );
          }

          await Property.findByIdAndUpdate(targetLabel?.property_id, {
            $push: {
              logs: {
                title: "Facebook Lead Import",
                description: `Imported ${toInsert.length} new leads from Facebook form "${formDetails.name}" using label "${targetLabel.title}".`,
                status: "SUCCESS",
                meta: {                  
                  label: targetLabel.title,
                  imported_count: toInsert.length,
                  timestamp: new Date(),
                },
              },
            },
          });

          summary.push({
            page: page.name,
            form: form.name,
            leads: leads.length || 0,
          });
        } catch (formErr) {
          console.error(`Error processing form ${form?.id}:`, formErr);
          continue;
        }
      }
    } catch (pageErr) {
      console.error(`Error processing page ${page?.id}:`, pageErr);
      continue;
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
        status: "ACTIVE",
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

  let insertedCount = 0;
  if (docsToInsert.length > 0) {
    await Lead.insertMany(docsToInsert, { ordered: false });
    insertedCount = docsToInsert.length;

    await Property.findByIdAndUpdate(user?.property_id, {
      $push: {
        logs: {
          title: "Facebook Lead Import",
          description: `Imported ${insertedCount} new leads from Facebook form "${formDetails.name}" using label "${label.title}".`,
          status: "SUCCESS",
          meta: {
            form_id: formId,
            label: label.title,
            imported_count: insertedCount,
            timestamp: new Date(),
          },
        },
      },
    });
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




