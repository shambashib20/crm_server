import Automation from "../models/automation.model";
import Property from "../models/property.model";

import { AutomationDto } from "../dtos/automation.dto";
import { LogStatus } from "../dtos/property.dto";
import { Types } from "mongoose";

const _createAutomationService = async (
  payload: Omit<AutomationDto, "_id" | "property_id">,
  property_id: Types.ObjectId
) => {
  try {
    const automation = new Automation({
      ...payload,
      property_id,
      meta: {
        is_active: true,
      },
    });

    await automation.save();
    return automation;
  } catch (error: any) {
    console.error("❌ Error creating automation:", error);
    throw new Error(error.message || "Failed to create automation");
  }
};


const _fetchAutomationsByPropertyService = async (
  page: number = 1,
  limit: number = 10,
  property_id: Types.ObjectId
) => {
  const skip = (page - 1) * limit;

  const [automations, total] = await Promise.all([
    Automation.find({ property_id })
     .populate({
        path: "rules.status_id",
        select: "title",
      })
      .populate({
        path: "rules.label_id",
        select: "title",
      })
      .populate({
        path: "rules.template_id",
        select: "title message meta",
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Automation.countDocuments(),
  ]);

  const totalPages = Math.ceil(total / limit);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;


  return {
   automations,
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

const _updateAutomationService = async (
  automationId: Types.ObjectId,
  property_id: Types.ObjectId,
  payload: Partial<Omit<AutomationDto, "_id" | "property_id">>
) => {
  try {
    const automation = await Automation.findOne({
      _id: automationId,
      property_id,
    });

    if (!automation) {
      throw new Error("Automation not found or does not belong to this property");
    }

    const updateFields: Record<string, any> = {};
    if (payload.type !== undefined) updateFields.type = payload.type;
    if (payload.lead_type !== undefined) updateFields.lead_type = payload.lead_type;
    if (payload.invoice_type !== undefined) updateFields.invoice_type = payload.invoice_type;
    if (payload.rules !== undefined) updateFields.rules = payload.rules;
    if (payload.meta !== undefined) {
      for (const [key, value] of Object.entries(payload.meta)) {
        updateFields[`meta.${key}`] = value;
      }
    }

    const updated = await Automation.findByIdAndUpdate(
      automationId,
      { $set: updateFields },
      { new: true }
    )
      .populate({ path: "rules.status_id", select: "title" })
      .populate({ path: "rules.label_id", select: "title" })
      .populate({ path: "rules.template_id", select: "title message meta" });

    await Property.findByIdAndUpdate(
      property_id,
      {
        $push: {
          logs: {
            title: "Automation Updated",
            description: `Automation (${automationId}) of type "${automation.type}" was updated.`,
            status: LogStatus.ACTION,
            meta: { automationId, automationType: automation.type },
          },
        },
      }
    );

    return updated;
  } catch (error: any) {
    console.error("❌ Error updating automation:", error);
    throw new Error(error.message || "Failed to update automation");
  }
};

const _deleteAutomationService = async (
  automationId: Types.ObjectId,
  property_id: Types.ObjectId
) => {
  try {
    const automation = await Automation.findOne({
      _id: automationId,
      property_id,
    });

    if (!automation) {
      throw new Error("Automation not found or does not belong to this property");
    }

    await Automation.findByIdAndDelete(automationId);

    await Property.findByIdAndUpdate(
      property_id,
      {
        $push: {
          logs: {
            title: "Automation Deleted",
            description: `Automation (${automationId}) of type "${automation.type}" was deleted.`,
            status: LogStatus.ACTION,
            meta: { automationId, automationType: automation.type },
          },
        },
      }
    );

    return { deleted: true, automationId };
  } catch (error: any) {
    console.error("❌ Error deleting automation:", error);
    throw new Error(error.message || "Failed to delete automation");
  }
};

export {
  _createAutomationService,
  _fetchAutomationsByPropertyService,
  _updateAutomationService,
  _deleteAutomationService,
};
