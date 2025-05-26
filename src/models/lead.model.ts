import { Schema, model } from "mongoose";
import { Lead, LeadLog, LeadLogStatus } from "../dtos/lead.dto";

const LogSchema = new Schema<LeadLog & Document>(
  {
    title: { type: String },
    description: { type: String },
    status: {
      type: String,
      enum: LeadLogStatus,
    },
    meta: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, versionKey: false }
);

const TaskSchema = new Schema(
  {
    title: { type: String },
    description: { type: String },
    createdAt: { type: Date, default: Date.now },
    meta: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, versionKey: false }
);

const FollowUpSchema = new Schema(
  {
    next_followup_date: {
      type: Date,
      default: null,
    },
    comment: {
      type: String,
      default: "",
    },
    meta: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true, versionKey: false }
);

const LeadSchema = new Schema<Lead & Document>(
  {
    name: {
      type: String,
      deafult: "",
    },
    company_name: {
      type: String,
      default: "",
    },
    phone_number: {
      type: String,
      default: "",
    },
    email: {
      type: String,
      default: "",
    },
    address: {
      type: String,
      default: "",
    },
    comment: {
      type: String,
      default: "",
    },
    reference: {
      type: String,
      default: "",
    },

    logs: {
      type: [LogSchema],
      default: [],
    },
    follow_ups: {
      type: [FollowUpSchema],
      default: [],
    },
    tasks: {
      type: [TaskSchema],
      default: [],
    },

    status: {
      type: Schema.Types.ObjectId,
      ref: "Status",
      default: null,
    },
    labels: [
      {
        type: Schema.Types.ObjectId,
        ref: "Label",
        default: null,
      },
    ],
    assigned_to: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    assigned_by: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    meta: {
      type: Schema.Types.Mixed,
      default: {},
    },
    property_id: {
      type: Schema.Types.ObjectId,
      ref: "Property",
      default: null,
    },
  },
  { timestamps: true, versionKey: false }
);

// Export model
const Lead = model<Lead & Document>("Lead", LeadSchema);
export default Lead;
