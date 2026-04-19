import { Types } from "mongoose";
import { LogStatus } from "./property.dto";

interface ArchivedLogDto {
  _id: Types.ObjectId;
  property_id: Types.ObjectId;
  original_log_id: Types.ObjectId;
  title: string;
  description: string;
  status: LogStatus;
  original_meta?: Record<string, any>;
  original_created_at: Date;
  deleted_by: Types.ObjectId;
  deleted_at: Date;
}

export { ArchivedLogDto, LogStatus };
