import { Types } from "mongoose";
import Status from "../models/status.model";
import Property from "../models/property.model";
import { LogStatus } from "../dtos/property.dto";

const _fetchStatusInProperty = async (propId: Types.ObjectId) => {
  const statuses = await Status.find({
    property_id: propId,
  });

  const property = await Property.findOne({
    _id: propId,
  });

  if (!statuses) {
    throw new Error(`No statuses found for ${property?.name}!`);
  }

  return statuses;
};

const _createStatusInProperty = async (
  title: string,
  description: string,
  propertyId: Types.ObjectId
) => {
  const now = new Date();
  const existingStatus = await Status.findOne({
    title: { $regex: new RegExp(`^${title}$`, "i") },
    property_id: propertyId,
  });

  if (existingStatus) {
    throw new Error(
      `Status with title "${title}" already exists in this property.`
    );
  }

  const newStatus = new Status({
    title,
    description,
    property_id: propertyId,
  });

  await Property.findByIdAndUpdate(
    propertyId,
    {
      $inc: { usage_count: 1 },
      $push: {
        logs: {
          title: "A New Status created!",
          description: `A new lead named (${newStatus.title}) was created!`,
          status: LogStatus.INFO,
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

const _editStatusInProperty = async (
  statusId: Types.ObjectId,
  title: string,
  description: string,
  propertyId: Types.ObjectId
) => {
  const now = new Date();
  const status = await Status.findById(statusId);
  if (!status) {
    throw new Error("Status not found.");
  }

  const updatedStatus = await Status.findByIdAndUpdate(
    statusId,
    {
      $set: {
        title,
        description,
        updatedAt: now,
      },
    },
    { new: true }
  );

  await Property.findByIdAndUpdate(propertyId, {
    $inc: { usage_count: 1 },
    $push: {
      logs: {
        title: "Status updated!",
        description: `Status updated to (${title}).`,
        status: LogStatus.ACTION,
        meta: { statusId },
        createdAt: now,
        updatedAt: now,
      },
    },
  });

  return updatedStatus;
};
export {
  _fetchStatusInProperty,
  _createStatusInProperty,
  _editStatusInProperty,
};
