import { Types } from "mongoose";
import Permission from "../models/permission.model";
import Role from "../models/role.model";
import { PermissionDto } from "../dtos/user.dto";

// TODO:  THIS SERVICE IS FOR OUR ADMIN PANEL AT MR! dON'T USE IT FOR CLIENT BASED WORKSPACES OR PROPERTIES.

const _createPermission = async (name: string, description: string) => {
  if (!name || !description) {
    throw new Error("Name and description are required");
  }

  const existingPermission = await Permission.findOne({ name });
  if (existingPermission) {
    throw new Error("Permission already exists");
  }
  const permission = new Permission({ name, description });
  await permission.save();
  return permission;
};

const _getAllPermissions = async (page = 1, limit = 10) => {
  const skip = (page - 1) * limit;

  const [permissions, total] = await Promise.all([
    Permission.find().sort({ createdAt: -1 }).skip(skip).limit(limit),
    Permission.countDocuments(),
  ]);

  return {
    permissions,
    pagination: {
      total,
      currentPage: page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

const _getAllPermissionsByRole = async (roleKey: string) => {
  const role = await Role.findOne({
    $or: [{ name: roleKey }],
  }).populate("permissions");

  if (!role) {
    throw new Error("Role not found");
  }

  return role.permissions;
};

const _assignPermissionsToRole = async (
  roleKey: string | Types.ObjectId,
  permissionKeys: string[]
) => {
  if (!roleKey || !permissionKeys || !permissionKeys.length) {
    throw new Error("Role key and permissions are required.");
  }

  const role = await Role.findOne({
    $or: [{ _id: roleKey }, { name: roleKey }],
  });

  if (!role) {
    throw new Error("Role not found.");
  }

  const permissions = (await Permission.find({
    $or: permissionKeys.map((key) =>
      Types.ObjectId.isValid(key) ? { _id: key } : { name: key }
    ),
  })) as (PermissionDto & { _id: Types.ObjectId })[];

  if (permissions.length === 0) {
    throw new Error("No valid permissions found.");
  }

  const newPermissionIds = permissions.map((perm) => perm._id.toString());
  const existingPermissionIds = role.permissions.map((id) => id.toString());

  const mergedPermissionIds = Array.from(
    new Set([...existingPermissionIds, ...newPermissionIds])
  ).map((id) => new Types.ObjectId(id));

  role.permissions = mergedPermissionIds;
  await role.save();

  return {
    message: "Permissions assigned successfully.",
    roleId: role._id,
    totalPermissions: role.permissions.length,
  };
};

export {
  _getAllPermissions,
  _getAllPermissionsByRole,
  _createPermission,
  _assignPermissionsToRole,
};
