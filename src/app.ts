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

// TODO : Will Comment out this line later!
// import "./cron-jobs/cron";
import Label from "./models/label.model";
import Role from "./models/role.model";
import { seedDefaultSources } from "./seeders/source.seeder";
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

app.use(express.json());
app.use("/api/facebook", facebookRoutes);
app.use("/api", mainRouter);
export enum MongoStatusEnums {
  CONNECTED = "Connected to mongodb",
  CONNECTION_ERROR = "Mongodb connection Error!",
}

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

app.post("/lead/webhook", async (req: any, res: any) => {
  try {
    // Step 1: Get all potential superadmins (filter further if needed)
    const users = await User.find({});

    let superadmin: (typeof users)[0] | null = null;

    for (const user of users) {
      const meta = user.meta;

      // For Map-based `meta`
      const fbMeta =
        typeof meta?.get === "function"
          ? meta?.get("facebook")
          : meta?.facebook;

      if (fbMeta?.token && fbMeta?.form_id) {
        superadmin = user;
        (superadmin.meta ??= {}).facebook = fbMeta;
        break;
      }
    }

    console.log(superadmin, "superadmin object");

    if (!superadmin) {
      return res.status(404).json({
        message: "Superadmin with Facebook token and form ID not found",
      });
    }

    const access_token = superadmin?.meta?.facebook.token;
    const form_id = superadmin?.meta?.facebook.form_id;

    const response = await axios.get(
      `https://graph.facebook.com/v18.0/${form_id}/leads?access_token=${access_token}`
    );

    const leads = response.data.data;
    console.log(`✅ Leads fetched from Facebook:`, leads);
    const now = new Date();

    const createdLeads: any[] = [];

    for (const lead of leads) {
      const exists = await Lead.findOne({ "meta.fb_lead_id": lead.id });
      if (exists) continue;

      const defaultSource = await Source.findOne({
        title: "Landing Page Leads",
      });
      const defaultStatus = await Status.findOne({ title: "New" });

      const ray_id = `ray-id-${uuidv4()}`;
      const ip = req.ip || "::1";
      const locationData = await getLocationFromIP(ip);

      const leadDoc = await Lead.create({
        name: lead.full_name || lead.name || "",
        email: lead.email || "",
        phone_number: lead.phone_number || "",
        labels: [],
        assigned_to: superadmin._id,
        assigned_by: superadmin._id,
        property_id: defaultStatus?.property_id,
        status: defaultStatus?._id,
        meta: {
          fb_lead_id: lead.id,
          ray_id,
          source: defaultSource || "Landing Page Leads",
          location: locationData,
          created_by: superadmin._id,
        },
        logs: [
          {
            title: "Lead created",
            description: `Lead fetched from Facebook and assigned status: ${defaultStatus?.title}`,
            status: LeadLogStatus.ACTION,
            meta: {},
            createdAt: now,
            updatedAt: now,
          },
        ],
      });
      createdLeads.push(leadDoc);

      await Property.findByIdAndUpdate(
        defaultStatus?.property_id,
        {
          $inc: { usage_count: 1 },
          $push: {
            logs: {
              title: "Lead Assigned",
              description: `A new lead named (${leadDoc.name}) was assigned to this property.`,
              status: LogStatus.INFO,
              meta: { leadId: leadDoc._id },
              createdAt: now,
              updatedAt: now,
            },
          },
        },
        { new: true }
      );
    }
    console.log(`✅ Leads inserted into MongoDB:`, createdLeads);

    res.status(200).json({ message: "Facebook leads synced successfully." });
  } catch (err: any) {
    console.error("Error syncing Facebook leads:", err);
    res
      .status(500)
      .json({ message: "Error syncing leads", error: err.message });
  }
});
 