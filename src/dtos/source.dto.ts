import { Types } from "mongoose";

interface SourceDto {
  title: string;
  property_id: Types.ObjectId;
  description: string;
  meta?: Record<string, any>;
}

export { SourceDto };
