import { Schema, model, Document } from "mongoose";
import {
  CampaignTemplateDto,
  CampaignTemplateType,
} from "../dtos/campaigns.dto";

interface CampaignTemplateDoc extends Document, CampaignTemplateDto {}

const CampaignTemplateSchema = new Schema<CampaignTemplateDoc>(
  {
    type: {
      type: String,
      enum: Object.values(CampaignTemplateType),
      default: CampaignTemplateType.EMAIL,
    },
    title: { type: String, deafult: "" },
    message: { type: String },
    subject: { type: String },
    email_message: { type: String },
    sms_template_id: { type: String },
    attachments: { type: [String], default: [] },
    property_id: {
      type: Schema.Types.ObjectId,
      ref: "Property",
      default: null,
    },
    meta: {
      type: Map,
      of: Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true, versionKey: false }
);

export const CampaignTemplate = model<CampaignTemplateDoc>(
  "CampaignTemplate",
  CampaignTemplateSchema
);
