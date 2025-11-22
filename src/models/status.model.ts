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
StatusSchema.index({ title: 1 });

// 2️⃣ Fast lookup for property-specific statuses
StatusSchema.index({ property_id: 1 });

// 3️⃣ Optional: combined queries, avoids collision & boosts speed
StatusSchema.index({ property_id: 1, title: 1 });
const Status = model<StatusDto & Document>("Status", StatusSchema);
export default Status;
