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
import "./cron-jobs/cron";
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
      console.log("🌱 Running database seeders...");
      await seedRolesAndPermissions();
      await seedDefaultProperty();
      await seedSuperadminUser();
      await seedDefaultLeadStatuses();
      await seedDefaultLabelStatuses();
      console.log("✅ Database seeding completed.");
    } catch (error) {
      console.error("❌ Error during seeding:", error);
    }
  }
});

app.post("/lead/webhook", async (req, res) => {
  try {
    const superadmin = await User.findOne({
      "meta.facebook.token": { $exists: true },
      "meta.facebook.form_id": { $exists: true },
    });

    if (
      !superadmin ||
      !superadmin.meta?.facebook?.token ||
      !superadmin.meta?.facebook?.form_id
    ) {
      return res.status(404).json({
        message: "Superadmin with Facebook token and form ID not found",
      });
    }

    const access_token = superadmin.meta.facebook.token;
    const form_id = superadmin.meta.facebook.form_id;

    const response = await axios.get(
      `https://graph.facebook.com/v18.0/${form_id}/leads?access_token=${access_token}`
    );

    const leads = response.data.data;
    const now = new Date();

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
        name: lead.full_name || lead.name || "Unknown",
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

    res.status(200).json({ message: "Facebook leads synced successfully." });
  } catch (err: any) {
    console.error("Error syncing Facebook leads:", err);
    res
      .status(500)
      .json({ message: "Error syncing leads", error: err.message });
  }
});
