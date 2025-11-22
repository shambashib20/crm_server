import { Types } from "mongoose";

enum LogStatus {
  INFO = "INFO",
  WARNING = "WARNING",
  ERROR = "ERROR",
  ACTION = "ACTION",
  SYSTEM = "SYSTEM",
  SUCCESS = "SUCCESS",
}

interface Log {
  [x: string]: any;
  title: string;
  description: string;
  status: LogStatus;
  createdAt: Date;

  meta?: Record<string, any>;
}
enum KeyStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
}

interface KeyAccess {
  key: string;
  name?: string;
  usage_limit: number;
  usage_count: number;
  allowed_users: Types.ObjectId[];
  created_at: Date;
  expires_at?: Date;
  status: KeyStatus;
  meta?: Record<string, any>;
}

enum PropertyStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTVE",
  USAGE_LIMIT_EXCEEDED = "USAGE_LIMIT_EXCEEDED",
}

interface PropertyDto {
  meta?: {
    [key: string]: any;
  };
  _id: Types.ObjectId;
  name: string;
  description: string;
  usage_limits: number;
  usage_count: number;
  logs: Log[];
  role: Types.ObjectId;
  email_verification_otp: string;
  otp_expiration: Date | null;
  is_verified: boolean;
  reported: boolean;
  is_banned: boolean;
  status: PropertyStatus;
  keys: KeyAccess[];
}

export { PropertyDto, LogStatus, Log, PropertyStatus, KeyAccess };
