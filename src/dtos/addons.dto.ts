import { Types } from "mongoose";

enum AddOnStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  ARCHIVED = "ARCHIVED",
}

interface AddOnDto {
  _id?: Types.ObjectId;
  title: string;
  description?: string;
  value: number;
  status?: AddOnStatus;
  meta?: Record<string, any>;
  property_id?: Types.ObjectId;
}

export { AddOnDto, AddOnStatus };
