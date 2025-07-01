import { Types } from "mongoose";
import Lead from "../models/lead.model";
import Property from "../models/property.model";
import User from "../models/user.model";
import { LogStatus } from "../dtos/property.dto";
import Role from "../models/role.model";
import Source from "../models/source.model";

const _createSource = async (
  title: string,
  description: string,
  meta: any,
  propId: Types.ObjectId
) => {
  const superadminRole = await Role.findOne({ name: "Superadmin" });
  if (!superadminRole) {
    throw new Error("Superadmin role not found");
  }

  const existingSuperadmin = await User.findOne({
    property_id: propId,
    role: superadminRole._id,
  });

  if (!existingSuperadmin) {
    throw new Error("Superadmin not found for the provided property");
  }
  const source = await Source.create({
    title,
    propId,
    description,
    meta,
  });

  await Property.findByIdAndUpdate(
    propId,
    {
      $push: {
        logs: {
          title: "Source Created",
          description: `A new source with this ${title} has been created.`,
          status: LogStatus.ACTION,
          meta: {
            source_id: source._id,
            created_by: existingSuperadmin._id,
          },
        },
      },
    },
    { new: true }
  );

  return source;
};

export { _createSource };
