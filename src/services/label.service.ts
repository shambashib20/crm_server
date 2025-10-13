import { Types } from "mongoose";

import Label from "../models/label.model";

import Property from "../models/property.model";

import { LogStatus } from "../dtos/property.dto";
import Role from "../models/role.model";
import User from "../models/user.model";
import PurchaseRecordsModel from "../models/purchaserecords.model";
import { getMetaValue } from "../utils/meta.util";

const _createLabelInProperty = async (
  propId: Types.ObjectId,
  title: string,
  description: string,
  color_code: string,
  chatAgentIds?: Types.ObjectId[]
) => {
  const now = new Date();

  // Prevent duplicate labels
  const existingLabel = await Label.findOne({
    title: { $regex: new RegExp(`^${title}$`, "i") },
    property_id: propId,
  });
  if (existingLabel) {
    throw new Error(`Label "${title}" already exists in this property.`);
  }

  // Prepare label
  const assignedAgents = (chatAgentIds || []).map((id) => ({
    agent_id: id,
    assigned_at: now,
  }));

  const newLabel = new Label({
    title,
    description,
    property_id: propId,
    meta: {
      is_active: true,
      assigned_agents: assignedAgents,
      color_code: color_code || "",
      is_editable: true,
    },
  });

  
  const property = await Property.findById(propId);
  const activePackageId = getMetaValue(property?.meta, "active_package");
  console.log("Active Package ID in Service:", activePackageId);
  if (!activePackageId) {
    throw new Error("No active package found.");
  }

  // ✅ Step 2: Update usage_count in Property
  await Property.findByIdAndUpdate(propId, {
    $inc: {
      usage_count: 1,
    },
    $push: {
      logs: {
        title: "A New Label created!",
        description: `A new label named (${newLabel.title}) was created!`,
        status: LogStatus.ACTION,
        meta: { labelId: newLabel._id },
        createdAt: now,
        updatedAt: now,
      },
    },
  });

  // ✅ Step 3: Update used count in PurchaseRecordsModel
  const updatedPackage = await PurchaseRecordsModel.findOneAndUpdate(
    {
      _id: activePackageId,
      "meta.activated_features.title": "Labels Limit",
    },
    {
      $inc: {
        "meta.activated_features.$.used": 1,
      },
    },
    { new: true }
  );

  if (!updatedPackage) {
    throw new Error("Failed to update feature usage in package.");
  }

  // ✅ Save label last
  await newLabel.save();

  return newLabel;
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
  const updateDoc: any = {};

  if (updates.title) updateDoc.title = updates.title;
  if (updates.description) updateDoc.description = updates.description;

  if (updates.meta) {
    if (updates.meta.color_code) {
      updateDoc["meta.color_code"] = updates.meta.color_code;
    }

    if (Array.isArray(updates.meta.assigned_agents)) {
     
      updateDoc["meta.assigned_agents"] = updates.meta.assigned_agents;
    }
  }

  const label = await Label.findOneAndUpdate(
    {
      _id: labelId,
      property_id: propId,
    },
    {
      $set: updateDoc,
    },
    {
      new: true,
    }
  );

  if (!label) {
    throw new Error("label not found for the given property");
  }

  // Optional logging
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
