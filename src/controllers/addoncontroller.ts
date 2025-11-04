import {
  _createAddOnService,
  _editAddOnService,
  _fetchPaginatedAddOns,
} from "../services/addon.service";

import SuccessResponse from "../middlewares/success.middleware";
import { Types } from "mongoose";

const CreateAddOnController = async (req: any, res: any) => {
  const { title, description = "", value } = req.body;

  const propId = req.user.property_id;
  if (!propId) {
    return res
      .status(400)
      .json(
        new SuccessResponse(
          "Property ID is required! Please reauthenticate!",
          400
        )
      );
  }

  if (!title || !value) {
    return res.status(400).json({
      message: "title and value are required to create an Add-On.",
    });
  }

  try {
    const payload = { title, description, value };
    const result = await _createAddOnService(payload, propId);

    if (!result) {
      return res
        .status(400)
        .json(new SuccessResponse("Add-On creation failed.", 400, result));
    }
    return res
      .status(200)
      .json(new SuccessResponse("Add-On created successfully!", 200, result));
  } catch (error: any) {
    return res.status(500).json(new SuccessResponse(error.message, 500));
  }
};

const EditAddOnController = async (req: any, res: any) => {
  const { addOnId, title, description, value } = req.body;
  const propId = req.user.property_id;
  if (!propId) {
    return res
      .status(400)
      .json(
        new SuccessResponse(
          "Property ID is required! Please reauthenticate!",
          400
        )
      );
  }
  if (!addOnId) {
    return res.status(400).json({ message: "Add-On ID is required." });
  }

  if (value !== undefined && isNaN(Number(value))) {
    return res.status(400).json({ message: "Value must be numeric." });
  }

  try {
    const updatePayload: any = {};
    if (title) updatePayload.title = title;
    if (description !== undefined) updatePayload.description = description;
    if (value !== undefined) updatePayload.value = Number(value);

    const result = await _editAddOnService(
      new Types.ObjectId(addOnId),
      updatePayload,
      propId
    );

    return res
      .status(200)
      .json(new SuccessResponse("Add-On updated successfully!", 200, result));
  } catch (error: any) {
    return res.status(400).json(new SuccessResponse(error.message, 400));
  }
};

const FetchAddOnsController = async (req: any, res: any) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const addOns = await _fetchPaginatedAddOns(page, limit);
    return res
      .status(200)
      .json(new SuccessResponse("Add-Ons fetched successfully", 200, addOns));
  } catch (error: any) {
    return res.status(500).json(new SuccessResponse(error.message, 500));
  }
};

export { CreateAddOnController, FetchAddOnsController, EditAddOnController };
