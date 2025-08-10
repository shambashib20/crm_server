import Property from "../models/property.model";
import { LogStatus, PropertyDto, PropertyStatus } from "../dtos/property.dto";
import { Types } from "mongoose";
import Role from "../models/role.model";

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

    const unreadLogs = (property.logs || []).filter(
      (log: any) => !(log.meta && log.meta.readStatus === "READ")
    );

    const sortedLogs = [...unreadLogs].sort(
      (a: any, b: any) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return {
      ...property.toObject(),
      logs: sortedLogs,
    } as PropertyDto;
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

export {
  _fetchPropertyLogs,
  _fetchPropertyDetails,
  _createPropertyForOnboarding,
  _updatePropertyById,
  _markPropertyLogAsRead,
};
