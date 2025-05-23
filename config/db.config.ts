import { MongoStatusEnums } from "../src/app";
import mongoose from "mongoose";

const connect = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI as string);
    console.log("Connected to MongoDB");
    return MongoStatusEnums.CONNECTED;
  } catch (err: any) {
    console.error("MongoDB connection error:", err);
    return MongoStatusEnums.CONNECTION_ERROR;
  }
};

const getDbStatus = async (): Promise<string> => {
  try {
    if (mongoose.connection.readyState === 1) {
      if (mongoose.connection.db) {
        await mongoose.connection.db.admin().ping();
      } else {
        throw new Error("MongoDB connection is not established.");
      }
      return "MongoDB is connected and responsive!";
    } else {
      return "MongoDB is not connected!";
    }
  } catch (err) {
    console.error("MongoDB ping error:", err);
    return "MongoDB is connected but not responsive!";
  }
};

export { connect, getDbStatus };
