// models/Campaign.model.ts
import { Schema, model, Document } from "mongoose";
import { PermissionDto } from "../dtos/user.dto";

export interface PermissionDocument extends PermissionDto, Document {}

const permissionSchema = new Schema<PermissionDto & Document>(
  {
    meta: {
      type: Map,
      of: Schema.Types.Mixed,
      default: {},
    },
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

const Permission = model<PermissionDto & Document>(
  "Permission",
  permissionSchema
);

export default Permission;
