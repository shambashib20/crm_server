import { Types } from "mongoose";

export enum CampaignTemplateType {
  WHATSAPP = "WHATSAPP",
  EMAIL = "EMAIL",
  SMS = "SMS",
}

export interface CampaignTemplateDto {
  type: CampaignTemplateType;
  title: string;
  message?: string;
  subject?: string;
  email_message?: string;
  sms_template_id?: string;
  attachments?: string[];
  property_id?: Types.ObjectId;
  meta?: Record<string, any>;
}
