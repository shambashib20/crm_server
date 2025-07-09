import { Types } from "mongoose";

interface UserDto {
  meta?: {
    [key: string]: any;
  };
  _id: Types.ObjectId;
  name: string;
  email: string;
  phone_number: string;
  role: Types.ObjectId;
  email_verification_otp: string;
  otp_expiration: Date | null;
  password: string;
  is_verified: boolean;
  reported: boolean;
  is_banned: boolean;
  property_id: Types.ObjectId;
}

interface RoleDto {
  meta?: {
    [key: string]: any;
  };
  name: string;
  description?: string;
  permissions: Types.ObjectId[];
}

interface PermissionDto {
  meta?: {
    [key: string]: any;
  };
  name: string;
  description: string;
}

export { UserDto, RoleDto, PermissionDto };
