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
  name: string;
  description?: string;
  permissions: Types.ObjectId[];
}

interface PermissionDto {
  name: string;
  description: string;
}

export { UserDto, RoleDto, PermissionDto };
