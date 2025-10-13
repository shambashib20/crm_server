import { Types } from "mongoose";

enum PurchaseStatus {
  PENDING = "PENDING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  REFUNDED = "REFUNDED",
  CANCELLED = "CANCELLED",
  EXPIRED = "EXPIRED",
}

interface PurchaseRecordsDto {
  _id: Types.ObjectId;
  property_id: Types.ObjectId;
  package_id: Types.ObjectId;
  status: PurchaseStatus;
  meta?: Record<string, any>;
}

export { PurchaseStatus, PurchaseRecordsDto };
