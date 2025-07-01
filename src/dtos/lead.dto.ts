import { Types } from "mongoose";

enum LeadLogStatus {
  INFO = "INFO",
  WARNING = "WARNING",
  ERROR = "ERROR",
  ACTION = "ACTION",
  SYSTEM = "SYSTEM",
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

interface Lead {
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
  status: Types.ObjectId;
  labels: Types.ObjectId[];
  assigned_to?: Types.ObjectId;
  assigned_by?: Types.ObjectId;
  meta?: Record<string, any>;
  ip_address?: string;
  property_id: Types.ObjectId;
}

export { Lead, LeadLog, Task, FollowUp, LeadLogStatus };
