import { Types } from "mongoose";

import SuccessResponse from "../middlewares/success.middleware";

import {
  _createAutomationService,
  _fetchAutomationsByPropertyService,
} from "../services/automation.service";

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

const FetchAutomationController = async (req: any, res: any) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const property_id = req.user.property_id;

    const automations = await _fetchAutomationsByPropertyService(page, limit, property_id);
    return res
      .status(200)
      .json(
        new SuccessResponse("Automations fetched successfully", 200, automations)
      );
  } catch (error: any) {
    return res.status(500).json(new SuccessResponse(error.message, 500));
  }
};



export { CreateAutomationController, FetchAutomationController };
