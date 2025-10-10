import { Types } from "mongoose";

enum PurchaseStatus {
  PENDING = "PENDING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  REFUNDED = "REFUNDED",
}

interface PurchaseRecordsDto {
  _id: Types.ObjectId;
  property_id: Types.ObjectId;
  package_id: Types.ObjectId;
  status: PurchaseStatus;
  meta?: Record<string, any>;
}

export { PurchaseStatus, PurchaseRecordsDto };
