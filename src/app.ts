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
import { checkRazorpayWebhookStatus } from "./health-checkers/razorpay-webhook-checker";
import SuccessResponse from "./middlewares/success.middleware";
import os from "os";
import { _getMasterStats } from "./services/master.service";

function getSystemHealth() {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const memUsagePercent = ((usedMem / totalMem) * 100).toFixed(2);

  return {
    cpuLoad: os.loadavg()[0].toFixed(2),
    memory: {
      totalGB: (totalMem / 1024 / 1024 / 1024).toFixed(2),
      usedGB: (usedMem / 1024 / 1024 / 1024).toFixed(2),
      usagePercent: memUsagePercent,
    },
  };
}

const app: Application = express();

const SERVER_START_TIME = new Date();

function formatUptime(startTime: Date) {
  const now = new Date();
  const diff = now.getTime() - startTime.getTime();

  const seconds = Math.floor(diff / 1000) % 60;
  const minutes = Math.floor(diff / (1000 * 60)) % 60;
  const hours = Math.floor(diff / (1000 * 60 * 60)) % 24;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  return `${days} day, ${hours} hours, ${minutes} minutes, ${seconds} seconds ago`;
}

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

setInterval(() => {
  const health = getSystemHealth();

  const cpu = Number(health.cpuLoad);
  const mem = Number(health.memory.usagePercent);

  if (cpu > 2.0) {
    console.warn(`⚠️ HIGH CPU LOAD: ${cpu}`);
  }

  if (mem > 80) {
    console.warn(`⚠️ HIGH MEMORY USAGE: ${mem}%`);
  }
}, 30 * 1000);
app.get("/payment-webhook/monitor", async (req: any, res: any) => {
  try {
    await checkRazorpayWebhookStatus();

    return res
      .status(200)
      .json(
        new SuccessResponse("Webhook running successfully!", 200, res.data)
      );
  } catch (err: any) {
    console.error("Error in checking Razorpay webhook status:", err);

    return res
      .status(500)
      .json(new SuccessResponse(err.message || "Webhook monitor failed", 500));
  }
});
app.get("/status", async (req: any, res: any) => {
  try {
    // Fetch all status information in parallel for better performance
    const [dbStatus, health, paymentWebhookStatus, masterStats] =
      await Promise.all([
        getDbStatus(),
        getSystemHealth(),
        checkRazorpayWebhookStatus(),
        _getMasterStats(),
      ]);

    const serverStart = SERVER_START_TIME;
    const uptimeMsg = formatUptime(SERVER_START_TIME);

    res.status(200).json({
      status: 200,
      message: "Server and DB status fetched successfully!",
      data: {
        server: `ETC CRM server started on ${serverStart.toString()}, ${uptimeMsg}`,
        dbStatus,
        cpuLoad: health.cpuLoad,
        memory: health.memory,
        paymentWebhookStatus,
        card_statistics: {
          totalLeads: masterStats.totalLeads,
          totalClients: masterStats.totalClients,
          totalCustomers: masterStats.totalCustomers,
          totalProperties: masterStats.totalProperties,
          activeProperties: masterStats.activeProperties,
        },
      },
    });
  } catch (err: any) {
    console.error("Error in Server Status:", err);
    res.status(500).json({
      status: 500,
      message: "Error in fetching server status",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
});




app.listen(PORT, async () => {
  console.log(`Server Started Listening at ${PORT}`);
  await connect();

  await checkRazorpayWebhookStatus();

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

      await (!superadmin
        ? (async () => {
            console.log("🔨 Seeding superadmin user...");
            await seedSuperadminUser();
          })()
        : console.log("ℹ️ Superadmin user already exists. Skipping seeder."));

      console.log("✅ Seeder checks completed.");
    } catch (error) {
      console.error("❌ Error during seeding checks:", error);
    }
  }
});


const GRAPH_API_VERSION = "v22.0";
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

app.post("/lead/webhook", async (req: any, res: any) => {
  try {
    console.log("🚀 Running Facebook auto-sync (Webhook Mode)…");

    // 1️⃣ Get connected user
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
    const userAccessToken: string | undefined = facebookMeta?.token;
    const propertyId: Types.ObjectId = superadmin.property_id;

    if (!userAccessToken) {
      throw new Error("Superadmin Facebook not linked properly.");
    }

    // 2️⃣ Fetch pages
    const pagesRes = await axios.get(`${GRAPH_API_BASE}/me/accounts`, {
      params: { access_token: userAccessToken },
    });

    const pages = pagesRes.data.data || [];
    console.log(`📄 Found ${pages.length} Facebook pages.`);

    let totalLeadsInserted = 0;

    for (const page of pages) {
      const pageAccessToken: string | undefined = page.access_token;
      if (!pageAccessToken) continue;

      // 3️⃣ Fetch forms
      const formsRes = await axios.get(
        `${GRAPH_API_BASE}/${page.id}/leadgen_forms`,
        {
          params: { access_token: pageAccessToken },
        }
      );

      const forms = formsRes.data.data || [];
      console.log(`🧾 Page "${page.name}" has ${forms.length} forms.`);

      for (const form of forms) {
        if (form.status !== "ACTIVE") continue;

        const detailsRes = await axios.get(`${GRAPH_API_BASE}/${form.id}`, {
          params: {
            access_token: pageAccessToken,
            fields: "id,name,tracking_parameters",
          },
        });

        const formDetails = detailsRes.data;
        const trackingParams = formDetails.tracking_parameters || [];
        let matchedLabel: any = null;

        for (const param of trackingParams) {
          if (param.key === "label") {
            const cleanValue = param.value.trim();

            const labelDoc = await Label.findOne({
              title: new RegExp(`^${cleanValue}$`, "i"),
              property_id: propertyId,
            });

            if (labelDoc) {
              matchedLabel = labelDoc;
              break;
            }
          }
        }

        if (!matchedLabel) continue;

        // 5️⃣ Fetch leads for this form
        const leadsRes = await axios.get(`${GRAPH_API_BASE}/${form.id}/leads`, {
          params: { access_token: pageAccessToken, limit: 200 },
        });

        const leads = leadsRes.data.data || [];
        console.log(`📨 Found ${leads.length} leads for form "${form.name}".`);

        // ------------------------------------
        // 6️⃣ DEFAULT STATUS / SOURCE CREATION
        // ------------------------------------
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

        // ------------------------------------
        // 7️⃣ ROUND ROBIN SETUP
        // ------------------------------------
        const labelDoc = await Label.findById(matchedLabel._id);
        if (!labelDoc) continue;

        labelDoc.meta = labelDoc.meta || {};
        const agents: { agent_id: Types.ObjectId }[] =
          labelDoc.meta.assigned_agents || [];

        let lastIndex: number =
          typeof labelDoc.meta.last_assigned_index === "number"
            ? labelDoc.meta.last_assigned_index
            : -1;

        const superRole = await Role.findOne({ name: "Superadmin" });
        const fallbackUser = await User.findOne({
          role: superRole?._id,
          property_id: propertyId,
        });

        // ------------------------------------
        // 8️⃣ BUILD INSERT ARRAY
        // ------------------------------------
        const toInsert: any[] = [];

        for (const fbLead of leads) {
          if (!fbLead?.id) continue;

          const exists = await Lead.exists({
            "meta.fb_lead_id": fbLead.id,
          });
          if (exists) continue;

          // round robin assign
          let assignedToId: Types.ObjectId | null = null;

          if (agents.length > 0) {
            lastIndex = (lastIndex + 1) % agents.length;
            assignedToId = agents[lastIndex].agent_id;
          } else {
            assignedToId = fallbackUser?._id ?? null;
          }

          const fields = (fbLead.field_data || []).reduce(
            (acc: any, f: any) => {
              acc[f.name] = f.values[0];
              return acc;
            },
            {}
          );

          const comments = [`label::${matchedLabel.title}`];
          for (const field of fbLead.field_data || []) {
            comments.push(`${field.name}::${field.values[0]}`);
          }

          toInsert.push({
            name: fields.full_name || fields.name || "Unnamed Lead",
            email: fields.email || null,
            phone_number: fields.phone_number || null,
            comment: comments.join("\n"),
            reference: "From Facebook",
            labels: [matchedLabel._id],
            status: status._id,
            assigned_to: assignedToId,
            property_id: propertyId,
            meta: {
              fb_lead_id: fbLead.id,
              form_id: form.id,
              page_id: page.id,
              source: source._id,
              ray_id: `ray-id-${uuidv4()}`,
              status: "ACTIVE",
            },
            logs: [
              {
                title: "Lead created",
                description: `Imported from Facebook form ${form.name}`,
                status: LeadLogStatus.INFO,
              },
            ],
          });
        }

        // ------------------------------------
        // 9️⃣ BULK INSERT
        // ------------------------------------
        if (toInsert.length > 0) {
          await Lead.insertMany(toInsert, { ordered: false });
          console.log(`✅ Inserted ${toInsert.length} leads (Bulk mode).`);
          totalLeadsInserted += toInsert.length;
        }

        // ------------------------------------
        // 🔟 UPDATE ROUND ROBIN INDEX
        // ------------------------------------
        if (agents.length > 0) {
          labelDoc.meta.last_assigned_index = lastIndex;
          labelDoc.markModified("meta");
          await labelDoc.save();
        }
      }
    }

    console.log(`🎯 FB Sync Complete: ${totalLeadsInserted} new leads inserted.`);

    res.status(200).json({
      message: "Facebook leads synced successfully",
      inserted: totalLeadsInserted,
    });

  } catch (err: any) {
    console.error("❌ FB Webhook error:", err.response?.data || err.message);
    res.status(500).json({
      message: "Error syncing Facebook leads",
      error: err.message,
    });
  }
});


 