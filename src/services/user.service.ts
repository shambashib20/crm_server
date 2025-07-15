import { Types } from "mongoose";
import User from "../models/user.model";
import Role from "../models/role.model";
import { v4 as uuidv4 } from "uuid";
import Property from "../models/property.model";
import { LogStatus } from "../dtos/property.dto";
import File from "../models/file.model";

const _getUserdetails = async (userId: Types.ObjectId) => {
  const user = await User.findById(userId)
    .populate({
      path: "role",
      populate: {
        path: "permissions",
        model: "Permission",
      },
    })
    .select("-password");

  if (!user) {
    throw new Error("No user details found!");
  }

  if (user.meta instanceof Map) {
    const profilePictureId = user.meta.get("profile_picture_data");

    if (profilePictureId) {
      const fileData = await File.findById(profilePictureId);
      if (fileData) {
        const metaObj = Object.fromEntries(user.meta);
        metaObj.profile_picture_data = fileData;
        user.meta = metaObj as any;
      }
    } else {
      user.meta = Object.fromEntries(user.meta) as any;
    }
  }

  return user;
};

const _createUserForOrganization = async (
  roleName: string,
  name: string,
  email: string,
  phone_number: string,
  property_id: Types.ObjectId,
  userId: Types.ObjectId
) => {
  const validRoles = new Set(["Admin", "Lead Manager", "Chat Agent"]);
  if (!validRoles.has(roleName)) {
    throw new Error(`Unsupported role: ${roleName}`);
  }

  try {
    const [role, superAdmin, property] = await Promise.all([
      Role.findOne({ name: roleName }),
      User.findById(userId).populate("role"),
      Property.findById(property_id, "usage_limits usage_count"),
    ]);

    if (!role) throw new Error(`Role '${roleName}' not found.`);
    if (!property) throw new Error(`Property '${property_id}' not found.`);

    // ❗ Check for duplicate email or name
    const existingUser = await User.findOne({
      $or: [{ email }, { name }],
    });

    if (existingUser) {
      throw new Error("User with same email or name already exists.");
    }

    const isSuperadmin =
      !!superAdmin &&
      typeof superAdmin.role === "object" &&
      superAdmin.role !== null &&
      "name" in superAdmin.role &&
      (superAdmin.role as { name: string }).name === "Superadmin";
    if (!isSuperadmin && property.usage_count >= property.usage_limits) {
      throw new Error("User creation limit exceeded for this property.");
    }

    // ✅ Create new user
    const user = await User.create({
      name,
      email,
      password: `${roleName}@123`,
      phone_number,
      meta: { ray_id: `ray-id-${uuidv4()}` },
      role: role._id,
      property_id,
    });

    // ✅ Update logs + usage count
    const updateOps: any = {
      $push: {
        logs: {
          title: "User Created",
          description: `User named '${name}' with role (${roleName}) created by '${
            superAdmin?.name || "Unknown"
          }'.`,
          status: LogStatus.ACTION,
          meta: {
            source: "user_action",
            createdBy: superAdmin?.name || "unknown",
          },
        },
      },
    };

    if (!isSuperadmin) {
      updateOps.$inc = { usage_count: 1 };
    }

    await Property.findByIdAndUpdate(property_id, updateOps);

    return user;
  } catch (err: any) {
    await Property.findByIdAndUpdate(property_id, {
      $push: {
        logs: {
          title: "User Creation Failed",
          description: `Error creating '${name}' (${roleName}): ${err.message}`,
          status: LogStatus.ERROR,
          meta: { name, email, phone_number, roleName, createdBy: userId },
        },
      },
    });
    throw err;
  }
};

const _allChatAgents = async (propertyId: Types.ObjectId) => {
  const chatAgentRole = await Role.findOne({ name: "Chat Agent" });

  if (!chatAgentRole) {
    return [];
  }

  const users = await User.find({
    role: chatAgentRole._id,
    property_id: propertyId,
  }).select("name");

  return users;
};

const _uploadProfilePicture = async (
  fileUrl: string,
  userId: Types.ObjectId
) => {
  try {
    const existingUser = await User.findById(userId);
    if (!existingUser) {
      throw new Error("No User found!");
    }

    const existingFile = await File.findOne({ file_url: fileUrl });
    if (!existingFile) {
      throw new Error("Profile picture can't be uploaded!");
    }

    const metaMap =
      existingUser.meta instanceof Map
        ? Object.fromEntries(existingUser.meta)
        : typeof existingUser.meta === "object"
        ? existingUser.meta
        : {};

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        meta: {
          ...metaMap,
          profile_picture_data: existingFile._id,
        },
      },
      { new: true }
    );
  } catch (error: any) {
    throw error;
  }
};

export {
  _getUserdetails,
  _createUserForOrganization,
  _allChatAgents,
  _uploadProfilePicture,
};
