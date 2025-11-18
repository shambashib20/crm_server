import Automation from "../models/automation.model";

import { AutomationDto } from "../dtos/automation.dto";
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

export { _createAutomationService, _fetchAutomationsByPropertyService };
