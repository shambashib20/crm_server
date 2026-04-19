import { Types } from "mongoose";

import SuccessResponse from "../middlewares/success.middleware";

import {
  _createAutomationService,
  _fetchAutomationsByPropertyService,
  _updateAutomationService,
  _deleteAutomationService,
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



const UpdateAutomationController = async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const property_id = req.user.property_id;
    const payload = req.body;

    if (!id) {
      return res
        .status(400)
        .json(new SuccessResponse("Automation ID is required!", 400));
    }

    const updated = await _updateAutomationService(
      new Types.ObjectId(id),
      new Types.ObjectId(property_id),
      payload
    );

    return res
      .status(200)
      .json(new SuccessResponse("Automation updated successfully!", 200, updated));
  } catch (err: any) {
    console.error("❌ Error in UpdateAutomationController:", err);
    const status = err.message.includes("not found") ? 404 : 500;
    return res.status(status).json(new SuccessResponse(err.message, status));
  }
};

const DeleteAutomationController = async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const property_id = req.user.property_id;

    if (!id) {
      return res
        .status(400)
        .json(new SuccessResponse("Automation ID is required!", 400));
    }

    const result = await _deleteAutomationService(
      new Types.ObjectId(id),
      new Types.ObjectId(property_id)
    );

    return res
      .status(200)
      .json(new SuccessResponse("Automation deleted successfully!", 200, result));
  } catch (err: any) {
    console.error("❌ Error in DeleteAutomationController:", err);
    const status = err.message.includes("not found") ? 404 : 500;
    return res.status(status).json(new SuccessResponse(err.message, status));
  }
};

export {
  CreateAutomationController,
  FetchAutomationController,
  UpdateAutomationController,
  DeleteAutomationController,
};
