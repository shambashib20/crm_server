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
import Lead from "../models/lead.model";
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
      meta: { ray_id: `ray-id-${uuidv4()}`, is_active: true },
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
  }).select("name meta");

  // Normalise meta Map → plain object so is_active is accessible
  return users.map((u: any) => {
    const metaObj =
      u.meta instanceof Map ? Object.fromEntries(u.meta) : u.meta || {};
    return {
      _id: u._id,
      name: u.name,
      is_active: metaObj.is_active !== false, // default true if not set
    };
  });
};

const _allPaginatedChatAgents = async (
  propertyId: Types.ObjectId,
  page = 1,
  limit = 10,
  filterActive?: boolean // undefined = all, true = active only, false = inactive only
) => {
  const chatAgentRole = await Role.findOne({ name: "Telecaller" });

  if (!chatAgentRole) {
    return {
      chatAgents: [],
      pagination: { total: 0, limit, currentPage: page, totalPages: 0 },
    };
  }

  const query: any = {
    role: chatAgentRole._id,
    property_id: propertyId,
  };

  if (filterActive === true) {
    query.$or = [{ "meta.is_active": true }, { "meta.is_active": { $exists: false } }];
  } else if (filterActive === false) {
    query["meta.is_active"] = false;
  }

  const total = await User.countDocuments(query);
  const totalPages = Math.ceil(total / limit);
  const skip = (page - 1) * limit;

  const chatAgents = await User.find(query)
    .select("name email phone_number meta createdAt")
    .skip(skip)
    .limit(limit)
    .sort({ createdAt: -1 })
    .lean();

  const enriched = chatAgents.map((u: any) => {
    const metaObj =
      u.meta instanceof Map ? Object.fromEntries(u.meta) : u.meta || {};
    return {
      ...u,
      is_active: metaObj.is_active !== false,
    };
  });

  return {
    chatAgents: enriched,
    pagination: { total, limit, currentPage: page, totalPages },
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

/**
 * Activate or deactivate an employee.
 * When deactivating, all their active leads are bulk-transferred to reassignToUserId.
 * Superadmin accounts cannot be deactivated.
 * Only roles superior to Telecaller (Superadmin, Admin, Lead Manager) may call this.
 *
 * Idempotent: concurrent calls with the same (userId, is_active) value are safe —
 * the atomic conditional update ensures only one request performs the state change;
 * subsequent identical requests return the current state without side-effects.
 */
const _toggleUserActiveStatus = async (
  targetUserId: Types.ObjectId,
  isActive: boolean,
  requestingUserId: Types.ObjectId,
  propertyId: Types.ObjectId,
  reassignToUserId?: Types.ObjectId
) => {
  const targetUser = await User.findById(targetUserId).populate<{
    role: { name: string };
  }>("role", "name");

  if (!targetUser) throw new Error("User not found.");
  if (targetUser.property_id?.toString() !== propertyId.toString())
    throw new Error("User does not belong to your property.");

  const targetRoleName = (targetUser.role as any)?.name;
  if (targetRoleName === "Superadmin")
    throw new Error("Cannot deactivate a Superadmin account.");

  // Atomic guard: only proceed if the current state differs from the requested state.
  // This makes the operation idempotent under concurrent calls — only one will win the
  // CAS (compare-and-swap) update; the rest find no matching document and return early.
  const stateChanged = await User.findOneAndUpdate(
    {
      _id: targetUserId,
      $or: [
        { "meta.is_active": { $ne: isActive } },
        { "meta.is_active": { $exists: false } },
      ],
    },
    { $set: { "meta.is_active": isActive } },
    { new: false }
  );

  if (!stateChanged) {
    // Already in the desired state — return current info without side-effects.
    return {
      userId: targetUserId,
      name: targetUser.name,
      is_active: isActive,
      leads_transferred: 0,
      already_in_state: true,
    };
  }

  // When deactivating, transfer all active leads to the new assignee
  let leadsTransferred = 0;
  if (!isActive) {
    if (!reassignToUserId)
      throw new Error(
        "reassign_to is required when deactivating a user — all their leads will be transferred."
      );

    const newAssignee = await User.findOne({
      _id: reassignToUserId,
      property_id: propertyId,
    });
    if (!newAssignee)
      throw new Error("Reassign target user not found in this property.");

    const result = await Lead.updateMany(
      {
        assigned_to: targetUserId,
        "meta.status": { $nin: ["ARCHIVED", "CONVERTED TO CUSTOMER"] },
      },
      {
        $set: {
          assigned_to: reassignToUserId,
          assigned_by: requestingUserId,
        },
        $push: {
          "meta.previous_assignees": {
            agent_id: targetUserId,
            unassigned_at: new Date(),
            unassigned_by: requestingUserId,
            reason: "user_deactivated",
          },
          logs: {
            title: "Lead reassigned — user deactivated",
            description: `Lead auto-transferred because the previous assignee was deactivated.`,
            status: "ACTION",
            meta: {
              previous_assignee: targetUserId,
              new_assignee: reassignToUserId,
              deactivated_by: requestingUserId,
            },
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      }
    );
    leadsTransferred = result.modifiedCount;
  }

  // Audit log on property
  await Property.findByIdAndUpdate(propertyId, {
    $push: {
      logs: {
        title: isActive ? "Employee Activated" : "Employee Deactivated",
        description: `User '${targetUser.name}' was ${isActive ? "activated" : "deactivated"} by admin. ${leadsTransferred} lead(s) transferred.`,
        status: LogStatus.ACTION,
        meta: {
          targetUserId,
          requestingUserId,
          leadsTransferred,
          reassignToUserId: reassignToUserId || null,
        },
      },
    },
  });

  return {
    userId: targetUserId,
    name: targetUser.name,
    is_active: isActive,
    leads_transferred: leadsTransferred,
    already_in_state: false,
  };
};

const _updateEmployeeDetails = async (
  targetUserId: Types.ObjectId,
  requestingUserId: Types.ObjectId,
  propertyId: Types.ObjectId,
  updates: { name?: string; email?: string; phone_number?: string }
) => {
  const targetUser = await User.findById(targetUserId).populate<{
    role: { name: string };
  }>("role", "name");

  if (!targetUser) throw new Error("User not found.");
  if (targetUser.property_id?.toString() !== propertyId.toString())
    throw new Error("User does not belong to your property.");

  const targetRoleName = (targetUser.role as any)?.name;
  if (targetRoleName === "Superadmin")
    throw new Error("Cannot edit a Superadmin account.");

  const { name, email, phone_number } = updates;

  if (!name && !email && !phone_number)
    throw new Error("At least one field (name, email, phone_number) is required.");

  const conflictQuery: any[] = [];
  if (name && name !== targetUser.name) conflictQuery.push({ name });
  if (email && email !== targetUser.email) conflictQuery.push({ email });

  if (conflictQuery.length) {
    const conflict = await User.findOne({
      $or: conflictQuery,
      _id: { $ne: targetUserId },
    });
    if (conflict) throw new Error("Another user with the same name or email already exists.");
  }

  const patch: Record<string, any> = {};
  if (name) patch.name = name.trim();
  if (email) patch.email = email.trim().toLowerCase();
  if (phone_number) patch.phone_number = phone_number.trim();

  const updatedUser = await User.findByIdAndUpdate(
    targetUserId,
    { $set: patch },
    { new: true }
  ).select("name email phone_number role property_id meta");

  const requestingUser = await User.findById(requestingUserId).select("name").lean();

  await Property.findByIdAndUpdate(propertyId, {
    $push: {
      logs: {
        title: "Employee Details Updated",
        description: `Details of '${targetUser.name}' updated by '${
          requestingUser?.name || "Unknown"
        }'. Changed fields: ${Object.keys(patch).join(", ")}.`,
        status: LogStatus.ACTION,
        meta: {
          targetUserId,
          requestingUserId,
          changedFields: patch,
        },
      },
    },
  });

  return updatedUser;
};

export {
  _getUserdetails,
  _createUserForOrganization,
  _allChatAgents,
  _uploadProfilePicture,
  _allPaginatedChatAgents,
  _toggleUserActiveStatus,
  _updateEmployeeDetails,
};
