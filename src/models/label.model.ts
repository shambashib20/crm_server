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
    meta: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, versionKey: false }
);

const Label = model<LabelDto & Document>("Label", LabelSchema);
export default Label;
