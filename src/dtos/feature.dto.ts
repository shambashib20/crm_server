import { Types } from "mongoose";

enum FeatureStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  ARCHIVED = "ARCHIVED",
}

enum FeatureLogsStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  ARCHIVED = "ARCHIVED",
}

interface FeatureLog {
  _id: Types.ObjectId;
  title: string;
  description: string;
  status: FeatureLogsStatus;
  createdAt: Date;
  meta?: Record<string, any>;
}
interface FeatureDto {
  _id: Types.ObjectId;
  title: string;
  description: string;
  value: string;
  status: FeatureStatus;
  logs: FeatureLog[];
  meta?: Record<string, any>;
}

export { FeatureDto, FeatureLog, FeatureStatus, FeatureLogsStatus };
