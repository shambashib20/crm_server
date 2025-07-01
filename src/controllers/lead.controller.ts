import { Types } from "mongoose";
import SuccessResponse from "../middlewares/success.middleware";
import {
  _fetchLeadDetails,
  _createNewFollowUp,
  _homePageLeadService,
  _createLeadService,
} from "../services/lead.service";
import { Request } from "express";
import Lead from "../models/lead.model";

interface UpdateLabelRequest {
  leadId: Types.ObjectId | string;
  labelIds: Types.ObjectId[] | string[];
}

const FetchLeadDetails = async (req: any, res: any) => {
  try {
    const { leadId } = req.query;
    const result = await _fetchLeadDetails(leadId);

    return res
      .status(200)
      .json(
        new SuccessResponse("Lead details fetched successfully", 200, result)
      );
  } catch (error: any) {
    return res.status(500).json(new SuccessResponse(error.message, 500));
  }
};

const NewFollowUp = async (req: any, res: any) => {
  try {
    const userId = req.user._id;
    const propId = req.user.property_id;
    const result = await _createNewFollowUp(
      req.body.leadId,
      propId,
      userId,
      req.body.nextFollowUp
    );

    if (!result) {
      return res
        .status(400)
        .json(new SuccessResponse("Follow up can't be created", 400));
    }
    return res
      .status(201)
      .json(new SuccessResponse("Followup created successfully", 201, result));
  } catch (error: any) {
    return res.status(500).json(new SuccessResponse(error.message, 500));
  }
};

const UpdateLabelForLead = async (
  req: Request<{}, {}, UpdateLabelRequest>,
  res: any
) => {
  try {
    const { leadId, labelIds } = req.body;

    if (!Array.isArray(labelIds) || labelIds.length === 0) {
      return res
        .status(400)
        .json({ message: "labelIds must be a non-empty array" });
    }

    return res
      .status(200)
      .json(new SuccessResponse("Followup created successfully", 201));
  } catch (error: any) {
    return res.status(500).json(new SuccessResponse(error.message, 500));
  }
};

const HomePageLeads = async (req: any, res: any) => {
  try {
    const { labelIds, assignedTo, sourceNames } = req.body;

    const labelObjectIds = labelIds.map((id: string) => new Types.ObjectId(id));
    const assignedToObjectIds = assignedTo.map(
      (id: string) => new Types.ObjectId(id)
    );

    const leads = await _homePageLeadService(
      labelObjectIds,
      assignedToObjectIds,
      sourceNames || []
    );
    return res
      .status(200)
      .json(
        new SuccessResponse("Filtered leads fetched successfully", 200, leads)
      );
  } catch (error: any) {
    return res.status(500).json(new SuccessResponse(error.message, 500));
  }
};

const CreateLeadController = async (req: any, res: any) => {
  try {
    const leadPayload = req.body;
    const lead = await _createLeadService(leadPayload);

    return res
      .status(201)
      .json(new SuccessResponse("Lead created successfully", 201, lead));
  } catch (error: any) {
    return res
      .status(500)
      .json(new SuccessResponse(error.message || "Something went wrong", 500));
  }
};

export {
  FetchLeadDetails,
  NewFollowUp,
  UpdateLabelForLead,
  HomePageLeads,
  CreateLeadController,
};
