import { Schema, model } from "mongoose";
import { LabelDto } from "../dtos/label.dto";

const LabelSchema = new Schema<LabelDto & Document>(
  {
    title: {
      type: String,
    },
    description: {
      type: String,
    },
    property_id: {
      type: Schema.Types.ObjectId,
      ref: "Property",
    },
    meta: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, versionKey: false }
);
LabelSchema.index({ property_id: 1 });
LabelSchema.index({ createdAt: -1 });
const Label = model<LabelDto & Document>("Label", LabelSchema);
export default Label;
