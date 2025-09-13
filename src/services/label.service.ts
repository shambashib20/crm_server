import { Types } from "mongoose";

import Label from "../models/label.model";

import Property from "../models/property.model";
import { LabelDto } from "../dtos/label.dto";
import { LogStatus } from "../dtos/property.dto";
import Role from "../models/role.model";
import User from "../models/user.model";

const _createLabelInProperty = async (
  propId: Types.ObjectId,
  title: string,
  description: string
) => {
  const now = new Date();
  const existingLabel = await Label.findOne({
    title: { $regex: new RegExp(`^${title}$`, "i") },
    property_id: propId,
  });

  if (existingLabel) {
    throw new Error(
      `Label with title "${title}" already exists in this property.`
    );
  }

  const newStatus = new Label({
    title,
    description,
    property_id: propId,
    meta: {
      is_active: true,
    },
  });

  await Property.findByIdAndUpdate(
    propId,
    {
      $inc: { usage_count: 1 },
      $push: {
        logs: {
          title: "A New Label created!",
          description: `A new label named (${newStatus.title}) was created!`,
          status: LogStatus.ACTION,
          meta: { statusId: newStatus._id },
          createdAt: now,
          updatedAt: now,
        },
      },
    },
    { new: true }
  );

  await newStatus.save();

  return newStatus;
};

const _fetchLabelsInProperty = async (propId: Types.ObjectId) => {
  const labels = await Label.find({
    property_id: propId,
  });

  const property = await Property.findOne({
    _id: propId,
  });

  if (!labels) {
    throw new Error(`No labels found for ${property?.name}!`);
  }

  return labels;
};

const _fetchPaginatedLabels = async (
  propId: Types.ObjectId,
  page: number = 1,
  limit: number = 10
) => {
  const skip = (page - 1) * limit;

  const [labels, total] = await Promise.all([
    Label.find({ property_id: propId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate({
        path: "meta.assigned_agents.agent_id",
        model: User,
        select: "name email", 
      }),
    Label.countDocuments({ property_id: propId }),
  ]);

  const totalPages = Math.ceil(total / limit);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  return {
    labels,
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


const _updateLabel = async (
  propId: Types.ObjectId,
  labelId: Types.ObjectId,
  updates: Partial<{
    title: string;
    description: string;
    meta: any;
  }>
) => {
  const label = await Label.findOneAndUpdate(
    {
      _id: labelId,
      property_id: propId,
    },
    {
      $set: updates,
    },
    {
      new: true,
    }
  );

  if (!label) {
    throw new Error("label not found for the given property");
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
            title: "Label Updated",
            description: `Label with title "${label.title}" has been updated.`,
            status: LogStatus.ACTION,
            meta: {
              label_id: label._id,
              updated_by: superadmin._id,
            },
          },
        },
      });
    }
  }

  return label;
};

const _deleteLabel = async (
  propId: Types.ObjectId,
  labelId: Types.ObjectId
) => {
  const label = await Label.findOneAndDelete({
    _id: labelId,
    property_id: propId,
  });

  if (!label) {
    throw new Error("Label not found for the given property");
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
            title: "Label Deleted",
            description: `Label with title "${label.title}" has been deleted.`,
            status: LogStatus.ACTION,
            meta: {
              label_id: label._id,
              deleted_by: superadmin._id,
            },
          },
        },
      });
    }
  }

  return label;
};

export {
  _fetchLabelsInProperty,
  _createLabelInProperty,
  _fetchPaginatedLabels,
  _updateLabel,
  _deleteLabel,
};
