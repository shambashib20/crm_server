import { Types } from "mongoose";
import User from "../models/user.model";
import Role from "../models/role.model";
import { v4 as uuidv4 } from "uuid";
import Property from "../models/property.model";
import { LogStatus } from "../dtos/property.dto";
import File from "../models/file.model";
import { teleCallersCache } from "../cache/telecallers.cache";
import NodeCache from "node-cache";
const TELECALLER_ROLE_NAME = "Telecaller";

const userCache = new NodeCache({
  stdTTL: 300,
});

const _getUserdetails = async (userId: Types.ObjectId) => {
  const cacheKey = userId.toString();
  
  const cached = userCache.get(cacheKey);
  if (cached) {
    return cached;
  }
  
  let user: any = await User.findById(userId)
    .select("-password")
    .populate({
      path: "role",
      populate: {
        path: "permissions",
        model: "Permission",
      },
    })
    .lean();

  if (!user) {
    throw new Error("No user details found!");
  }

  if (user.meta instanceof Map) {
    user.meta = Object.fromEntries(user.meta);
  }

  if (user.meta?.profile_picture_data) {
    const fileId = user.meta.profile_picture_data;

    const fileData = await File.findById(fileId).lean();

    user.meta.profile_picture_data = fileData || null;
  }

  userCache.set(cacheKey, user);
  return user;
};

const _createUserForOrganization = async (
  roleName: string,
  name: string,
  email: string,
  phone_number: string,
  password: string,
  property_id: Types.ObjectId,
  userId: Types.ObjectId
) => {
  const validRoles = new Set(["Admin", "Lead Manager", "Telecaller"]);
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

    const user = await User.create({
      name,
      email,
      password: password?.trim() || `${roleName}@123`,
      phone_number,
      meta: { ray_id: `ray-id-${uuidv4()}` },
      role: role._id,
      property_id,
    });

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
  const cacheKey = `chat_agents:${propertyId}`;
  let telecallerRoleId: Types.ObjectId | null = null;
  const cached = teleCallersCache.get(cacheKey);

  if (cached) {
    // console.log("CACHE HIT for", cacheKey);
    return cached;
  }

  if (!telecallerRoleId) {
    const role = await Role.findOne({ name: TELECALLER_ROLE_NAME })

      .select("_id")
      .exec();

    if (!role) return [];

    telecallerRoleId = role._id as Types.ObjectId;
  }

  const users = await User.find(
    { role: telecallerRoleId, property_id: propertyId },
    { name: 1 }
  )
    .lean()
    .exec();

  teleCallersCache.set(cacheKey, users);

  return users;
};

const _allPaginatedChatAgents = async (
  propertyId: Types.ObjectId,
  page = 1,
  limit = 10
) => {
  const chatAgentRole = await Role.findOne({ name: "Telecaller" });

  if (!chatAgentRole) {
    return {
      chatAgents: [],
      pagination: {
        total: 0,
        limit,
        currentPage: page,
        totalPages: 0,
      },
    };
  }

  const query = {
    role: chatAgentRole._id,
    property_id: propertyId,
  };

  const total = await User.countDocuments(query);
  const totalPages = Math.ceil(total / limit);
  const skip = (page - 1) * limit;

  const chatAgents = await User.find(query)
    .select("name email phone_number createdAt")
    .skip(skip)
    .limit(limit)
    .sort({ createdAt: -1 });

  return {
    chatAgents,
    pagination: {
      total,
      limit,
      currentPage: page,
      totalPages,
    },
  };
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

    return updatedUser;
  } catch (error: any) {
    throw error;
  }
};

export {
  _getUserdetails,
  _createUserForOrganization,
  _allChatAgents,
  _uploadProfilePicture,
  _allPaginatedChatAgents,
};
