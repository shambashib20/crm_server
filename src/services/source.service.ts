import { Types } from "mongoose";

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
    property_id: new Types.ObjectId(propId),
    role: superadminRole._id,
  });

  if (!existingSuperadmin) {
    throw new Error("Superadmin not found for the provided property");
  }
  const source = await Source.create({
    title,
    property_id: propId,
    description,
    meta,
  });

  await Property.findByIdAndUpdate(
    propId,
    {
      $push: {
        logs: {
          title: "Source Created",
          description: `A new source with this title: ${title} has been created.`,
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

const _getAllSources = async (
  propId: Types.ObjectId,
  page: number = 1,
  limit: number = 10
) => {
  const skip = (page - 1) * limit;

  const [sources, total] = await Promise.all([
    Source.find({ property_id: propId })
      .lean()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec(),
    Source.countDocuments({ property_id: propId }).exec(),
  ]);

  const totalPages = Math.ceil(total / limit);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  return {
    sources,
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

const _updateSource = async (
  propId: Types.ObjectId,
  sourceId: Types.ObjectId,
  updates: Partial<{
    title: string;
    description: string;
    meta: any;
  }>
) => {
  const source = await Source.findOneAndUpdate(
    {
      _id: sourceId,
      property_id: propId,
    },
    {
      $set: updates,
    },
    {
      new: true,
    }
  );

  if (!source) {
    throw new Error("Source not found for the given property");
  }

  // Optional: Log the update
  const superadminRole = await Role.findOne({ name: "Superadmin" });
  if (superadminRole) {
    const superadmin = await User.findOne({
      property_id: propId,
      role: superadminRole._id,
    });

    if (superadmin) {
      await Property.findByIdAndUpdate(propId, {
        $push: {
          logs: {
            title: "Source Updated",
            description: `Source with title "${source.title}" has been updated.`,
            status: LogStatus.ACTION,
            meta: {
              source_id: source._id,
              updated_by: superadmin._id,
            },
          },
        },
      });
    }
  }

  return source;
};

const _deleteSource = async (
  propId: Types.ObjectId,
  sourceId: Types.ObjectId
) => {
  const source = await Source.findOneAndDelete({
    _id: sourceId,
    property_id: propId,
  });

  if (!source) {
    throw new Error("Source not found for the given property");
  }

  const superadminRole = await Role.findOne({ name: "Superadmin" });
  if (superadminRole) {
    const superadmin = await User.findOne({
      property_id: propId,
      role: superadminRole._id,
    });

    if (superadmin) {
      await Property.findByIdAndUpdate(propId, {
        $push: {
          logs: {
            title: "Source Deleted",
            description: `Source with title "${source.title}" has been deleted.`,
            status: LogStatus.ACTION,
            meta: {
              source_id: source._id,
              deleted_by: superadmin._id,
            },
          },
        },
      });
    }
  }

  return source;
};

export { _createSource, _getAllSources, _updateSource, _deleteSource };
