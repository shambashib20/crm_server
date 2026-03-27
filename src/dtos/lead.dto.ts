import { Types } from "mongoose";
import { StatusDto } from "./status.dto";
enum LeadLogStatus {
  INFO = "INFO",
  WARNING = "WARNING",
  ERROR = "ERROR",
  ACTION = "ACTION",
  SYSTEM = "SYSTEM",
  SUCCESS = "SUCCESS",
}

interface LeadLog {
  title: string;
  description: string;
  status: LeadLogStatus;
  createdAt: Date;
  meta?: Record<string, any>;
}

interface Task {
  title: string;
  description: string;
  createdAt: Date;
  meta?: Record<string, any>;
}

interface FollowUp {
  next_followup_date: Date;
  comment: string;
  meta?: Record<string, any>;
}

interface LeadDto {
  name: string;
  company_name: string;
  phone_number: string;
  email: string;
  address: string;
  comment: string;
  reference: string;
  logs: LeadLog[];
  follow_ups: FollowUp[];
  tasks: Task[];
  status: Types.ObjectId | StatusDto;
  labels: Types.ObjectId[];
  assigned_to?: Types.ObjectId;
  assigned_by?: Types.ObjectId;
  meta?: Record<string, any>;
  ip_address?: string;
  property_id: Types.ObjectId;
  createdAt: Date;
}

enum LeadLimitValidationStatus {
  OK = "OK",
  NO_PACKAGE = "NO_PACKAGE",
  PACKAGE_NOT_ACTIVE = "PACKAGE_NOT_ACTIVE",
  FEATURE_MISSING = "FEATURE_MISSING",
  FEATURE_EXPIRED = "FEATURE_EXPIRED",
  LIMIT_REACHED = "LIMIT_REACHED",
}

export { LeadDto, LeadLog, Task, FollowUp, LeadLogStatus, LeadLimitValidationStatus };
