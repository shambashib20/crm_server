import { Schema, model } from "mongoose";

import { AddOnDto, AddOnStatus } from "../dtos/addons.dto";

const AddsOnSchema = new Schema<AddOnDto & Document>(
  {
    title: {
      type: String,
      default: "",
    },
    description: {
      type: String,
      default: "",
    },
    value: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: Object.values(AddOnStatus),
      default: AddOnStatus.ACTIVE,
    },
    meta: {
      type: Schema.Types.Mixed,
      default: {},
    },
    property_id: {
      type: Schema.Types.ObjectId,
      ref: "Property",
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    autoIndex: true,
  }
);

const AddOns = model<AddOnDto & Document>("AddOns", AddsOnSchema);
export default AddOns;
