import { Schema, model, Document } from "mongoose";

import { PackageDto, PackageLog, PackageStatus } from "../dtos/package.dto";

const PackageLogSchema = new Schema<PackageLog & Document>(
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
      enum: Object.values(PackageStatus),
      required: true,
      default: PackageStatus.ACTIVE,
    },
    meta: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

const PackageSchema = new Schema<PackageDto & Document>(
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

    validity: {
      type: Date,
      required: true,
    },
    validity_in_days: {
      type: Number,
      required: true,
      min: 1,
    },

    status: {
      type: String,
      enum: Object.values(PackageStatus),
      required: true,
      default: PackageStatus.ACTIVE,
    },

    price: {
      type: Number,
      required: true,
      min: 0,
    },

    features: [
      {
        type: Schema.Types.ObjectId,
        ref: "Feature",
        required: true,
      },
    ],

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    logs: {
      type: [PackageLogSchema],
      default: [],
      validate: {
        validator: (arr: any[]) => Array.isArray(arr),
        message: "Logs must be an array of PackageLog entries",
      },
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

const Package = model<PackageDto & Document>("Package", PackageSchema);
export default Package;