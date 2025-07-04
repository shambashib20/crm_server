import Permission from "../models/permission.model";
import Role from "../models/role.model";

// TODO:  THIS SERVICE IS FOR OUR ADMIN PANEL AT MR! dON'T USE IT FOR CLIENT BASED WORKSPACES OR PROPERTIES.

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

export { _getAllPermissions, _getAllPermissionsByRole };
