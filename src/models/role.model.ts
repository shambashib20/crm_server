import { Schema, model, Document } from "mongoose";

import { RoleDto } from "../dtos/user.dto";

const roleSchema = new Schema<RoleDto & Document>(
  {
    meta: {
      type: Map,
      of: Schema.Types.Mixed,
      default: {},
    },
    name: {
      type: String,
    },
    description: {
      type: String,
    },
    permissions: {
      type: [Schema.Types.ObjectId],
      ref: "Permission",
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

const Role = model<RoleDto & Document>("Role", roleSchema);

export default Role;
