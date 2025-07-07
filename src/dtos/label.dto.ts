import { Types } from "mongoose";

interface LabelDto {
  _id: Types.ObjectId;
  title: string;
  description: string;
  createdAt: Date;
  property_id: Types.ObjectId;
  meta?: Record<string, any>;
}

export { LabelDto };
