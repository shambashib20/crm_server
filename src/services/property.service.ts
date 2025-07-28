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

    return property.logs;
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
    const sortedLogs = [...(property.logs || [])].sort(
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

    if (updatePayload.name && updatePayload.name !== property.name) {
      updates.push(
        `Name changed from '${property.name}' to '${updatePayload.name}'`
      );
      property.name = updatePayload.name;
    }
    if (
      updatePayload.description &&
      updatePayload.description !== property.description
    ) {
      updates.push(`Description updated`);
      property.description = updatePayload.description;
    }
    if (updatePayload.status && updatePayload.status !== property.status) {
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
      });
    }

    await property.save();

    return property;
  } catch (error: any) {
    throw new Error(`Failed to update property: ${error.message}`);
  }
};

export {
  _fetchPropertyLogs,
  _fetchPropertyDetails,
  _createPropertyForOnboarding,
  _updatePropertyById,
};
