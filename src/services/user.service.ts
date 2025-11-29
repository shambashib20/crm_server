import { Types } from "mongoose";
import User from "../models/user.model";
import Role from "../models/role.model";
import { v4 as uuidv4 } from "uuid";
import Property from "../models/property.model";
import { LogStatus } from "../dtos/property.dto";
import File from "../models/file.model";
import { teleCallersCache } from "../cache/telecallers.cache";
import NodeCache from "node-cache";
import axios from "axios";
import { WhatsAppDevice } from "../models/wapmonkeyusers.model";
const TELECALLER_ROLE_NAME = "Telecaller";

const userCache = new NodeCache({
  stdTTL: 300,
});

const WAPMONKEY_API = "https://api.wapmonkey.com/v1/sendmessage";
const API_KEY = process.env.WAPMONKEY_AUTH_TOKEN!;

const OFFICE_DEVICE_NAME = "Office";

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
      Property.findById(property_id, "name usage_limits usage_count"),
    ]);

    console.log("Property name:", property?.name);

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

    const rawPassword = password?.trim() || `${roleName}@123`;

    
    let user = await User.create({
      name,
      email,
      password: rawPassword,
      phone_number,
      meta: { ray_id: `ray-id-${uuidv4()}` },
      role: role._id,
      property_id,
    });


    if (roleName === "Telecaller") {
      console.log("🔍 Searching WhatsApp device for Telecaller", phone_number);

      const userDevice = await WhatsAppDevice.findOne({
        mobile_no: phone_number,
      });

      if (userDevice) {
        console.log("📌 WhatsApp device found → Attaching to user's meta");

        await User.findByIdAndUpdate(user._id, {
          $set: { "meta.whatsapp_device": userDevice },
        });


        user = (await User.findById(user._id)) || user;
      }


      const officeDevice = await WhatsAppDevice.findOne({
        device_name: OFFICE_DEVICE_NAME,
      });

      if (!officeDevice) {
        console.error(
          "❌ Office device not found! Cannot send WhatsApp message."
        );
      } else {
        console.log("📨 Sending WhatsApp credentials to telecaller...");

        const message = `
Welcome to ETC CRM 🎉 (for testing)

Your login details:

Email: ${email}
Password: ${rawPassword}

Company Name: ${property.name}

You can access the CRM here: (Ignore link for testing)
      `;

        try {
          await axios.post(
            WAPMONKEY_API,
            {
              message,
              media: [],
              numbers: phone_number,
              device_token: officeDevice.u_device_token,
            },
            { headers: { Authorization: API_KEY } }
          );

          console.log(
            "✅ WhatsApp message sent successfully to:",
            phone_number
          );
        } catch (err: any) {
          console.error("❌ Failed sending WhatsApp message:", err.message);
        }
      }
    }


    const updateOps: any = {
      $push: {
        logs: {
          title: "User Created",
          description: `User '${name}' (role: ${roleName}) created by '${
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

    if (!isSuperadmin) updateOps.$inc = { usage_count: 1 };

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
  const chatAgentRole = await Role.findOne({ name: "Telecaller" });

  if (!chatAgentRole) {
    return [];
  }

  const users = await User.find({
    role: chatAgentRole._id,
    property_id: propertyId,
  }).select("name");

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
