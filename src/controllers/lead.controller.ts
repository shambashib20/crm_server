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
  _archiveThisSessionsLeadService,
  _getLeadSourceStatsService,
  _updateStatusForLead,
  _importLeadsFromExcel,
  _exportLeadsFromDBToExcel,
  _leadCreationViaApi,
  _getMissedFollowUpsForDay,
  _fetchPaginatedArchivedLeads,
  _getTodaysFollowups,
  _getLeadsBySourceAndAgentService,
  _getLeadsByLabelAndAgentService,
  _getLeadsByStatusAndAgentService,
  _editFollowUp,
  _getTodaysFollowupsForSuperadmin,
  _validateLeadOwnership,
  _validateLeadOwnershipByRayId,
  _createLeadViaLabel,
} from "../services/lead.service";
import multer from "multer";
import { _getConvertedLeadsPerAgentPerSourceService, _getLeadsTrendByTelecallerService, _getTelecallerStatsService } from "../services/master.service";

interface UpdateLabelRequest {
  leadId: Types.ObjectId | string;
  userId: Types.ObjectId;
  propId: Types.ObjectId;
  labelIds: Types.ObjectId[] | string[];
}

const upload = multer({ dest: "uploads/" });
const FetchLeadDetails = async (req: any, res: any) => {
  try {
    const { leadId } = req.query;
    const userRole: string = req.user?.role?.name ?? "";
    const userId = req.user?._id?.toString();

    const result = await _fetchLeadDetails(leadId);

    // Only Superadmin can view any lead; everyone else only sees their own assigned leads
    if (userRole !== "Superadmin") {
      const assignedToId =
        (result.assigned_to as any)?._id?.toString() ||
        result.assigned_to?.toString();
      if (assignedToId !== userId) {
        return res
          .status(403)
          .json(
            new SuccessResponse(
              "Access denied: You can only view leads assigned to you.",
              403
            )
          );
      }
    }

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
    const userRole: string = req.user?.role?.name ?? "";

    await _validateLeadOwnership(req.body.leadId, userId.toString(), userRole);

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

const EditFollowUp = async (req: any, res: any) => {
  try {
    const userId = req.user._id;
    const userRole: string = req.user?.role?.name ?? "";

    await _validateLeadOwnership(req.body.leadId, userId.toString(), userRole);

    const result = await _editFollowUp(
      req.body.leadId,
      req.body.followUpId,
      userId,
      req.body.nextFollowUp,
      req.body.comment,
      req.body.attachmentUrl,
      req.body.audioAttachmentUrl
    );

    return res
      .status(200)
      .json(new SuccessResponse("Follow-up updated successfully", 200, result));
  } catch (error: any) {
    return res.status(500).json(new SuccessResponse(error.message, 500));
  }
};

const UpdateLabelForLead = async (req: any, res: any) => {
  try {
    const { leadId, labelIds } = req.body;
    const userId = req.user?._id;
    const propId = req.user?.property_id;
    const userRole: string = req.user?.role?.name ?? "";

    if (!Array.isArray(labelIds) || labelIds.length === 0) {
      return res
        .status(400)
        .json({ message: "labelIds must be a non-empty array" });
    }

    await _validateLeadOwnership(leadId, userId.toString(), userRole);

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

const UpdateStatusForLead = async (req: any, res: any) => {
  try {
    const { leadId, statusId } = req.body;
    const userId = req.user?._id;
    const propId = req.user?.property_id;
    const userRole: string = req.user?.role?.name ?? "";

    if (statusId === undefined || statusId === null || statusId === "") {
      return res
        .status(400)
        .json({ message: "statusId must be not be empty!" });
    }

    await _validateLeadOwnership(leadId, userId.toString(), userRole);

    await _updateStatusForLead(
      new Types.ObjectId(leadId),
      new Types.ObjectId(propId),
      new Types.ObjectId(userId),
      new Types.ObjectId(statusId)
    );

    return res
      .status(200)
      .json(
        new SuccessResponse("Status updated for the lead successfully", 201)
      );
  } catch (error: any) {
    return res.status(500).json(new SuccessResponse(error.message, 500));
  }
};

const HomePageLeads = async (req: any, res: any) => {
  try {
    const {
      labelIds,
      assignedTo,
      assignedBy,
      sourceNames,
      search = "",
      sortBy = "",
      is_table_view,
      start_date,
      end_date,
      page = 1,
      limit = 10,
    } = req.body;

    const userPropId = req.user.property_id;
    const userRole: string = req.user?.role?.name ?? "";
    const isSuperadmin = userRole === "Superadmin";

    const labelObjectIds = labelIds.map((id: string) => new Types.ObjectId(id));

    // Only Superadmin can see all leads across telecallers
    // Every other role (Admin, Lead Manager, Telecaller) sees only their own assigned leads
    const assignedToObjectIds = isSuperadmin
      ? assignedTo.map((id: string) => new Types.ObjectId(id))
      : [new Types.ObjectId(req.user._id)];

    const assignedByUserIds = assignedBy.map(
      (id: string) => new Types.ObjectId(id)
    );

    const leads = await _homePageLeadService(
      labelObjectIds,
      assignedToObjectIds,
      assignedByUserIds,
      sourceNames || [],
      search,
      sortBy,
      is_table_view,
      start_date,
      end_date,
      parseInt(page),
      parseInt(limit),
      userPropId
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
    // 🔹 Business/Validation errors
    const clientErrorMessages = [
      "No Superadmin user found",
      "Superadmin role not found",
      "Label with ID",
      "Workspace Linkage not found",
      "Active package not found",
      "Your plan does not include Leads Limit",
      "Leads creation limit reached",
      "The validity for lead creation expired",
      "Status must contain a Status named New",
    ];

    const statusCode = clientErrorMessages.some((msg) =>
      error.message?.includes(msg)
    )
      ? 400
      : 500;

    return res.status(statusCode).json({
      message: error.message || "Something went wrong",
      status: statusCode === 400 ? "BAD_REQUEST" : "SERVER_ERROR",
      data: null,
    });
  }
};

// Authenticated users (Telecallers, Admins) create leads with explicit assignment
const CreateLeadByUserController = async (req: any, res: any) => {
  try {
    const leadPayload = req.body;
    const userId = new Types.ObjectId(req.user._id);
    const propId = req.user.property_id;
    const ip =
      (req.headers["x-forwarded-for"] as string) ||
      req.socket.remoteAddress ||
      "0.0.0.0";

    const lead = await _createLeadService(
      { ...leadPayload, property_id: propId },
      ip,
      userId
    );

    return res
      .status(201)
      .json(new SuccessResponse("Lead created successfully", 201, lead));
  } catch (error: any) {
    const clientErrorMessages = [
      "No Superadmin user found",
      "Superadmin role not found",
      "Label with ID",
      "Workspace Linkage not found",
      "Active package not found",
      "Your plan does not include Leads Limit",
      "Leads creation limit reached",
      "The validity for lead creation expired",
      "Status must contain a Status named New",
      "Assigned user not found in this property",
    ];

    const statusCode = clientErrorMessages.some((msg) =>
      error.message?.includes(msg)
    )
      ? 400
      : 500;

    return res.status(statusCode).json({
      message: error.message || "Something went wrong",
      status: statusCode === 400 ? "BAD_REQUEST" : "SERVER_ERROR",
      data: null,
    });
  }
};

const GetMissedFollowUpsController = async (req: any, res: any) => {
  try {
    const propId = req.user.property_id;
    const userRole: string = req.user?.role?.name ?? "";
    const isSuperadmin = userRole === "Superadmin";

    // Non-Superadmin users only see missed follow-ups for their own leads
    const filterUserId = isSuperadmin ? undefined : req.user._id;
    const missedFollowUps = await _getMissedFollowUpsService(propId, filterUserId);

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
    const userRole: string = req.user?.role?.name ?? "";

    if (!chatAgentId) {
      return res.status(400).json({ message: "chat agent id must be sent!" });
    }

    await _validateLeadOwnership(leadId, userId.toString(), userRole);

    await _updateAssignedAgentForLead(
      new Types.ObjectId(leadId),
      new Types.ObjectId(propId),
      new Types.ObjectId(userId),
      new Types.ObjectId(chatAgentId)
    );

    return res
      .status(200)
      .json(new SuccessResponse("Telecaller assigned successfully!", 201));
  } catch (error: any) {
    return res.status(500).json(new SuccessResponse(error.message, 500));
  }
};

const DeleteOrArchiveForLead = async (req: any, res: any) => {
  try {
    const { rayId, deleteReason } = req.body;
    const userId = req.user?._id;
    const userRole: string = req.user?.role?.name ?? "";

    if (!userId) {
      return res.status(400).json({ message: "user id must be sent!" });
    }

    await _validateLeadOwnershipByRayId(rayId, userId.toString(), userRole);

    await _deleteOrArchiveLead(rayId, userId, deleteReason);

    return res
      .status(200)
      .json(new SuccessResponse("Lead archived successfully!", 201));
  } catch (error: any) {
    return res.status(500).json(new SuccessResponse(error.message, 500));
  }
};

const LeadsPerStatus = async (req: any, res: any) => {
  try {
    const { startDate = "", endDate = "", agentId = "" } = req.query;

    const result = await _getLeadStatusStatsService(
      new Types.ObjectId(agentId),
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

const LeadsPerSource = async (req: any, res: any) => {
  try {
    const { startDate = "", endDate = "", agentId = "" } = req.query;

    const result = await _getLeadSourceStatsService(
      new Types.ObjectId(agentId),
      startDate as string,
      endDate as string
    );

    return res
      .status(200)
      .json(
        new SuccessResponse("Donut chart data fetched for Source", 200, result)
      );
  } catch (err: any) {
    return res.status(500).json(new SuccessResponse(err.message, 500));
  }
};

const ArchiveSessionLeads = async (req: any, res: any) => {
  try {
    const propertyId = req.user.property_id;
    const result = await _archiveThisSessionsLeadService(propertyId);

    return res
      .status(200)
      .json(
        new SuccessResponse("Leads archived for this session!", 200, result)
      );
  } catch (err: any) {
    return res.status(500).json(new SuccessResponse(err.message, 500));
  }
};

export const UploadExcelMiddleware = upload.single("file");

const ImportLeadsController = async (req: any, res: any) => {
  try {
    if (!req.file) {
      return res.status(400).json(new SuccessResponse("No file uploaded", 400));
    }

    const propertyId = req.user.property_id;
    if (!propertyId) {
      return res
        .status(400)
        .json(new SuccessResponse("property_id is required", 400));
    }

    const ip =
      (req.headers["x-forwarded-for"] as string) ||
      req.socket.remoteAddress ||
      "0.0.0.0";

    const { status_id, source_id, label_ids = [], assigned_to } = req.body;

    const importResult = await _importLeadsFromExcel(
      req.file.path,
      ip,
      propertyId,
      {
        status_id: status_id ? new Types.ObjectId(status_id) : null,
        source_id: source_id ? new Types.ObjectId(source_id) : null,
        label_ids: Array.isArray(label_ids)
          ? label_ids.map((id: string) => new Types.ObjectId(id))
          : [new Types.ObjectId(label_ids)],
        assigned_to: assigned_to ? new Types.ObjectId(assigned_to) : null,
      }
    );

    return res.status(201).json(
      new SuccessResponse("Leads imported successfully", 201, {
        total: importResult.total,
        imported: importResult.success,
        failed: importResult.failed,
        errors: importResult.errors,
        leads: importResult.leads,
      })
    );
  } catch (error: any) {
    console.error("Error importing leads:", error);

    // Provide more specific error messages
    let errorMessage = error.message || "Something went wrong during import";
    let statusCode = 500;

    if (error.message.includes("No data found")) {
      statusCode = 400;
    } else if (error.message.includes("Too many leads")) {
      statusCode = 400;
    } else if (
      error.message.includes("duplicate") ||
      error.message.includes("already exist")
    ) {
      statusCode = 409;
      errorMessage = "Some leads already exist in the system";
    }

    return res
      .status(statusCode)
      .json(new SuccessResponse(errorMessage, statusCode));
  }
};

const ExportLeadsController = async (req: any, res: any) => {
  try {
    const excelBuffer = await _exportLeadsFromDBToExcel();
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=leads_export.xlsx"
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    return res.status(200).send(excelBuffer);
  } catch (error: any) {
    console.error("Error exporting leads:", error);
    return res.status(500).json({
      message: "Failed to export leads",
      error: error.message || error,
    });
  }
};

const CreateExternalLeadsController = async (req: any, res: any) => {
  try {


    const {
      customer_name,
      company_name,
      phone_number,
      email,
      address,
      reference,
      comment,
      property_id,
    } = req.body;

    if (!customer_name || !phone_number || !property_id) {
      return res
        .status(400)
        .json(
          new SuccessResponse(
            "some fields are missing!",
            400
          )
        );
    }

    const leadData = {
      customer_name,
      company_name,
      phone_number,
      email,
      address,
      reference,
      comment,
      property_id,
    };

    const newLead = await _leadCreationViaApi(leadData);

    return res
      .status(201)
      .json(
        new SuccessResponse("Lead created successfully via API", 201, newLead)
      );
  } catch (err: any) {
    return res
      .status(500)
      .json(new SuccessResponse(err.message || "Something went wrong", 500));
  }
};

const FetchMissedFollowupsForADay = async (req: any, res: any) => {
  try {
    const propId = req.user.property_id;
    const userId = req.user._id;

    const leads = await _getMissedFollowUpsForDay(userId, propId);

    return res
      .status(200)
      .json(new SuccessResponse("Missed follow-ups fetched", 200, leads));
  } catch (err: any) {
    return res.status(500).json(new SuccessResponse(err.message, 500));
  }
};

const FetchArchivedPaginatedLeads = async (req: any, res: any) => {
  try {
    const { page = 1, limit = 10 } = req.body;
    const propertyId = req.user.property_id;
    const result = await _fetchPaginatedArchivedLeads(
      propertyId,
      parseInt(page),
      parseInt(limit)
    );

    return res
      .status(200)
      .json(new SuccessResponse("Archived leads fetched", 200, result));
  } catch (err: any) {
    return res.status(500).json(new SuccessResponse(err.message, 500));
  }
};

const FetchTodaysFollowups = async (req: any, res: any) => {
  try {
    const propId = req.user.property_id;
    const userId = req.user._id;

    const leads = await _getTodaysFollowups(userId, propId);

    return res
      .status(200)
      .json(
        new SuccessResponse("Today's pending follow-ups fetched", 200, leads)
      );
  } catch (err: any) {
    return res.status(500).json(new SuccessResponse(err.message, 500));
  }
};


const FetchTodaysFollowupsSuperadmin = async (req: any, res: any) => {
  try {
    const propId = req.user.property_id;

    const leads = await _getTodaysFollowupsForSuperadmin(propId);

    return res
      .status(200)
      .json(
        new SuccessResponse("Today's pending follow-ups fetched for superadmin", 200, leads)
      );
  } catch (err: any) {
    return res.status(500).json(new SuccessResponse(err.message, 500));
  }
};

const GetLeadsBySourceAndChatAgentController = async (req: any, res: any) => {
  try {

    const propId = req.user.property_id;


    const result = await _getLeadsBySourceAndAgentService(propId);
    return res
      .status(200)
      .json(
        new SuccessResponse(
          "Leads by Source and Telecaller fetched",
          200,
          result
        )
      );
  } catch (error: any) {
    return res.status(500).json(new SuccessResponse(error.message, 500));
  }
};

const GetLeadsByLabelAndChatAgentController = async (req: any, res: any) => {
  try {

    const propId = req.user.property_id;

    const result = await _getLeadsByLabelAndAgentService(propId);
    return res
      .status(200)
      .json(
        new SuccessResponse(
          "Leads by Label and Telecaller fetched",
          200,
          result
        )
      );
  } catch (error: any) {
    return res.status(500).json(new SuccessResponse(error.message, 500));
  }
};

const GetLeadsByStatusAndChatAgentController = async (req: any, res: any) => {
  try {

    const propId = req.user.property_id;

    const result = await _getLeadsByStatusAndAgentService(propId);
    return res
      .status(200)
      .json(
        new SuccessResponse(
          "Leads by Status and Chat Agent fetched",
          200,
          result
        )
      );
  } catch (error: any) {
    return res.status(500).json(new SuccessResponse(error.message, 500));
  }
};

const GetLeadsTrendByTelecallerController = async (req: any, res: any) => {
  try {
    const { agentId, labelId, statusId, startDate, endDate } = req.body;
    const propId = req.user.property_id;
    if (!agentId || !labelId || !statusId) {
      return res
        .status(400)
        .json(
          new SuccessResponse(
            "agentId, labelId and statusId are required fields!",
            400
          )
        );
    }
    const result = await _getLeadsTrendByTelecallerService(
      new Types.ObjectId(agentId),
      new Types.ObjectId(labelId),
      new Types.ObjectId(statusId),
      new Types.ObjectId(propId),
      startDate,
      endDate
    );
    return res
      .status(200)
      .json(
        new SuccessResponse(
          "Leads trend data fetched successfully",
          200,
          result
        )
      );
  } catch (error: any) {
    return res.status(500).json(new SuccessResponse(error.message, 500));
  }
};


const GetTelecallerStatisticsController = async (req: any, res: any) => {
  try {
    const { startDate, endDate } = req.body;
    const propId = req.user.property_id;
    const agentId = req.user._id;
    if (!agentId) {
      return res
        .status(400)
        .json(
          new SuccessResponse(
            "agentId, labelId and statusId are required fields!",
            400
          )
        );
    }
    const result = await _getTelecallerStatsService(
      new Types.ObjectId(agentId),
      new Types.ObjectId(propId),
      startDate,
      endDate
    );
    return res
      .status(200)
      .json(
        new SuccessResponse(
          "Leads trend data fetched successfully",
          200,
          result
        )
      );
  } catch (error: any) {
    return res.status(500).json(new SuccessResponse(error.message, 500));
  }
};




const GetStatisticsBySourceController = async (req: any, res: any) => {
  try {

    const propId = req.user.property_id;


    const result = await _getConvertedLeadsPerAgentPerSourceService(
      new Types.ObjectId(propId),
    );
    return res
      .status(200)
      .json(
        new SuccessResponse(
          "Leads trend data fetched successfully",
          200,
          result
        )
      );
  } catch (error: any) {
    return res.status(500).json(new SuccessResponse(error.message, 500));
  }
};

const CreateLeadViaLabelController = async (req: any, res: any) => {
  try {
    const property = req.property; // attached by BasicAuthMiddleware
    const ip =
      (req.headers["x-forwarded-for"] as string) ||
      req.socket.remoteAddress ||
      "0.0.0.0";

    const {
      label_title,
      name,
      company_name,
      phone_number,
      email,
      address,
      comment,
      reference,
      meta,
    } = req.body;

    if (!label_title) {
      return res
        .status(400)
        .json(new SuccessResponse("label_title is required", 400));
    }

    const newLead = await _createLeadViaLabel(
      {
        label_title,
        name,
        company_name,
        phone_number,
        email,
        address,
        comment,
        reference,
        meta,
      },
      property,
      ip
    );

    return res
      .status(201)
      .json(new SuccessResponse("Lead created successfully", 201, newLead));
  } catch (err: any) {
    return res
      .status(500)
      .json(new SuccessResponse(err.message || "Something went wrong", 500));
  }
};

export {
  FetchLeadDetails,
  NewFollowUp,
  UpdateLabelForLead,
  HomePageLeads,
  CreateLeadController,
  CreateLeadByUserController,
  GetMissedFollowUpsController,
  GetTodaysLeadsGrouped,
  UpdateAssignmentForLead,
  DeleteOrArchiveForLead,
  LeadsPerStatus,
  ArchiveSessionLeads,
  LeadsPerSource,
  UpdateStatusForLead,
  ImportLeadsController,
  ExportLeadsController,
  CreateExternalLeadsController,
  FetchMissedFollowupsForADay,
  FetchArchivedPaginatedLeads,
  FetchTodaysFollowups,
  GetLeadsBySourceAndChatAgentController,
  GetLeadsByLabelAndChatAgentController,
  GetLeadsByStatusAndChatAgentController,
  EditFollowUp,
  GetLeadsTrendByTelecallerController,
  GetTelecallerStatisticsController,
  GetStatisticsBySourceController,
  FetchTodaysFollowupsSuperadmin,
  CreateLeadViaLabelController,
};
