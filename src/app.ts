import express, { Application } from "express";
import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
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

const app: Application = express();
app.use(cors());
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
