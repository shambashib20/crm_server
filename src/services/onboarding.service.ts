import User from "../models/user.model";
import Property from "../models/property.model";
import Role from "../models/role.model";
import { v4 as uuidv4 } from "uuid";
import { LogStatus, PropertyStatus } from "../dtos/property.dto";

import Package from "../models/package.model";
import PurchaseRecordsModel from "../models/purchaserecords.model";
import { PurchaseStatus } from "../dtos/purchaserecords.dto";
import Client from "../models/client.model";

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
  orgDescription: string,
  selectedPlan: string = "free"
) => {
  const validRoles = new Set([
    "Superadmin",
    "Admin",
    "Lead Manager",
    "Telecaller",
  ]);

  if (!validRoles.has(roleName)) {
    throw new Error(`Unsupported role: ${roleName}`);
  }

  try {
    // 1️⃣ USER DUPLICATE CHECK
    const existingUser = await User.findOne({ $or: [{ email }, { name }] });
    if (existingUser) {
      throw new Error("User with same email or name already exists.");
    }

    // 2️⃣ RAY ID
    const existingClient = await Client.findOne({ name });
    const rayId =
      existingClient?.meta?.get("ray_id") || `ray-id-${uuidv4()}`;

    // 3️⃣ CREATE PROPERTY (ALWAYS)
    const newProperty = await Property.create({
      meta: {
        ray_id: rayId,
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

    // 4️⃣ ASSIGN FREE PLAN ONLY IF SELECTED
    if (!selectedPlan || selectedPlan === "free") {
      const pricingPlan = await Package.findOne({
        title: "Free Plan",
      }).populate("features");

      if (!pricingPlan) {
        throw new Error("Default pricing plan not found.");
      }

      const now = new Date();
      const validityInDays = pricingPlan.validity_in_days;
      const validity = new Date(
        now.getTime() + validityInDays * 24 * 60 * 60 * 1000
      );

      const activated_features = pricingPlan.features.map((f: any) => ({
        feature_id: f._id,
        title: f.title,
        limit: f.meta?.limit || 0,
        used: 0,
        validity,
        validity_in_days: validityInDays,
        validity_left_till_expiration: validityInDays,
      }));

      const purchaseRecord = await PurchaseRecordsModel.create({
        property_id: newProperty._id,
        package_id: pricingPlan._id,
        status: PurchaseStatus.COMPLETED,
        meta: {
          activated_features,
          source: "onboarding_free",
        },
      });

      newProperty?.meta?.set("active_package", purchaseRecord._id);
      await newProperty.save();
    }

    // 5️⃣ CREATE USER (ALWAYS)
    const role = await Role.findOne({ name: roleName });
    if (!role) {
      throw new Error(`Role '${roleName}' not found.`);
    }

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
        ray_id: rayId,
      },
    });

    return {
      user: newUser,
      property: newProperty,
    };
  } catch (error: any) {
    throw new Error(
      `Error creating user for organization: ${error.message}`
    );
  }
};



export { _createNewUserForOnboarding };
