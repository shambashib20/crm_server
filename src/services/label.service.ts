import { Types } from "mongoose";

import Label from "../models/label.model";

import Property from "../models/property.model";
import { LabelDto } from "../dtos/label.dto";
import { LogStatus } from "../dtos/property.dto";

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
      .limit(limit),
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

export {
  _fetchLabelsInProperty,
  _createLabelInProperty,
  _fetchPaginatedLabels,
};
