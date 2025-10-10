import { Schema, model, Document } from "mongoose";

import {
  FeatureStatus,
  FeatureLog,
  FeatureLogsStatus,
  FeatureDto,
} from "../dtos/feature.dto";

const FeatureLogSchema = new Schema<FeatureLog & Document>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: Object.values(FeatureLogsStatus),
      required: true,
      default: FeatureLogsStatus.ACTIVE,
    },
    meta: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true, versionKey: false }
);

const FeatureSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: Object.values(FeatureStatus),
      required: true,
      default: FeatureStatus.ACTIVE,
    },
    logs: {
      type: [FeatureLogSchema],
      default: [],
    },
    meta: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true, versionKey: false }
);

const Feature = model<FeatureDto & Document>("Feature", FeatureSchema);
export default Feature;
