import { Schema, model } from "mongoose";
import { SourceDto } from "../dtos/source.dto";
const SourceSchema = new Schema<SourceDto & Document>(
  {
    title: {
      type: String,
    },
    property_id: {
      type: Schema.Types.ObjectId,
      default: null,
      ref: "Property",
    },
    description: {
      type: String,
      default: "",
    },
    meta: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

const Source = model<SourceDto & Document>("Source", SourceSchema);

export default Source;
