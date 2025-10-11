import User from "../models/user.model";
import Property from "../models/property.model";
import Role from "../models/role.model";
import { v4 as uuidv4 } from "uuid";
import { LogStatus, PropertyStatus } from "../dtos/property.dto";

import Package from "../models/package.model";
import PurchaseRecordsModel from "../models/purchaserecords.model";
import { PurchaseStatus } from "../dtos/purchaserecords.dto";

// const _createNewUserForOnboarding = async (
//   roleName: string,
//   name: string,
//   email: string,
//   phone_number: string,
//   password: string,
//   orgName: string,
//   orgDescription: string
// ) => {
//   const validRoles = new Set([
//     "Superadmin",
//     "Admin",
//     "Lead Manager",
//     "Chat Agent",
//   ]);
//   if (!validRoles.has(roleName)) {
//     throw new Error(`Unsupported role: ${roleName}`);
//   }

//   try {
//     const existingUser = await User.findOne({
//       $or: [{ email }, { name }],
//     });
//     if (existingUser) {
//       throw new Error("User with same email or name already exists.");
//     }

//     const pricingPlans = await Package.findOne({
//       title: "Free Plan",
//     }).populate("features");

//     if (!pricingPlans) {
//       throw new Error("Default pricing plan not found.");
//     }

//     const newProperty = new Property({
//       meta: {
//         ray_id: `ray-id-${uuidv4()}`,
//       },
//       name: orgName,
//       description: orgDescription,
//       usage_limits: 100,
//       usage_count: 0,
//       role: null,
//       logs: [
//         {
//           title: `Property Created with name as ${orgName}`,
//           description: `${orgName} got created successfully!`,
//           status: LogStatus.INFO,
//           meta: {
//             createdBy: "New User",
//             action: "Create Property",
//           },
//         },
//       ],
//       is_verified: false,
//       reported: false,
//       is_banned: false,
//       status: PropertyStatus.ACTIVE,
//     });

//     await newProperty.save();

//     const activated_features = pricingPlans.features.map((f: any) => ({
//       feature_id: f._id,
//       title: f.title,
//       limit: f.meta?.limit || 0,
//       usage: 0,
//     }));

//     const newPurchaseRecord = new PurchaseRecordsModel({
//       property_id: newProperty._id,
//       package_id: pricingPlans._id,
//       status: PurchaseStatus.COMPLETED,
//       meta: {
//         activated_features,
//       },
//     });

//     await newPurchaseRecord.save();

//     const updatedProperty = await Property.findByIdAndUpdate(
//       newProperty._id,
//       {
//         $set: {
//           "meta.active_package": newPurchaseRecord._id,
//         },
//       },
//       { new: true }
//     );

//     const role = await Role.findOne({
//       name: roleName,
//     });

//     if (!role) {
//       throw new Error(`Role '${roleName}' not found.`);
//     }

//     const newUser = new User({
//       name,
//       email,
//       phone_number,
//       password,
//       role: role._id,
//       property_id: updatedProperty?._id,
//       meta: {
//         onboardingCompleted: false,
//         onboardingStep: 1,
//         createdAt: new Date(),
//         ray_id: `ray-id-${uuidv4()}`,
//       },
//     });

//     await newUser.save();

//     return {
//       user: newUser,
//       property: updatedProperty,
//     };
//   } catch (error: any) {
//     throw new Error(`Error creating user for organization: ${error.message}`);
//   }
// };

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
    // --- Check if user already exists ---
    const existingUser = await User.findOne({ $or: [{ email }, { name }] });
    if (existingUser)
      throw new Error("User with same email or name already exists.");

    // --- Get default package with features ---
    const pricingPlan = await Package.findOne({ title: "Free Plan" }).populate(
      "features"
    );
    if (!pricingPlan) throw new Error("Default pricing plan not found.");

    // --- Prepare activated features for this property ---
    const activated_features = pricingPlan.features.map((f: any) => ({
      feature_id: f._id,
      title: f.title,
      limit: f.meta?.limit || 0,
      used: 0, // initial usage
    }));

    
    const newProperty = await Property.create({
      meta: {
        ray_id: `ray-id-${uuidv4()}`,
        active_package: null, 
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
          meta: { createdBy: "New User", action: "Create Property" },
        },
      ],
      is_verified: false,
      reported: false,
      is_banned: false,
      status: PropertyStatus.ACTIVE,
    });

    const newPurchaseRecord = await PurchaseRecordsModel.create({
      property_id: newProperty._id,
      package_id: pricingPlan._id,
      status: PurchaseStatus.COMPLETED,
      meta: { activated_features },
    });

    if (!newProperty.meta) {
      newProperty.meta = new Map();
    }
    newProperty.meta.set("active_package", newPurchaseRecord._id);
    await newProperty.save(); 

    
    const role = await Role.findOne({ name: roleName });
    if (!role) throw new Error(`Role '${roleName}' not found.`);

    const newUser = await User.create({
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

    return {
      user: newUser,
      property: newProperty,
    };
  } catch (error: any) {
    throw new Error(`Error creating user for organization: ${error.message}`);
  }
};


export { _createNewUserForOnboarding };
