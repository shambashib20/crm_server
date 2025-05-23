import User from "../models/user.model";
import Role from "../models/role.model";
import Property from "../models/property.model";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";

export async function seedSuperadminUser() {
  const property = await Property.findOne({
    name: "MR Group of Colleges and Hospitals",
  });

  if (!property) {
    throw new Error(
      "❌ Property not found. Please run property seeder before creating superadmin."
    );
  }
  const ray_id = `ray-id-${uuidv4()}`;
  const superadminRole = await Role.findOne({ name: "Superadmin" });

  if (!superadminRole) {
    throw new Error(
      "❌ Superadmin role not found. Please run role-permission seeder first."
    );
  }

  const existingUser = await User.findOne({
    email: "admin@mrgroup.com",
    role: superadminRole._id,
  });

  // console.log("user", existingUser)

  if (existingUser) {
    console.log("ℹ️ Superadmin user already exists.");
    return;
  }

  const passwordHash = "superadmin@123";

  const user = await User.create({
    name: "MR Superadmin",
    email: "admin@mrgroup.com",
    phone_number: "9999999999",
    password: passwordHash,
    meta: {
      ray_id,
    },
    is_verified: true,
    reported: false,
    is_banned: false,
    role: superadminRole._id,
    property_id: property._id,
  });

  console.log(
    `✅ Superadmin user created and linked to MR Property (${property.name})`
  );
}
