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

export { _createAutomationService };
