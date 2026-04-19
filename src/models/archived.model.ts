import { Schema, model, Document } from "mongoose";
import { ArchivedLogDto, LogStatus } from "../dtos/archived_log.dto";

interface ArchivedLogDoc extends Document, Omit<ArchivedLogDto, "_id"> {}

const ArchivedLogSchema = new Schema<ArchivedLogDoc>(
  {
    property_id: {
      type: Schema.Types.ObjectId,
      ref: "Property",
      required: true,
    },
    original_log_id: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    title: { type: String, required: true },
    description: { type: String, required: true },
    status: {
      type: String,
      enum: Object.values(LogStatus),
      default: LogStatus.INFO,
    },
    original_meta: { type: Schema.Types.Mixed },
    original_created_at: { type: Date, required: true },
    deleted_by: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    deleted_at: { type: Date, default: Date.now },
  },
  { timestamps: true, versionKey: false }
);

// One archive entry per user per log — prevents duplicates if called twice
ArchivedLogSchema.index({ original_log_id: 1, deleted_by: 1 }, { unique: true });

const ArchivedLog = model<ArchivedLogDoc>("ArchivedLog", ArchivedLogSchema);

export default ArchivedLog;
