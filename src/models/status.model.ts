import { Schema, model } from "mongoose";
import { StatusDto } from "../dtos/status.dto";

const StatusSchema = new Schema<StatusDto & Document>(
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

const Status = model<StatusDto & Document>("Status", StatusSchema);
export default Status;
