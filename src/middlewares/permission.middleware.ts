import { Request, Response, NextFunction } from "express";

import Permission from "../models/permission.model";

const PermissionMiddleware = (requiredPermission: string) => {
  return async (req: any, res: any, next: NextFunction) => {
    try {
      const user = req.user;

      if (!user || !user.role) {
        return res
          .status(403)
          .json({ message: "Access denied: No role found." });
      }

      // User.role is populated in AuthMiddleware
      const role = user.role;

      const permissionIds = Array.isArray(role.permissions)
        ? role.permissions
        : [];

      if (permissionIds.length === 0) {
        return res
          .status(403)
          .json({ message: "Access denied: No permissions assigned." });
      }

      const permissions = await Permission.find({
        _id: { $in: permissionIds },
      });
      const permissionNames = permissions.map((p) => p.name);

      if (!permissionNames.includes(requiredPermission)) {
        return res
          .status(403)
          .json({ message: "Access denied: Permission not granted." });
      }

      next();
    } catch (error: any) {  
      console.error("PermissionMiddleware error:", error);
      return res
        .status(500)
        .json({ message: "Internal server error", error: error.message });
    }
  };
};

export default PermissionMiddleware;
