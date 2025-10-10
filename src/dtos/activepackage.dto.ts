import { Types } from "mongoose";

interface ActivePackageLog {
  _id: Types.ObjectId;
  title: string;
  description: string;
  createdAt: Date;
  meta?: Record<string, any>;
}
interface ActivePackageDto {
  _id: Types.ObjectId;
  property_id: Types.ObjectId;
  package_id: Types.ObjectId;
  status: string;
  validity_in_days: number;
  validity: Date;
  logs: ActivePackageLog[];
  meta?: Record<string, any>;
}

export { ActivePackageLog, ActivePackageDto };
