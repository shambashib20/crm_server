import { Types } from "mongoose";

enum AutomationType {
  LEAD_AUTOMATION = "LEAD_AUTOMATION",
  MEETING_AUTOMATION = "MEETING_AUTOMATION",
  INVOICE_AUTOMATION = "INVOICE_AUTOMATION",
}

enum LeadType {
  FIRST_MESSAGE = "FIRST_MESSAGE",
  NEXT_FOLLOWUP = "NEXT_FOLLOWUP",
}

enum InvoiceType {
  GENERATED_INVOICE = "GENERATED_INVOICE",
  CONVERTED_PAID_INVOICE = "CONVERTED_PAID_INVOICE",
  GENERATED_QUOTATION = "GENERATED_QUOTATION",
}

enum DeviceType {
  STAFF_DEVICE = "STAFF_DEVICE",
  GENERAL_DEVICE = "GENERAL_DEVICE",
}
interface AutomationRule {
  device_type: DeviceType;
  status_id: Types.ObjectId;
  label_id?: Types.ObjectId;
  template_id: Types.ObjectId;
}

interface AutomationDto {
  _id: Types.ObjectId;
  type: AutomationType;
  lead_type?: LeadType;
  invoice_type?: InvoiceType;
  property_id: Types.ObjectId;
  rules: AutomationRule[];
  meta: Record<string, any>;
}

export { AutomationDto, AutomationType, LeadType, AutomationRule, InvoiceType };
