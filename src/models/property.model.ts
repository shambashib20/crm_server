import { Document, model, Schema } from "mongoose";
import {
  Log,
  LogStatus,
  PropertyDto,
  PropertyStatus,
} from "../dtos/property.dto";

const LogSchema = new Schema<Log & Document>(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    status: {
      type: String,
      enum: LogStatus,
      default: LogStatus.INFO,
    },

    meta: { type: Schema.Types.Mixed },
  },
  { timestamps: true, versionKey: false }
);

const PropertySchema = new Schema<PropertyDto & Document>(
  {
    meta: {
      type: Map,
      of: Schema.Types.Mixed,
      default: {},
    },
    name: {
      type: String,
    },
    description: {
      type: String,
    },
    usage_limits: {
      type: Number,
      default: 0,
    },
    usage_count: {
      type: Number,
      default: 0,
    },
    logs: {
      type: [LogSchema],
      default: [],
    },
    role: {
      type: Schema.Types.ObjectId,
      ref: "Role",
    },
    email_verification_otp: { type: String },
    otp_expiration: { type: Date, default: null },

    is_verified: { type: Boolean, default: false },
    reported: { type: Boolean, default: false },
    is_banned: { type: Boolean, default: false },
    status: {
      type: String,
      enums: PropertyStatus,
    },
  },
  { timestamps: true, versionKey: false }
);

const Property = model<PropertyDto & Document>("Property", PropertySchema);

export default Property;
