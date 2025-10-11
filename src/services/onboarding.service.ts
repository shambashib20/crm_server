import User from "../models/user.model";
import Property from "../models/property.model";
import Role from "../models/role.model";

import { Types } from "mongoose";
import { v4 as uuidv4 } from "uuid";
import {
  Log,
  LogStatus,
  PropertyDto,
  PropertyStatus,
} from "../dtos/property.dto";
import Permission from "../models/permission.model";
import { PermissionDocument } from "../models/permission.model";
import Package from "../models/package.model";

const _createNewUserForOnboarding = async (
  roleName: string,
  name: string,
  email: string,
  phone_number: string,
  password: string,
  orgName: string,
  orgDescription: string
) => {
  const validRoles = new Set([
    "Superadmin",
    "Admin",
    "Lead Manager",
    "Chat Agent",
  ]);
  if (!validRoles.has(roleName)) {
    throw new Error(`Unsupported role: ${roleName}`);
  }
  try {
    const existingUser = await User.findOne({
      $or: [{ email }, { name }],
    });
    if (existingUser) {
      throw new Error("User with same email or name already exists.");
    }

    const pricingPlans = await Package.findOne({
      title: "Free Plan",
    });

    if (!pricingPlans) {
      throw new Error("Default pricing plan not found.");
    }

    const newProperty = new Property({
      meta: {       
        ray_id: `ray-id-${uuidv4()}`, 
        active_package: pricingPlans._id
      },
      name: orgName,
      description: orgDescription,
      usage_limits: 100,
      usage_count: 0,
      role: null,
      logs: [
        {
          title: `Property Created with name as ${orgName}`,
          description: `${orgName} got created successfully!`,
          status: LogStatus.INFO,
          meta: {
            createdBy: "New User",
            action: "Create Property",
          },
        },
      ],
      is_verified: false,
      reported: false,
      is_banned: false,
      status: PropertyStatus.ACTIVE,
    });
    await newProperty.save();
    const role = await Role.findOne({
      name: roleName,
    });

    if (!role) {
      throw new Error(`Role '${roleName}' not found.`);
    }

    const newUser = new User({
      name,
      email,
      phone_number,
      password,
      role: role._id,
      property_id: newProperty._id,
      meta: {
        onboardingCompleted: false,
        onboardingStep: 1,
        createdAt: new Date(),
        ray_id: `ray-id-${uuidv4()}`,
      },
    });

    await newUser.save();

    return {
      user: newUser,
      property: newProperty,
    };
  } catch (error: any) {
    throw new Error(`Error creating user for organization: ${error.message}`);
  }
};

export { _createNewUserForOnboarding };
