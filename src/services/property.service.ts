import Property from "../models/property.model";
import { LogStatus, PropertyDto, PropertyStatus } from "../dtos/property.dto";
import { Types } from "mongoose";

import dotenv from "dotenv";
dotenv.config();

import Label from "../models/label.model";
import File from "../models/file.model";
import { encodePropertyId, randomString } from "../utils/api_key.util";
import PurchaseRecordsModel from "../models/purchaserecords.model";
import { PurchaseRecordsDto } from "../dtos/purchaserecords.dto";

const _uploadWorkspaceProfilePicture = async (
  fileUrl: string,
  propId: Types.ObjectId
) => {
  try {
    const existingProperty = await Property.findById(propId);
    if (!existingProperty) {
      throw new Error("No User found!");
    }

    const existingFile = await File.findOne({ file_url: fileUrl });
    if (!existingFile) {
      throw new Error("Profile picture can't be uploaded!");
    }

    const metaMap =
      existingProperty.meta instanceof Map
        ? Object.fromEntries(existingProperty.meta)
        : typeof existingProperty.meta === "object"
        ? existingProperty.meta
        : {};

    const updatedProperty = await Property.findByIdAndUpdate(
      propId,
      {
        meta: {
          ...metaMap,
          profile_picture_data: existingFile._id,
        },
      },
      { new: true }
    );

    return updatedProperty;
  } catch (error: any) {
    throw error;
  }
};

const _fetchPropertyLogs = async (propId: Types.ObjectId) => {
  try {
    const property = await Property.findById(propId, { logs: 1 });

    if (!property) {
      throw new Error("Property not found");
    }

    const unreadLogs = property.logs.filter(
      (log: any) => log.meta?.status !== "READ"
    );

    return unreadLogs;
  } catch (error: any) {
    throw new Error(`Failed to fetch logs: ${error.message}`);
  }
};

const _fetchPropertyDetails = async (propId: Types.ObjectId) => {
  try {
    const property = await Property.findById(propId)
      .populate("role", "name")
      .select("-__v -otp_expiration -email_verification_otp");

    if (!property) {
      throw new Error("Property not found");
    }

    let activePackageData: PurchaseRecordsDto | null = null;

    const activePackageId = property.meta?.get("active_package");

    if (activePackageId) {
      const raw = await PurchaseRecordsModel.findById(activePackageId).populate(
        {
          path: "package_id",
          populate: {
            path: "features",
            model: "Feature",
            select: "title description meta",
          },
        }
      );
      activePackageData = raw ? raw.toObject() : null;
    }

    const unreadLogs = (property.logs || []).filter(
      (log: any) => !(log.meta && log.meta.readStatus === "READ")
    );

    const sortedLogs = [...unreadLogs].sort(
      (a: any, b: any) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    if (property.meta instanceof Map) {
      const profilePictureId = property.meta.get("profile_picture_data");

      if (profilePictureId) {
        const fileData = await File.findById(profilePictureId);
        if (fileData) {
          const metaObj = Object.fromEntries(property.meta);
          metaObj.profile_picture_data = fileData;
          property.meta = metaObj as any;
        }
      } else {
        property.meta = Object.fromEntries(property.meta) as any;
      }
    }

    return {
      ...property.toObject(),
      meta: {
        ...(property.meta ? property.meta.toJSON?.() ?? property.meta : {}),
        active_package: activePackageData,
      },
      logs: sortedLogs,
    };
  } catch (error: any) {
    throw new Error(`Failed to fetch property details: ${error.message}`);
  }
};

const _createPropertyForOnboarding = async (
  name: string,
  description: string
) => {
  try {
    const existingProperty = await Property.findOne({
      name,
    });
    if (existingProperty) {
      throw new Error("Property with this name already exists");
    }

    const newProperty = new Property({
      name,
      description,
      usage_limits: 100,
      usage_count: 0,
      role: null,
      logs: [],
      is_verified: false,
      reported: false,
      is_banned: false,
      status: PropertyStatus.INACTIVE,
    });

    const logEntry = {
      title: `Property Created with name as ${newProperty.name}`,
      description: `${newProperty.name} got createdv successfully!`,
      status: LogStatus.SYSTEM,
      meta: {
        createdBy: "New User",
        action: "Create Property",
      },
    };

    await newProperty.save();
    return newProperty;
  } catch (error: any) {
    throw new Error(`Failed to create property: ${error.message}`);
  }
};

const _updatePropertyById = async (
  propId: Types.ObjectId,
  updatePayload: Partial<Pick<PropertyDto, "name" | "description" | "status">>,
  performedBy: string
) => {
  try {
    const now = new Date();
    const property = await Property.findById(propId);

    if (!property) {
      throw new Error("Property not found");
    }

    const updates: string[] = [];

    if (
      typeof updatePayload.name === "string" &&
      updatePayload.name !== property.name
    ) {
      updates.push(
        `Name changed from '${property.name}' to '${updatePayload.name}'`
      );
      property.name = updatePayload.name;
    }

    if (
      typeof updatePayload.description === "string" &&
      updatePayload.description !== property.description
    ) {
      updates.push("Description updated");
      property.description = updatePayload.description;
    }

    if (
      typeof updatePayload.status === "string" &&
      updatePayload.status !== property.status
    ) {
      updates.push(
        `Status changed from '${property.status}' to '${updatePayload.status}'`
      );
      property.status = updatePayload.status;
    }

    if (updates.length > 0) {
      property.logs.push({
        title: "Property Updated",
        description: updates.join(", "),
        status: LogStatus.INFO,
        meta: {
          updatedBy: performedBy,
          action: "Update Property",
        },
        createdAt: now,
      } as any);
    }

    await property.save();

    return property;
  } catch (error: any) {
    throw new Error(`Failed to update property: ${error.message}`);
  }
};

const _markPropertyLogAsRead = async (
  propId: Types.ObjectId,
  logId: Types.ObjectId
) => {
  try {
    const property = await Property.findById(propId);

    if (!property) {
      throw new Error("Property not found");
    }

    const log = property.logs.find(
      (log) => log._id?.toString() === logId.toString()
    );

    if (!log) {
      throw new Error("Log not found in property");
    }

    log.meta = {
      ...log.meta,
      readStatus: "READ",
      readAt: new Date(),
    };

    await property.save();
    return log;
  } catch (error: any) {
    throw new Error(`Failed to mark log as read: ${error.message}`);
  }
};

const _createApiKeyService = async (
  propertyId: string,
  keyData: {
    purpose: string;
    expiry_at?: Date;
    label_id: Types.ObjectId;
  }
) => {
  const property = await Property.findById(propertyId);
  if (!property) {
    throw new Error("Property not found");
  }

  const usageLimit = property.usage_limits || 0;
  const usageCount = property.usage_count || 0;

  if (usageLimit - usageCount < 20) {
    throw new Error(
      "Not enough credits to generate API Key (requires 20 credits)"
    );
  }

  const encodedId = encodePropertyId(propertyId);
  const prefix = randomString(8);
  const suffix = randomString(8);
  const apiKey = `${prefix}${encodedId}${suffix}`;

  const title = `${keyData.purpose} API Key`;
  const description = `API key for ${keyData.purpose}`;

  const existingLabel = await Label.findById(keyData.label_id);
  if (!existingLabel) {
    throw new Error("Label not found");
  }

  const newKey = {
    title,
    description,
    value: apiKey,
    created_at: new Date(),
    expiry_at: keyData.expiry_at || null,
    purpose: keyData.purpose,
    status: "ACTIVE" as const,
    label_id: existingLabel._id,
  };

  const logEntry = {
    title: "API Key Created",
    description: `New API Key created for purpose: ${keyData.purpose}`,
    created_at: new Date(),
    meta: {
      api_key_title: title,
      api_key_purpose: keyData.purpose,
    },
  };

  const updatedProperty = await Property.findByIdAndUpdate(
    propertyId,
    {
      $inc: { usage_count: 20 },
      $push: { "meta.keys": newKey, logs: logEntry },
    },
    { new: true }
  );

  return { property: updatedProperty, apiKey };
};

// CUSTOMER LEADS WHO NOT YET REGISTERED WITH US! jUST HAVE RAISED PRODUCT REQUSTS

const _fetchPaginatedProperties = async (
  page: number = 1,
  limit: number = 10
) => {
  const skip = (page - 1) * limit;

  const [properties, total] = await Promise.all([
    Property.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Property.countDocuments(),
  ]);

  const totalPages = Math.ceil(total / limit);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  return {
    properties,
    pagination: {
      totalItems: total,
      totalPages,
      currentPage: page,
      limit,
      hasNextPage,
      hasPrevPage,
    },
  };
};

const _fetchApiKeysService = async (propertyId: string) => {
  const property = await Property.findById(propertyId);
  if (!property) {
    throw new Error("Property not found");
  }

  const keys: any[] = property.meta?.get("keys") || [];

  // Populate label details for each key
  const populated = await Promise.all(
    keys.map(async (key: any) => {
      const label = key.label_id
        ? await Label.findById(key.label_id).select("title description meta").lean()
        : null;
      return { ...key, label };
    })
  );

  return populated;
};

export {
  _fetchPropertyLogs,
  _fetchPropertyDetails,
  _createPropertyForOnboarding,
  _updatePropertyById,
  _markPropertyLogAsRead,
  _createApiKeyService,
  _fetchPaginatedProperties,
  _uploadWorkspaceProfilePicture,
  _fetchApiKeysService,
};
