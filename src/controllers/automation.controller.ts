import { Types } from "mongoose";

import SuccessResponse from "../middlewares/success.middleware";

import { _createAutomationService } from "../services/automation.service";

const CreateAutomationController = async (req: any, res: any) => {
  try {
    const payload = req.body;
    const property_id = req.user.property_id;

    if (!payload.type || !property_id) {
      return res
        .status(400)
        .json(
          new SuccessResponse(
            "Type and Property ID are required to create an automation!",
            400
          )
        );
    }

   const automation = await _createAutomationService(
      payload,
      new Types.ObjectId(property_id) 
    );

    return res
      .status(200)
      .json(
        new SuccessResponse("Automation created successfully!", 200, automation)
      );
  } catch (err: any) {
    console.error("❌ Error in createAutomationController:", err);
    return res.status(500).json(new SuccessResponse(err.message, 500));
  }
};

export { CreateAutomationController };
