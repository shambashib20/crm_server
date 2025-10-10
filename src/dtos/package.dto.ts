import { Types } from "mongoose";

enum PackageStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  ARCHIVED = "ARCHIVED",
  DELETED = "DELETED",
}

interface PackageLog {
  _id: Types.ObjectId;
  title: string;
  description: string;
  status: PackageStatus;
  createdAt: Date;
  meta?: Record<string, any>;
}
interface PackageDto {
  _id: Types.ObjectId;
  title: string;
  description: string;
  validity: Date;
  validity_in_days: number;
  status: PackageStatus;
  price: number;
  features: Types.ObjectId[];
  createdBy: Types.ObjectId;
  logs: PackageLog[];
  meta?: Record<string, any>;
}

export { PackageDto, PackageLog, PackageStatus };
