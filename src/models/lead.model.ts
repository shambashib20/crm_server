import { Schema, model } from "mongoose";
import { Lead, LeadLog } from "../dtos/lead.dto";

const LogSchema = new Schema<LeadLog & Document>(
  {
    title: { type: String },
    description: { type: String },
    createdAt: { type: Date, default: Date.now },
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
    next_followup_date: { type: Date },
    comment: { type: String },
    meta: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, versionKey: false }
);

const LeadSchema = new Schema<Lead & Document>(
  {
    name: { type: String },
    company_name: { type: String },
    phone_number: { type: String },
    email: { type: String },
    address: { type: String },
    comment: { type: String },
    reference: { type: String },

    logs: { type: [LogSchema], default: [] },
    follow_ups: { type: [FollowUpSchema], default: [] },
    tasks: { type: [TaskSchema], default: [] },

    status: { type: Schema.Types.ObjectId, ref: "LeadStatus" },
    labels: [{ type: Schema.Types.ObjectId, ref: "Label" }],
    assigned_to: { type: Schema.Types.ObjectId, ref: "User" },
    assigned_by: { type: Schema.Types.ObjectId, ref: "User" },

    meta: { type: Schema.Types.Mixed, default: {} },
    property_id: { type: Schema.Types.ObjectId, ref: "Property" },
  },
  { timestamps: true, versionKey: false }
);

// Export model
const Lead = model<Lead & Document>("Lead", LeadSchema);
export default Lead;
