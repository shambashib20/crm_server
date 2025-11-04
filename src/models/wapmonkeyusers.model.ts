import { Schema, model, Document } from "mongoose";
import { WhatsAppDeviceDto } from "../dtos/wapmonkeyusers.dto";

interface WhatsAppDeviceDoc extends Document, WhatsAppDeviceDto {}

const WhatsAppDeviceSchema = new Schema<WhatsAppDeviceDoc>(
  {
    d_id: { type: Number, default: 0 },
    u_id: Number,
    mobile_no: String,
    status: Number,
    connectionId: String,
    old_connection_id: String,
    u_device_token: String,
    device_name: String,
    host_device: String,
    created_at: Date,
    updated_at: Date,
    is_meta_device: String,
    device_status: String,
  },
  { timestamps: true, versionKey: false }
);

export const WhatsAppDevice = model<WhatsAppDeviceDoc>(
  "WhatsAppDevice",
  WhatsAppDeviceSchema
);
