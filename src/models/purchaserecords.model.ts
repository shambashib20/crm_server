import { Schema, model, Document } from "mongoose";

import {
  PurchaseRecordsDto,
  PurchaseStatus,
} from "../dtos/purchaserecords.dto";

const PurchaseRecordsSchema = new Schema<PurchaseRecordsDto & Document>(
  {
    property_id: {
      type: Schema.Types.ObjectId,
      ref: "Property",
      default: null,
    },
    package_id: {
      type: Schema.Types.ObjectId,
      ref: "Package",  
      default: null,
    },


    
    status: {
      type: String,
      enum: PurchaseStatus,
      default: PurchaseStatus.PENDING,
    },
    meta: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

const PurchaseRecordsModel = model<PurchaseRecordsDto & Document>(
  "PurchaseRecords",
  PurchaseRecordsSchema
);
export default PurchaseRecordsModel;
