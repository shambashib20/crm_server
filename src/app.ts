import express, { Application } from "express";
import dotenv from "dotenv";
dotenv.config();
import axios from "axios";
import { v4 as uuidv4 } from "uuid";

import facebookRoutes from "./routes/facebook.routes";
import { connect, getDbStatus } from "../config/db.config";
import cors from "cors";
import { seedRolesAndPermissions } from "./seeders/role.permission.seeder";
import { seedDefaultProperty } from "./seeders/property.seeder";
import { seedSuperadminUser } from "./seeders/user.seeder";
import mainRouter from "./routes";
import cookieParser from "cookie-parser";
import { seedDefaultLeadStatuses } from "./seeders/status.seeder";
import { seedDefaultLabelStatuses } from "./seeders/label.seeder";
import Lead from "./models/lead.model";
import Source from "./models/source.model";
import Status from "./models/status.model";
import User from "./models/user.model";
import { getLocationFromIP } from "./utils/get_location.util";
import { LeadLogStatus } from "./dtos/lead.dto";
import Property from "./models/property.model";
import { LogStatus } from "./dtos/property.dto";
import { razorpayWebhookHandler } from "./webhooks/payment.webhook";

import "./cron-jobs/cron";
import Label from "./models/label.model";
import Role from "./models/role.model";
import { seedDefaultSources } from "./seeders/source.seeder";
import { seedFeaturesAndPackages } from "./seeders/pricingpackages.seeder";
import Package from "./models/package.model";
import { Types } from "mongoose";
const app: Application = express();
app.use(
  cors({
    origin: (origin, callback) => {
      callback(null, origin || "*");
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(cookieParser());
const PORT = process.env.PORT || 5000;

app.use((req, res, next) => {
  if (req.originalUrl === "/webhook/razorpay") return next();
  express.json()(req, res, next);
});
app.use("/api/facebook", facebookRoutes);
app.use("/api", mainRouter);
export enum MongoStatusEnums {
  CONNECTED = "Connected to mongodb",
  CONNECTION_ERROR = "Mongodb connection Error!",
}

app.post(
  "/webhook/razorpay",
  express.raw({ type: "application/json" }),
  razorpayWebhookHandler
);
app.get("/status", async (req: any, res: any) => {
  try {
    const dbStatus = await getDbStatus();

    res.status(200).json({
      status: 200,
      message: "Server and DB status fetched successfully!",
      data: {
        dbStatus,
      },
    });
  } catch (err) {
    console.error("Error in Server Status:", err);
    res
      .status(500)
      .json({ status: 500, message: "Error in fetching server status" });
  }
});

app.listen(PORT, async () => {
  console.log(`Server Started Listening at ${PORT}`);
  await connect();

  if (process.env.SEED_DB === "true") {
    try {
      console.log("🌱 Checking if seeding is necessary...");

      const packagesCount = await Package.countDocuments();
      if (packagesCount === 0) {
        console.log("🔨 Seeding pricing packages and features...");
        await seedFeaturesAndPackages();
      } else {
        console.log("ℹ️ Packages already exist. Skipping package seeder.");
      }

      // 1️⃣ Seed roles and permissions first
      const rolesCount = await Role.countDocuments();
      if (rolesCount === 0) {
        console.log("🔨 Seeding roles and permissions...");
        await seedRolesAndPermissions();
      } else {
        console.log("ℹ️ Roles already exist. Skipping role seeder.");
      }

      // 2️⃣ Now seed property
      const existingProperty = await Property.findOne({
        name: "MR Group of Colleges and Hospitals",
      });

      if (!existingProperty) {
        console.log("🔨 Seeding property...");
        await seedDefaultProperty();
      } else {
        console.log("ℹ️ Property already exists. Skipping property seeder.");
      }

      const finalProperty =
        existingProperty ||
        (await Property.findOne({
          name: "MR Group of Colleges and Hospitals",
        }));

      if (finalProperty) {
        const labelCount = await Label.countDocuments({
          property_id: finalProperty._id,
        });

        const statusCount = await Status.countDocuments({
          property_id: finalProperty._id,
        });

        const sourceCount = await Source.countDocuments({
          property_id: finalProperty._id,
        });

        if (sourceCount === 0) {
          console.log("🔨 Seeding sources...");
          await seedDefaultSources();
        } else {
          console.log("ℹ️ Sources already exist. Skipping source seeder.");
        }

        if (labelCount === 0) {
          console.log("🔨 Seeding labels...");
          await seedDefaultLabelStatuses();
        } else {
          console.log("ℹ️ Labels already exist. Skipping label seeder.");
        }

        if (statusCount === 0) {
          console.log("🔨 Seeding statuses...");
          await seedDefaultLeadStatuses();
        } else {
          console.log("ℹ️ Statuses already exist. Skipping status seeder.");
        }
      } else {
        console.error(
          "❌ Cannot proceed with label/status seeding: Property not found."
        );
      }

      // 3️⃣ Seed superadmin user last
      const superadmin = await User.findOne({
        property_id: finalProperty?._id,
      });

      if (!superadmin) {
        console.log("🔨 Seeding superadmin user...");
        await seedSuperadminUser();
      } else {
        console.log("ℹ️ Superadmin user already exists. Skipping seeder.");
      }

      console.log("✅ Seeder checks completed.");
    } catch (error) {
      console.error("❌ Error during seeding checks:", error);
    }
  }
});

// app.post("/lead/webhook", async (req: any, res: any) => {
//   try {
//     const users = await User.find({});

//     let superadmin: (typeof users)[0] | null = null;

//     for (const user of users) {
//       const meta = user.meta;

//       const fbMeta =
//         typeof meta?.get === "function"
//           ? meta?.get("facebook")
//           : meta?.facebook;

//       if (fbMeta?.token && fbMeta?.form_id) {
//         superadmin = user;
//         (superadmin.meta ??= {}).facebook = fbMeta;
//         break;
//       }
//     }

//     console.log(superadmin, "superadmin object");

//     if (!superadmin) {
//       return res.status(404).json({
//         message: "Superadmin with Facebook token and form ID not found",
//       });
//     }

//     const pageToken = superadmin?.meta?.facebook.page_token;
//     console.log("pageToken", pageToken);
//     const form_id = superadmin?.meta?.facebook.form_id;

//     const response = await axios.get(
//       `https://graph.facebook.com/v18.0/${form_id}/leads`,
//       {
//         params: {
//           access_token: pageToken,
//           fields: "created_time,field_data",
//         },
//       }
//     );

//     const leads = response.data.data;
//     console.log(`✅ Leads fetched from Facebook:`, leads);
//     const now = new Date();

//     const createdLeads: any[] = [];

//     for (const lead of leads) {
//       const exists = await Lead.findOne({ "meta.fb_lead_id": lead.id });
//       if (exists) continue;

//       const defaultSource = await Source.findOne({
//         title: "Facebook",
//       });
//       const defaultStatus = await Status.findOne({ title: "New" });

//       const ray_id = `ray-id-${uuidv4()}`;
//       const ip = req.ip || "::1";
//       const locationData = await getLocationFromIP(ip);

//       const leadDoc = await Lead.create({
//         name: lead.full_name || lead.name || "",
//         email: lead.email || "",
//         phone_number: lead.phone_number || "",
//         labels: [],
//         assigned_to: superadmin._id,
//         assigned_by: superadmin._id,
//         property_id: defaultStatus?.property_id,
//         status: defaultStatus?._id,
//         meta: {
//           fb_lead_id: lead.id,
//           ray_id,
//           source: defaultSource || "Facebook",
//           location: locationData,
//           created_by: superadmin._id,
//         },
//         logs: [
//           {
//             title: "Lead created",
//             description: `Lead fetched from Facebook and assigned status: ${defaultStatus?.title}`,
//             status: LeadLogStatus.ACTION,
//             meta: {},
//             createdAt: now,
//             updatedAt: now,
//           },
//         ],
//       });
//       createdLeads.push(leadDoc);

//       await Property.findByIdAndUpdate(
//         defaultStatus?.property_id,
//         {
//           $inc: { usage_count: 1 },
//           $push: {
//             logs: {
//               title: "Lead Assigned",
//               description: `A new lead named (${leadDoc.name}) was assigned to this property.`,
//               status: LogStatus.INFO,
//               meta: { leadId: leadDoc._id },
//               createdAt: now,
//               updatedAt: now,
//             },
//           },
//         },
//         { new: true }
//       );
//     }
//     console.log(`✅ Leads inserted into MongoDB:`, createdLeads);

//     res.status(200).json({ message: "Facebook leads synced successfully." });
//   } catch (err: any) {
//     console.error("Error syncing Facebook leads:", err);
//     res
//       .status(500)
//       .json({ message: "Error syncing leads", error: err.message });
//   }
// });

const GRAPH_API_VERSION = "v22.0";
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

app.post("/lead/webhook", async (req: any, res: any) => {
  try {
    console.log("🚀 Running Facebook auto-sync (Webhook Mode)...");

    // 1️⃣ Find connected user (Superadmin / Integration user)
    const users = await User.find({});
    const superadmin = users.find((u: any) => {
      const fb = u.meta?.facebook || u.meta?.get?.("facebook");
      return fb?.token;
    });

    if (!superadmin) {
      return res.status(404).json({
        message: "No connected Facebook account found!",
      });
    }

    const facebookMeta =
      superadmin.meta?.facebook || superadmin.meta?.get("facebook");
    const userAccessToken = facebookMeta?.token;
    const propertyId = superadmin.property_id;

    if (!userAccessToken) {
      throw new Error("Superadmin Facebook not linked properly.");
    }

    // 2️⃣ Fetch connected pages
    const pagesRes = await axios.get(`${GRAPH_API_BASE}/me/accounts`, {
      params: { access_token: userAccessToken },
    });

    const pages = pagesRes.data.data || [];
    console.log(`📄 Found ${pages.length} Facebook pages.`);

    let totalLeadsInserted = 0;

    for (const page of pages) {
      const pageAccessToken = page.access_token;

      // 3️⃣ Fetch active forms from the page
      const formsRes = await axios.get(
        `${GRAPH_API_BASE}/${page.id}/leadgen_forms`,
        {
          params: { access_token: pageAccessToken },
        }
      );

      const forms = formsRes.data.data || [];
      console.log(`🧾 Page "${page.name}" has ${forms.length} active forms.`);

      for (const form of forms) {
        if (form.status !== "ACTIVE") continue;

        const formDetailsRes = await axios.get(`${GRAPH_API_BASE}/${form.id}`, {
          params: {
            access_token: pageAccessToken,
            fields: "id,name,status,tracking_parameters",
          },
        });

        const formDetails = formDetailsRes.data;
        const trackingParams = formDetails.tracking_parameters || [];
        let matchedLabel: any = null;

        // 4️⃣ Match label by tracking parameter
        for (const param of trackingParams) {
          if (param.key === "labels") {
            const label = await Label.findOne({
              title: new RegExp(`^${param.value.trim()}$`, "i"),
              property_id: propertyId,
            });
            if (label) {
              matchedLabel = label;
              break;
            }
          }
        }

        if (!matchedLabel) continue;

        // 5️⃣ Fetch leads from the form
        const leadsRes = await axios.get(`${GRAPH_API_BASE}/${form.id}/leads`, {
          params: { access_token: pageAccessToken },
        });

        const leads = leadsRes.data.data || [];
        console.log(`📩 Found ${leads.length} leads for form "${form.name}".`);

        for (const fbLead of leads) {
          // Skip if already exists
          const existing = await Lead.findOne({ "meta.fb_lead_id": fbLead.id });
          if (existing) continue;

          const fields = fbLead.field_data.reduce((acc: any, f: any) => {
            acc[f.name] = f.values[0];
            return acc;
          }, {});

          // Build formatted comment
          const commentLines = [`label::${matchedLabel.title}`];
          for (const field of fbLead.field_data) {
            commentLines.push(`${field.name}::${field.values[0]}`);
          }
          const formattedComment = commentLines.join("\n");

          // Default status
          let status = await Status.findOne({
            title: "New",
            property_id: propertyId,
          });
          if (!status) {
            status = await Status.create({
              title: "New",
              description: "Default status for new leads",
              property_id: propertyId,
              meta: { is_active: true },
            });
          }

          // Default source
          let source = await Source.findOne({
            title: "Facebook",
            property_id: propertyId,
          });
          if (!source) {
            source = await Source.create({
              title: "Facebook",
              description: "Facebook Lead Ads",
              property_id: propertyId,
              meta: { is_active: true, is_editable: false },
            });
          }

          // 6️⃣ Round-robin agent assignment
          let assignedToId: Types.ObjectId | null = null;
          const label = await Label.findById(matchedLabel._id);

          if (
            label?.meta?.assigned_agents &&
            label.meta.assigned_agents.length > 0
          ) {
            const agents = label.meta.assigned_agents;
            const lastIndex = label.meta.last_assigned_index ?? -1;
            const nextIndex = (lastIndex + 1) % agents.length;

            assignedToId = agents[nextIndex].agent_id;
            label.meta.last_assigned_index = nextIndex;
            label.markModified("meta");
            await label.save();
          }

          // 7️⃣ Fallback: assign to Superadmin
          if (!assignedToId) {
            const superRole = await Role.findOne({ name: "Superadmin" });
            const fallback = await User.findOne({
              role: superRole?._id,
              property_id: propertyId,
            });
            assignedToId = fallback?._id ?? null; // ✅ fixed type issue
          }

          // 8️⃣ Create lead
          await Lead.create({
            name: fields.full_name || fields.name || "Unnamed Lead",
            email: fields.email || null,
            phone_number: fields.phone_number || null,
            comment: formattedComment,
            reference: "From Facebook",
            labels: [matchedLabel._id],
            status: status._id,
            property_id: propertyId,
            assigned_to: assignedToId,
            meta: {
              fb_lead_id: fbLead.id,
              form_id: form.id,
              page_id: page.id,
              source: source._id,
              location: await getLocationFromIP(req.ip || "::1"),
              ray_id: `ray-id-${uuidv4()}`,
            },
            logs: [
              {
                title: "Lead created",
                description: `Lead fetched from Facebook and assigned to ${matchedLabel.title}`,
                status: LeadLogStatus.INFO,
              },
            ],
          });

          totalLeadsInserted++;
        }
      }
    }

    console.log(
      `✅ FB Sync Complete: ${totalLeadsInserted} new leads inserted.`
    );
    res.status(200).json({
      message: "Facebook leads synced successfully",
      inserted: totalLeadsInserted,
    });
  } catch (err: any) {
    console.error("❌ FB Webhook error:", err?.response?.data || err.message);
    res.status(500).json({
      message: "Error syncing Facebook leads",
      error: err.message,
    });
  }
});



 