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

    return property as PropertyDto;
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

export {
  _fetchPropertyLogs,
  _fetchPropertyDetails,
  _createPropertyForOnboarding,
};
