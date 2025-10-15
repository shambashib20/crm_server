import { Types } from "mongoose";

interface ClientDto extends Document {
  name: string;
  mobile_number: string;
  email: string;
  message: string;
  status: string;
  meta?: Record<string, any>;
}

export { ClientDto };
