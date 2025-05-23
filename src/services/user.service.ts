import { Types } from "mongoose";
import User from "../models/user.model";
import Role from "../models/role.model";

const _getUserdetails = async (userId: Types.ObjectId) => {
  const user = await User.findById(userId)
    .populate({
      path: "role",
      populate: {
        path: "permissions",
        model: "Permission",
      },
    })
    .select("-password");

  if (!user) {
    throw new Error("No user details found!");
  }

  return user;
};

const _createUserForOrganization = async (
  roleName: string,
  name: string,
  email: string
) => {
  const existingRole = await Role.findOne({ name: roleName });
  const newUser = await User.create({
    name,
    email,
    role: existingRole?._id,
  });
};

export { _getUserdetails };
