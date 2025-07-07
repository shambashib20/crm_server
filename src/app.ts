import express, { Application } from "express";
import dotenv from "dotenv";
dotenv.config();

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
import Property from "./models/property.model";
import axios from "axios";
import Label from "./models/label.model";
import Lead from "./models/lead.model";
import { Types } from "mongoose";
import { LabelDto } from "./dtos/label.dto";

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

app.get("/webhook", (req: any, res: any) => {
  const VERIFY_TOKEN = process.env.FB_TOKEN;

  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token && mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ Facebook webhook verified");
    return res.status(200).send(challenge);
  } else {
    return res.sendStatus(403);
  }
});

app.post("/webhook", async (req: any, res: any) => {
  try {
    const body = req.body;

    if (body.object === "page") {
      for (const entry of body.entry) {
        for (const change of entry.changes) {
          if (change.field === "leadgen") {
            const leadgen_id = change.value.leadgen_id;
            const form_id = change.value.form_id;
            const page_id = change.value.page_id;

            const property = await Property.findOne({
              "meta.facebook.page_id": page_id,
            });

            const token = property?.meta?.facebook?.token;
            if (!token) {
              console.warn(`⚠️ Token not found for page_id: ${page_id}`);
              continue;
            }

            const leadRes = await axios.get(
              `https://graph.facebook.com/v18.0/${leadgen_id}?access_token=${token}`
            );

            const leadData = leadRes.data;

            
            const formRes = await axios.get(
              `https://graph.facebook.com/v18.0/${form_id}?access_token=${token}&fields=tracking_parameters`
            );

            const trackingParams = formRes.data?.tracking_parameters || [];

            let matchedLabel: LabelDto | null = null;

            for (const param of trackingParams) {
              matchedLabel = await Label.findOne({ key: param.key });
              if (matchedLabel) break; 
            }

            const formattedFields: Record<string, any> = {};
            leadData.field_data.forEach((field: any) => {
              formattedFields[field.name] = field.values?.[0] || "";
            });

            await Lead.create({
              name: formattedFields.full_name || "",
              email: formattedFields.email || "",
              phone: formattedFields.phone_number || "",
              formId: form_id,
              pageId: page_id,
              leadgenId: leadgen_id,
              label: new Types.ObjectId(matchedLabel?._id) || null,
              raw: leadData,
              property: property?._id || null,
            });

            console.log("✅ Lead saved from webhook:", leadgen_id);
          }
        }
      }

      return res.status(200).send("EVENT_RECEIVED");
    } else {
      return res.sendStatus(404);
    }
  } catch (err) {
    console.error("❌ Error handling webhook:", err);
    return res.status(500).json({ message: "Error handling webhook" });
  }
});
 