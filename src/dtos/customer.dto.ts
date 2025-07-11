import { Types } from "mongoose";

interface CustomerDto extends Document {
  name: string;
  date_of_birth?: Date;
  company_name?: string;
  anniversary_date?: Date;
  email?: string;
  phone_number: string;
  gst_no?: string;
  address?: string;
  assign_tag?: any;
  created_by?: Record<string, any>;
  converted_by: Record<string, any>;
  converted_date: Date;
  meta?: Record<string, any>;
}

export { CustomerDto };
