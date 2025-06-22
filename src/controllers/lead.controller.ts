import { Types } from "mongoose";
import SuccessResponse from "../middlewares/success.middleware";
import {
  _fetchLeadDetails,
  _createNewFollowUp,
  _homePageLeadService,
  _createLeadService,
  _updateLabelForLead,
  _getMissedFollowUpsService,
  _getTodayLeadsGrouped,
  _updateAssignedAgentForLead,
  _deleteOrArchiveLead,
  _getLeadStatusStatsService,
} from "../services/lead.service";

interface UpdateLabelRequest {
  leadId: Types.ObjectId | string;
  userId: Types.ObjectId;
  propId: Types.ObjectId;
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
      req.body.nextFollowUp,
      req.body.comment,
      req.body.attachmentUrl,
      req.body.audioAttachmentUrl
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

const UpdateLabelForLead = async (req: any, res: any) => {
  try {
    const { leadId, labelIds } = req.body;
    const userId = req.user?._id;
    const propId = req.user?.property_id;

    if (!Array.isArray(labelIds) || labelIds.length === 0) {
      return res
        .status(400)
        .json({ message: "labelIds must be a non-empty array" });
    }

    await _updateLabelForLead(
      new Types.ObjectId(leadId),
      new Types.ObjectId(propId),
      new Types.ObjectId(userId),
      labelIds.map((id: any) => new Types.ObjectId(id))
    );

    return res
      .status(200)
      .json(new SuccessResponse("Followup created successfully", 201));
  } catch (error: any) {
    return res.status(500).json(new SuccessResponse(error.message, 500));
  }
};

const HomePageLeads = async (req: any, res: any) => {
  try {
    const {
      labelIds,
      assignedTo,
      sourceNames,
      search = "",
      sortBy = "",
    } = req.body;

    const labelObjectIds = labelIds.map((id: string) => new Types.ObjectId(id));
    const assignedToObjectIds = assignedTo.map(
      (id: string) => new Types.ObjectId(id)
    );

    const leads = await _homePageLeadService(
      labelObjectIds,
      assignedToObjectIds,
      sourceNames || [],
      search,
      sortBy
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
    const ip =
      (req.headers["x-forwarded-for"] as string) ||
      req.socket.remoteAddress ||
      "0.0.0.0";
    const lead = await _createLeadService(leadPayload, ip);

    return res
      .status(201)
      .json(new SuccessResponse("Lead created successfully", 201, lead));
  } catch (error: any) {
    return res
      .status(500)
      .json(new SuccessResponse(error.message || "Something went wrong", 500));
  }
};

const GetMissedFollowUpsController = async (req: any, res: any) => {
  try {
    const propId = req.user.property_id;

    const missedFollowUps = await _getMissedFollowUpsService(propId);

    return res
      .status(200)
      .json(
        new SuccessResponse(
          "Missed follow-ups fetched successfully",
          200,
          missedFollowUps
        )
      );
  } catch (error: any) {
    return res.status(500).json(new SuccessResponse(error.message, 500));
  }
};

const GetTodaysLeadsGrouped = async (req: any, res: any) => {
  try {
    const propId = req.user.property_id;

    const todaysLeads = await _getTodayLeadsGrouped(propId);

    return res
      .status(200)
      .json(
        new SuccessResponse(
          "Today's leads grouped by source fetched successfully",
          200,
          todaysLeads
        )
      );
  } catch (error: any) {
    return res.status(500).json(new SuccessResponse(error.message, 500));
  }
};

const UpdateAssignmentForLead = async (req: any, res: any) => {
  try {
    const { leadId, chatAgentId } = req.body;
    const userId = req.user?._id;
    const propId = req.user?.property_id;

    if (!chatAgentId) {
      return res.status(400).json({ message: "chat agent id must be sent!" });
    }

    await _updateAssignedAgentForLead(
      new Types.ObjectId(leadId),
      new Types.ObjectId(propId),
      new Types.ObjectId(userId),
      new Types.ObjectId(chatAgentId)
    );

    return res
      .status(200)
      .json(new SuccessResponse("Chat Agent assigned successfully!", 201));
  } catch (error: any) {
    return res.status(500).json(new SuccessResponse(error.message, 500));
  }
};

const DeleteOrArchiveForLead = async (req: any, res: any) => {
  try {
    const { rayId } = req.body;
    const userId = req.user?._id;

    if (!userId) {
      return res.status(400).json({ message: "user id must be sent!" });
    }

    await _deleteOrArchiveLead(rayId, userId);

    return res
      .status(200)
      .json(new SuccessResponse("Lead archived successfully!", 201));
  } catch (error: any) {
    return res.status(500).json(new SuccessResponse(error.message, 500));
  }
};

const LeadsPerStatus = async (req: any, res: any) => {
  try {
    const { startDate = "", endDate = "" } = req.query;

    const result = await _getLeadStatusStatsService(
      startDate as string,
      endDate as string
    );

    return res
      .status(200)
      .json(new SuccessResponse("Donut chart data fetched", 200, result));
  } catch (err: any) {
    return res.status(500).json(new SuccessResponse(err.message, 500));
  }
};
export {
  FetchLeadDetails,
  NewFollowUp,
  UpdateLabelForLead,
  HomePageLeads,
  CreateLeadController,
  GetMissedFollowUpsController,
  GetTodaysLeadsGrouped,
  UpdateAssignmentForLead,
  DeleteOrArchiveForLead,
  LeadsPerStatus
};
