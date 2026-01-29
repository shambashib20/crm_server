import { Types } from "mongoose";
import Status from "../models/status.model";
import Property from "../models/property.model";
import { LogStatus } from "../dtos/property.dto";
import User from "../models/user.model";
import PurchaseRecordsModel from "../models/purchaserecords.model";

const _fetchStatusInProperty = async (propId: Types.ObjectId) => {
  const DEFAULT_TITLES = ["New", "Processing", "Confirm", "Cancel"];

  const statuses = await Status.find({
    $or: [{ property_id: propId }, { title: { $in: DEFAULT_TITLES } }],
  })
    .lean()
    .exec();

  if (!statuses.length) {
    const property = await Property.findById(propId).lean();
    throw new Error(
      `No statuses found for ${property?.name || "this property"}!`
    );
  }

  const map = new Map();

  for (const s of statuses) {
    const isPropertyStatus = s.property_id?.toString() === propId.toString();

    if (isPropertyStatus) {
      map.set(s.title, s);
    } else if (!map.has(s.title)) {
      map.set(s.title, s);
    }
  }

  return Array.from(map.values()); 
};

const _createStatusInProperty = async (
  title: string,
  description: string,
  color_code: string,
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

  // 1️⃣ Create status FIRST
  const newStatus = new Status({
    title,
    description,
    property_id: propertyId,
    meta: {
      is_active: true,
      color_code,
      is_editable: true,
    },
  });

  await newStatus.save();

  // 2️⃣ Load active package
  const property = await Property.findById(propertyId);
  const activePackageId = property?.meta?.get("active_package");

  if (!activePackageId) {
    throw new Error("No active package found");
  }

  const purchaseRecord = await PurchaseRecordsModel.findById(activePackageId);
  if (!purchaseRecord) {
    throw new Error("Active purchase record not found");
  }

  const features = purchaseRecord.meta?.activated_features || [];

  const statusFeature = features.find(
    (f: any) => f.title === "Statuses Limit"
  );

  if (!statusFeature) {
    throw new Error("Statuses feature not found in active plan");
  }

  // 3️⃣ CHECK limit first
  const used = Number(statusFeature.used || 0);
  const limit = Number(statusFeature.limit || 0);

  if (used >= limit) {
    throw new Error("Statuses limit exceeded");
  }

  // 4️⃣ THEN increment
  statusFeature.used = used + 1;

  purchaseRecord.markModified("meta");
  await purchaseRecord.save();

  // 5️⃣ Workspace logs (optional but fine)
  await Property.findByIdAndUpdate(
    propertyId,
    {
      $inc: { usage_count: 1 },
      $push: {
        logs: {
          title: "A New Status created!",
          description: `A new status (${newStatus.title}) was created!`,
          status: LogStatus.INFO,
          meta: { statusId: newStatus._id },
          createdAt: now,
          updatedAt: now,
        },
      },
    },
    { new: true }
  );

  return newStatus;
};



const _editStatusInProperty = async (
  statusId: Types.ObjectId,
  title: string,
  description: string,
  propertyId: Types.ObjectId,
  is_active?: boolean,
  color_code?: string
) => {
  const now = new Date();

  const status = await Status.findById(statusId);
  if (!status) {
    throw new Error("Status not found.");
  }

  const updatePayload: any = {
    title,
    description,
    updatedAt: now,
  };
  if (typeof is_active === "boolean") {
    updatePayload["meta.is_active"] = is_active;
  }

  updatePayload["meta.color_code"] = color_code;

  const updatedStatus = await Status.findByIdAndUpdate(
    statusId,
    { $set: updatePayload },
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


const _deleteStatusInProperty = async (
  statusId: Types.ObjectId,
  userId: Types.ObjectId,
  propId: Types.ObjectId
) => {
  const status = await Status.findOne({ _id: statusId });
  if (!status) {
    throw new Error("Status not found");
  }

  const user = await User.findOne({ _id: userId });
  if (!user) {
    throw new Error("User not found");
  }

  const property = await Property.findOne({ _id: propId });
  if (!property) {
    throw new Error("Workspace not found");
  }

  const updatedStatus = await Status.findByIdAndUpdate(
    statusId,
    {
      $set: {
        "meta.is_active": false,
        updatedAt: new Date(),
      },
    },
    { new: true }
  );

  await Property.findByIdAndUpdate(propId, {
    $push: {
      logs: {
        title: "Status deactivated!",
        description: `The status "${status.title}" was marked as inactive.`,
        status: LogStatus.ACTION,
        meta: { statusId },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    },
  });

  return updatedStatus;
};

const _getStatusesPaginated = async (
  page = 1,
  limit = 10,
  propId: Types.ObjectId
) => {
  const skip = (page - 1) * limit;    

  const defaultStatusTitles = ["New", "Processing", "Confirm", "Cancel"];


  const propertyStatusesPromise = Status.find({
    property_id: propId,
  })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const totalPropertyStatusesPromise = Status.countDocuments({
    property_id: propId,
  });

  const defaultStatusesPromise = Status.find({
    title: { $in: defaultStatusTitles },
    $or: [{ property_id: { $exists: false } }, { property_id: null }],
  });

  const [propertyStatuses, totalPropertyStatuses, defaultStatuses] =
    await Promise.all([
      propertyStatusesPromise,
      totalPropertyStatusesPromise,
      defaultStatusesPromise,
    ]);

  const propertyTitles = propertyStatuses.map((s) => s.title);
  const mergedStatuses = [
    ...propertyStatuses,
    ...defaultStatuses.filter((d) => !propertyTitles.includes(d.title)),
  ];

  const total = mergedStatuses.length;

  return {
    statuses: mergedStatuses,
    pagination: {
      total,
      currentPage: page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export {
  _fetchStatusInProperty,
  _createStatusInProperty,
  _editStatusInProperty,
  _deleteStatusInProperty,
  _getStatusesPaginated,
};
