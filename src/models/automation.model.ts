import {
  AutomationDto,
  AutomationType,
  InvoiceType,
  LeadType,
} from "../dtos/automation.dto";
import { Schema, model, Document } from "mongoose";

interface AutomationDoc extends Document, Omit<AutomationDto, "_id"> {}

const AutomationRuleSchema = new Schema({
  device_type: { type: String, default: "" },
  status_id: { type: Schema.Types.ObjectId, ref: "Status", default: null },
  label_id: { type: Schema.Types.ObjectId, ref: "Label" },
  template_id: {
    type: Schema.Types.ObjectId,
    ref: "Template",
    default: "",
  },
});

const AutomationSchema = new Schema<AutomationDoc>(
  {
    type: {
      type: String,
      enum: Object.values(AutomationType),
      required: true,
    },
    lead_type: {
      type: String,
      enum: Object.values(LeadType),
    },
    invoice_type: {
      type: String,
      enum: Object.values(InvoiceType),
    },
    property_id: {
      type: Schema.Types.ObjectId,
      ref: "Property",
      default: null,
    },
    rules: {
      type: [AutomationRuleSchema],
      default: [],
    },
    meta: {
      type: Map,
      of: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);
const Automation = model<AutomationDoc>("Automation", AutomationSchema);

export default Automation;
