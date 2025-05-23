import { Types } from "mongoose";

interface StatusDto {
  title: string;
  description: string;
  property_id: Types.ObjectId;
  meta?: Record<string, any>;
}

export { StatusDto };
