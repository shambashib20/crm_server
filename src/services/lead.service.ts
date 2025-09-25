import { Types } from "mongoose";
import Lead from "../models/lead.model";
import Property from "../models/property.model";
import User from "../models/user.model";
import { LogStatus } from "../dtos/property.dto";
import Label from "../models/label.model";
import { LeadDto, LeadLogStatus } from "../dtos/lead.dto";
import Status from "../models/status.model";
import Role from "../models/role.model";
import { v4 as uuidv4 } from "uuid";
import Source from "../models/source.model";
import { getLocationFromIP } from "../utils/get_location.util";
import { startOfDay, endOfDay } from "date-fns";
import * as XLSX from "xlsx";
import fs from "fs";
import {
  bulkInsertLeadsWithValidation,
  BulkLeadInputDto,
} from "./bulk-lead-upload.service";

function getEarliestFollowUpDate(followUps: any[] = []): Date | null {
  if (!Array.isArray(followUps) || followUps.length === 0) return null;

  const validDates = followUps
    .map((f) => f.next_followup_date)
    .filter((date) => !!date)
    .map((d) => new Date(d));

  if (validDates.length === 0) return null;

  return validDates.sort((a, b) => a.getTime() - b.getTime())[0];
}
interface MissedFollowUpLead {
  leadId: Types.ObjectId;
  name: string;
  status: {
    _id: Types.ObjectId;
    title: string;
  };
  assigned_to?: {
    _id: Types.ObjectId;
    name: string;
    email: string;
  };
  labels: {
    _id: Types.ObjectId;
    title: string;
  }[];
  next_followup_date: Date;
  comment: string;
  meta?: Record<string, any>;
}

interface ExcelLeadRow {
  customer_name?: string;
  company_name?: string;
  email?: string;
  mobile?: string | number;
  address?: string;
  reference?: string;
  comment?: string;
}
interface CreateLeadDto {
  name: string;
  company_name?: string;
  phone_number?: string;
  email?: string;
  address?: string;
  comment?: string;
  reference?: string;
  labels?: string[];
  status?: Types.ObjectId;
  assigned_to?: string;
  assigned_by?: string;
  property_id?: Types.ObjectId;
  source?: Types.ObjectId;
  meta?: Record<string, any>;
}

interface ImportOptions {
  status_id?: Types.ObjectId | null;
  source_id?: Types.ObjectId | null;
  label_ids?: Types.ObjectId[];
  assigned_to?: Types.ObjectId | null;
  source_name?: string;
}




interface ExternalLeadGenerationDto {
  customer_name: string;
  company_name: string;
  phone_number: string;
  email: string;
  address: string;
  reference?: string;
  comment?: string;
  property_id: Types.ObjectId;
}

const _fetchLeadDetails = async (leadId: Types.ObjectId) => {
  const existingLead = await Lead.findById(leadId)
    .populate("labels")
    .populate("status")
    .populate("assigned_to", "name email")
    .populate("assigned_by", "name email")
    .populate({
      path: "meta.source",
      select: "title description meta",
    });

  if (!existingLead) {
    throw new Error("Lead not found!");
  }

  if (existingLead.meta?.source) {
    const sourceDoc = await Source.findById(existingLead.meta.source).select(
      "title description meta"
    );
    existingLead.meta.source = sourceDoc;
  }

  return existingLead;
};

const _createNewFollowUp = async (
  leadId: Types.ObjectId,
  propId: Types.ObjectId,
  userId: Types.ObjectId,
  nextFollowUp: string,
  comment: string,
  attachmentUrl?: string,
  audioAttachmentUrl?: string
) => {
  const existingUser = await User.findById(userId).select("name");
  if (!existingUser) {
    throw new Error("User not found");
  }
  const finalComment = comment?.trim() ? comment : "Follow-up added";

  const updatedStatus = await Status.findOne({
    title: "Processing",
  });

  if (!updatedStatus) {
    throw new Error("Status must contain a Status named Processing!");
  }

  const parsedDate =
    nextFollowUp && !isNaN(Date.parse(nextFollowUp))
      ? new Date(nextFollowUp)
      : new Date();
  const newFollowUp = {
    comment: finalComment,
    next_followup_date: parsedDate,
    meta: {
      created_by: userId,
      attachment_url: attachmentUrl || "",
      audio_attachment_url: audioAttachmentUrl || "",
    },
  };

  const updatedLead = await Lead.findByIdAndUpdate(
    leadId,
    {
      status: updatedStatus._id,
      $push: {
        follow_ups: newFollowUp,
      },
    },
    { new: true }
  ).select("name");

  if (!updatedLead) {
    throw new Error("Lead not found");
  }

  const logEntry = {
    title: "Lead Follow up created",
    description: `${existingUser.name} created a follow-up with lead name ${updatedLead.name}!`,
    status: LogStatus.INFO,
    meta: {
      leadId,
      userId,
    },
  };

  await Property.findByIdAndUpdate(
    propId,
    {
      $inc: { usage_count: 1 },
      $push: { logs: logEntry },
    },
    { new: true }
  );
  const leadLogEntry = {
    title: "Lead Follow up created",
    description: `${existingUser.name} created a follow-up with lead name ${updatedLead.name}!`,
    status: LeadLogStatus.ACTION,
    meta: {
      leadId,
      userId,
    },
  };
  await Lead.findByIdAndUpdate(
    leadId,
    {
      $push: {
        logs: leadLogEntry,
      },
    },
    { new: true }
  ).select("name");

  return {
    followUp: newFollowUp,
  };
};

const _updateLabelForLead = async (
  leadId: Types.ObjectId,
  propId: Types.ObjectId,
  userId: Types.ObjectId,
  labelIds: Types.ObjectId[] | string[]
) => {
  const existingUser = await User.findById(userId).select("name");
  if (!existingUser) {
    throw new Error("User not found");
  }

  const updatedLead = await Lead.findByIdAndUpdate(
    leadId,
    { labels: labelIds },
    { new: true }
  ).populate("labels");

  if (!updatedLead) {
    throw new Error("Lead not found!");
  }

  const logEntry = {
    title: "Lead Label updated",
    description: `${updatedLead.name} named lead updated the lead label!`,
    status: LogStatus.INFO,
    meta: {
      leadId,
      userId,
    },
  };

  const leadLogEntry = {
    title: "Lead Label updated",
    description: `${updatedLead.name} named lead updated the lead label!`,
    status: LeadLogStatus.ACTION,
    meta: {
      leadId,
      userId,
    },
  };

  await Property.findByIdAndUpdate(
    propId,
    {
      $push: { logs: logEntry },
    },
    { new: true }
  );

  await Lead.findByIdAndUpdate(
    leadId,
    {
      $push: {
        logs: leadLogEntry,
      },
    },
    {
      new: true,
    }
  );
};

const _homePageLeadService = async (
  labelIds: Types.ObjectId[],
  assignedToUserIds: Types.ObjectId[],
  sourceNames: string[],
  searchString: string,
  sortBy: string,
  is_table_view: boolean,
  start_date: string, // Add start_date parameter
  end_date: string, // Add end_date parameter
  page = 1,
  limit = 10,
  userPropId: Types.ObjectId
) => {
  const query: any = {
    property_id: userPropId,
    "meta.status": { $nin: ["ARCHIVED", "CONVERTED TO CUSTOMER"] },
  };

  // ✅ Date Range Filter
  if (start_date || end_date) {
    query.createdAt = {};

    if (start_date) {
      // Start of the day for start_date
      const startDate = new Date(start_date);
      startDate.setHours(0, 0, 0, 0);
      query.createdAt.$gte = startDate;
    }

    if (end_date) {
      // End of the day for end_date
      const endDate = new Date(end_date);
      endDate.setHours(23, 59, 59, 999);
      query.createdAt.$lte = endDate;
    }
  }

  let validLabelIds: Types.ObjectId[] = [];
  if (labelIds.length > 0) {
    const existingLabels = await Label.find({
      _id: { $in: labelIds },
      property_id: userPropId,
    }).lean();
    validLabelIds = existingLabels.map((label) => label._id);
    if (validLabelIds.length > 0) {
      query.labels = { $in: validLabelIds };
    }
  }

  // ✅ Secure Assigned User Filtering
  let validUserIds: Types.ObjectId[] = [];
  if (assignedToUserIds.length > 0) {
    const existingUsers = await User.find({
      _id: { $in: assignedToUserIds },
      property_id: userPropId,
    }).lean();
    validUserIds = existingUsers.map((user) => user._id);
    if (validUserIds.length > 0) {
      query.assigned_to = { $in: validUserIds };
    }
  }

  // ✅ Source Names
  if (sourceNames.length > 0) {
    query["meta.source.title"] = { $in: sourceNames };
  }

  // ✅ Search
  if (searchString?.trim()) {
    const searchRegex = new RegExp(searchString.trim(), "i");
    query.$or = [
      { name: { $regex: searchRegex } },
      { phone_number: { $regex: searchRegex } },
      { email: { $regex: searchRegex } },
    ];
  }

  // ✅ Sort options
  let sortOptions: Record<string, 1 | -1> = {};
  if (sortBy === "by_created_date") {
    sortOptions = { createdAt: -1 };
  }

  // ✅ Get full list of leads
  let fullLeads = await Lead.find(query)
    .sort(sortOptions)
    .populate({
      path: "status",
      select: "_id title",
    })
    .populate("assigned_to", "name")
    .populate("assigned_by", "name")
    .populate({
      path: "labels",
      select: "_id title description meta",
    })
    .lean();

  fullLeads = (fullLeads || [])
    .filter(Boolean)
    .filter((lead) => lead._id && lead.name && lead.email);

  // ✅ Extract user info for follow ups
  const createdByUserIds = new Set<string>();
  fullLeads.forEach((lead) => {
    lead.follow_ups?.forEach((fu) => {
      const userId = fu.meta?.created_by;
      if (userId) createdByUserIds.add(userId.toString());
    });
  });

  const users = await User.find(
    { _id: { $in: [...createdByUserIds] } },
    "name title email"
  ).lean();

  const userMap = new Map(users.map((u) => [u._id.toString(), u]));

  fullLeads.forEach((lead) => {
    lead.follow_ups?.forEach((fu: any) => {
      const createdBy = fu.meta?.created_by?.toString();
      if (createdBy && userMap.has(createdBy)) {
        fu.created_by_user = userMap.get(createdBy);
      }
    });
  });

  // ✅ Push latest created lead to top
  if (fullLeads.length > 1) {
    const latestLead = fullLeads.reduce(
      (latest, current) =>
        new Date(current.createdAt) > new Date(latest.createdAt)
          ? current
          : latest,
      fullLeads[0]
    );

    fullLeads = [
      latestLead,
      ...fullLeads.filter(
        (lead) => lead._id.toString() !== latestLead._id.toString()
      ),
    ];
  }

  // ✅ Sort by next follow-up if requested
  if (sortBy === "by_next_followup_date") {
    const leadsExceptLatest = fullLeads.slice(1); // skip latest lead
    leadsExceptLatest.sort((a, b) => {
      const aNext = getEarliestFollowUpDate(a.follow_ups);
      const bNext = getEarliestFollowUpDate(b.follow_ups);
      if (!aNext && !bNext) return 0;
      if (!aNext) return 1;
      if (!bNext) return -1;
      return new Date(aNext).getTime() - new Date(bNext).getTime();
    });
    fullLeads = [fullLeads[0], ...leadsExceptLatest];
  }

  // ✅ Paginate only in table view
  let paginatedLeads = fullLeads;
  if (is_table_view) {
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    paginatedLeads = fullLeads.slice(startIndex, endIndex);
  }

  // ✅ Fetch statuses scoped to current property
  const statuses = await Status.find({
    property_id: userPropId,
    "meta.is_active": true,
  }).lean();

  return {
    leads: paginatedLeads,
    statuses,
    ...(is_table_view && {
      pagination: {
        total: fullLeads.length,
        page,
        limit,
        totalPages: Math.ceil(fullLeads.length / limit),
        hasNextPage: page * limit < fullLeads.length,
        hasPrevPage: page > 1,
      },
    }),
  };
};

const _createLeadService = async (data: CreateLeadDto, ip: string) => {
  const now = new Date();
  const meta: Record<string, any> = data.meta || {};
  const locationData = await getLocationFromIP(ip);

  let assignedToId: Types.ObjectId | null = null;

  // 🔹 Handle round-robin assignment from label
  if (data.labels && data.labels.length > 0) {
    const firstLabelId = data.labels[0]; // take the first label
    const label = await Label.findById(firstLabelId);

    if (!label) {
      throw new Error(`Label with ID ${firstLabelId} not found`);
    }

    // ✅ Ensure meta is always an object
    if (!label.meta) {
      label.meta = {};
    }

    const assignedAgents = (label.meta.assigned_agents || []) as {
      agent_id: Types.ObjectId;
      assigned_at: Date;
    }[];

    if (assignedAgents.length > 0) {
      // 🔹 Round-robin assignment
      const lastIndex =
        (label.meta.last_assigned_index as number | undefined) ?? 0;
      const nextIndex = (lastIndex + 1) % assignedAgents.length;

      assignedToId = assignedAgents[nextIndex].agent_id;

      label.meta.last_assigned_index = nextIndex;
      label.markModified("meta");
      await label.save();
    }
  }

  // 🔹 Fallback: assign to Superadmin
  if (!assignedToId) {
    const superAdmin = await User.findOne({ role: "Superadmin" });
    if (!superAdmin) {
      throw new Error("No Superadmin found in the system.");
    }
    assignedToId = superAdmin._id;
  }

  // 🔹 Fetch defaults
  const defaultSource = await Source.findOne({
    title: "Landing Page Leads",
  });

  const defaultStatus = await Status.findOne({ title: "New" });

  if (!defaultStatus) {
    throw new Error("Status must contain a Status named New!");
  }

  const ray_id = `ray-id-${uuidv4()}`;

  // 🔹 Create lead
  const lead = await Lead.create({
    ...data,
    labels: data.labels?.map((id) => new Types.ObjectId(id)) || [],
    status: data.status || defaultStatus._id,
    assigned_to: assignedToId,
    assigned_by: data.assigned_by ? new Types.ObjectId(data.assigned_by) : null,
    property_id: defaultStatus.property_id,
    meta: {
      ray_id,
      source: data.source || defaultSource,
      location: locationData,
      status: "ACTIVE",
      whatsapp: meta.whatsapp || "",
      course: meta.course || "",
      stream: meta.stream || "",
    },
    logs: [
      {
        title: "Lead created",
        description: `Lead created by the name of ${
          data?.name || "Unknown"
        } and assigned the status of ${defaultStatus.title}`,
        status: LeadLogStatus.ACTION,
        meta: {},
        createdAt: now,
        updatedAt: now,
      },
    ],
  });

  // 🔹 Update property usage + logs
  await Property.findByIdAndUpdate(
    defaultStatus.property_id,
    {
      $inc: { usage_count: 1 },
      $push: {
        logs: {
          title: "Lead Assigned",
          description: `A new lead named (${lead.name}) was assigned to this property.`,
          status: LogStatus.INFO,
          meta: { leadId: lead._id },
          createdAt: now,
          updatedAt: now,
        },
      },
    },
    { new: true }
  );

  return lead;
};

const _getMissedFollowUpsService = async (
  propId: Types.ObjectId
): Promise<MissedFollowUpLead[]> => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const property = await Property.findOne({
    _id: propId,
  });

  const leadsWithFollowUps = await Lead.find({
    follow_ups: { $exists: true, $ne: [] },
    property_id: property?._id,
  })
    .select("name follow_ups status assigned_to labels meta")
    .populate<{ status: { _id: Types.ObjectId; title: string } }>(
      "status",
      "title"
    )
    .populate<{
      assigned_to: { _id: Types.ObjectId; name: string; email: string };
    }>("assigned_to", "name email")
    .populate<{ labels: { _id: Types.ObjectId; title: string }[] }>(
      "labels",
      "title"
    )
    .lean();
  const missedLeads: MissedFollowUpLead[] = [];

  for (const lead of leadsWithFollowUps) {
    const sortedFollowUps = [...lead.follow_ups].sort(
      (a, b) =>
        new Date(b.next_followup_date).getTime() -
        new Date(a.next_followup_date).getTime()
    );

    const latestFollowUp = sortedFollowUps[0];
    const nextFollowUpDate = new Date(latestFollowUp.next_followup_date);

    if (nextFollowUpDate < today) {
      missedLeads.push({
        leadId: lead._id,
        name: lead.name,
        status: lead.status as MissedFollowUpLead["status"],
        assigned_to: lead.assigned_to as MissedFollowUpLead["assigned_to"],
        labels: lead.labels as MissedFollowUpLead["labels"],
        next_followup_date: nextFollowUpDate,
        comment: latestFollowUp.comment,
        meta: lead.meta,
      });
    }
  }

  return missedLeads;
};

const _getTodayLeadsGrouped = async (propId: Types.ObjectId) => {
  const today = new Date();
  const start = startOfDay(today);
  const end = endOfDay(today);
  const leads = await Lead.find({
    createdAt: { $gte: start, $lte: end },
    property_id: propId,
  })
    .populate({ path: "status", select: "title" })
    .populate({ path: "labels", select: "title" })
    .populate("assigned_to")
    .populate("assigned_by")
    .populate("property_id")
    .sort({ createdAt: -1 });

  const leads_in_new: LeadDto[] = [];
  const leads_in_processing: LeadDto[] = [];

  leads.forEach((lead) => {
    const statusTitle = (lead.status as any)?.title;

    if (statusTitle === "New") {
      leads_in_new.push(lead);
    } else if (statusTitle === "Processing") {
      leads_in_processing.push(lead);
    }
  });

  return {
    date: today.toISOString().split("T")[0],
    leads_in_new,
    leads_in_processing,
  };
};

const _updateAssignedAgentForLead = async (
  leadId: Types.ObjectId,
  propId: Types.ObjectId,
  userId: Types.ObjectId,
  chatAgentId: Types.ObjectId
) => {
  const existingUser = await User.findById(userId).select("name");
  if (!existingUser) {
    throw new Error("User not found");
  }

  const existingChatAgent = await User.findById(chatAgentId).populate({
    path: "role",
    select: "name",
  });

  if (!existingChatAgent) {
    throw new Error("Chat Agent not found");
  }

  const updatedLead = await Lead.findByIdAndUpdate(
    leadId,
    { assigned_to: existingChatAgent?._id, assigned_by: existingUser._id },
    { new: true }
  );

  if (!updatedLead) {
    throw new Error("Lead not found!");
  }

  const logEntry = {
    title: "A new Chat agent assigned!",
    description: `${existingUser.name} changed lead's assignment to ${existingChatAgent?.name}`,
    status: LogStatus.INFO,
    meta: {
      leadId,
      userId,
    },
  };

  const leadLogEntry = {
    title: "A new Chat agent assigned!",
    description: `${existingUser.name} changed lead's assignment to ${existingChatAgent?.name}`,
    status: LeadLogStatus.ACTION,
    meta: {
      leadId,
      userId,
    },
  };

  await Property.findByIdAndUpdate(
    propId,
    {
      $push: { logs: logEntry },
    },
    { new: true }
  );

  await Lead.findByIdAndUpdate(
    leadId,
    {
      $push: {
        logs: leadLogEntry,
      },
    },
    {
      new: true,
    }
  );
};

const _deleteOrArchiveLead = async (
  rayId: string,
  userId: Types.ObjectId,
  deleteReason: string
) => {
  const existingLead = await Lead.findOne({ "meta.ray_id": rayId });
  if (!existingLead) {
    throw new Error("Lead not found");
  }
  const existingUser = await User.findById(userId).select("name");
  if (!existingUser) {
    throw new Error("User not found");
  }

  const updatedLead = await Lead.findByIdAndUpdate(
    existingLead._id,
    {
      meta: {
        ...existingLead.meta,
        status: "ARCHIVED",
        deleteReason,
      },
    },
    { new: true }
  );

  if (!updatedLead) {
    throw new Error("Lead not found!");
  }

  const logEntry = {
    title: "The lead is archived!",
    description: `Lead named ${existingLead.name} is archived by ${existingUser.name}`,
    status: LogStatus.INFO,
    meta: {},
  };

  const leadLogEntry = {
    title: "The lead is archived!",
    description: `Lead named ${existingLead.name} is archived by ${existingUser.name}`,
    status: LeadLogStatus.ACTION,
    meta: {
      leadId: updatedLead?._id,
      userId,
    },
  };

  await Property.findByIdAndUpdate(
    existingLead.property_id,
    {
      $push: { logs: logEntry },
    },
    { new: true }
  );

  await Lead.findByIdAndUpdate(
    updatedLead._id,
    {
      $push: {
        logs: leadLogEntry,
      },
    },
    {
      new: true,
    }
  );
};

const _getLeadStatusStatsService = async (
  agentId: Types.ObjectId,
  startDate?: string,
  endDate?: string
) => {
  const matchStage: any = {};

  if (startDate || endDate) {
    matchStage.createdAt = {};
    if (startDate) {
      matchStage.createdAt.$gte = new Date(`${startDate}T00:00:00.000Z`);
    }
    if (endDate) {
      matchStage.createdAt.$lte = new Date(`${endDate}T23:59:59.999Z`);
    }
  }

  if (agentId) {
    matchStage.assigned_to = new Types.ObjectId(agentId);
  }

  const aggregation = await Lead.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
      },
    },
    {
      $lookup: {
        from: "status",
        localField: "_id",
        foreignField: "_id",
        as: "statusDetails",
      },
    },
    {
      $unwind: {
        path: "$statusDetails",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $project: {
        _id: 0,
        label: {
          $cond: [
            { $ifNull: ["$statusDetails.title", false] },
            "$statusDetails.title",
            "Unassigned",
          ],
        },
        value: "$count",
      },
    },
  ]);

  const labels = aggregation.map((item) => item.label || "Unknown");
  const data = aggregation.map((item) => item.value);

  return {
    labels,
    data,
  };
};

const _getLeadSourceStatsService = async (
  agentId: Types.ObjectId,
  startDate?: string,
  endDate?: string
) => {
  const matchStage: any = {};

  if (startDate || endDate) {
    matchStage.createdAt = {};
    if (startDate) {
      matchStage.createdAt.$gte = new Date(`${startDate}T00:00:00.000Z`);
    }
    if (endDate) {
      matchStage.createdAt.$lte = new Date(`${endDate}T23:59:59.999Z`);
    }
  }

  if (agentId) {
    matchStage.assigned_to = new Types.ObjectId(agentId);
  }

  const aggregation = await Lead.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: "$meta.source._id",
        count: { $sum: 1 },
      },
    },
    {
      $lookup: {
        from: "sources",
        localField: "_id",
        foreignField: "_id",
        as: "sourceDetails",
      },
    },
    {
      $unwind: {
        path: "$sourceDetails",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $project: {
        _id: 0,
        label: {
          $cond: [
            { $ifNull: ["$sourceDetails.title", false] },
            "$sourceDetails.title",
            "Unassigned",
          ],
        },
        value: "$count",
      },
    },
  ]);

  const sources = aggregation.map((item) => item.label || "Unknown");
  const data = aggregation.map((item) => item.value);

  return {
    sources,
    data,
  };
};

const _archiveThisSessionsLeadService = async (propertyId: Types.ObjectId) => {
  const result = await Lead.updateMany(
    {
      "meta.status": {
        $ne: "ARCHIVED",
      },
    },
    {
      $set: {
        "meta.status": "ARCHIVED",
      },
    }
  );

  const logEntry = {
    title: "Session Lead Archive",
    description: `${result.modifiedCount} leads archived successfully.`,
    status: LogStatus.INFO,
    meta: {
      action: "archive-leads",
      modifiedCount: result.modifiedCount,
      matchedCount: result.matchedCount,
    },
  };
  await Property.findByIdAndUpdate(propertyId, {
    $push: { logs: logEntry },
  });

  return {
    matchedCount: result.matchedCount,
    modifiedCount: result.modifiedCount,
    acknowledged: result.acknowledged,
  };
};

const _updateStatusForLead = async (
  leadId: Types.ObjectId,
  propId: Types.ObjectId,
  userId: Types.ObjectId,
  statusId: Types.ObjectId | string
) => {
  const existingUser = await User.findById(userId).select("name");
  if (!existingUser) {
    throw new Error("User not found");
  }
  const existingStatus = await Status.findById(statusId);
  if (!existingStatus) {
    throw new Error("Status not found");
  }

  const updatedLead = await Lead.findByIdAndUpdate(
    leadId,
    { status: statusId },
    { new: true }
  ).populate("status");

  if (!updatedLead) {
    throw new Error("Lead not found!");
  }

  const logEntry = {
    title: "Lead Status updated",
    description: `${updatedLead.name} named lead got updated to status of ${existingStatus.title}!`,
    status: LogStatus.INFO,
    meta: {
      leadId,
      userId,
    },
  };

  const leadLogEntry = {
    title: "Lead Status updated",
    description: `${updatedLead.name} named lead has its status updated to ${existingStatus.title}!`,
    status: LeadLogStatus.ACTION,
    meta: {
      leadId,
      userId,
    },
  };

  await Property.findByIdAndUpdate(
    propId,
    {
      $push: { logs: logEntry },
    },
    { new: true }
  );

  await Lead.findByIdAndUpdate(
    leadId,
    {
      $push: {
        logs: leadLogEntry,
      },
    },
    {
      new: true,
    }
  );
};

const _importLeadsFromExcel = async (
  filePath: string,
  ip: string,
  propertyId: string,
  options: ImportOptions = {}
) => {
  try {
    // Read and parse Excel file
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<ExcelLeadRow>(worksheet);

    console.log(`Total rows found in Excel: ${rows.length}`);
    if (!rows.length) {
      throw new Error("No data found in the sheet.");
    }

    if (rows.length > 500) {
      throw new Error(
        `Too many leads in the sheet. Maximum allowed is 500, but got ${rows.length}.`
      );
    }

    let sourceObject: any = null;
    if (options.source_id) {
      sourceObject = await Source.findOne({
        _id: options.source_id,
        property_id: new Types.ObjectId(propertyId),
      }).lean();

      if (!sourceObject) {
        throw new Error(
          `Source with ID ${options.source_id} not found or doesn't belong to this property`
        );
      }
    }

    const leadDtos: BulkLeadInputDto[] = rows.map((row) => {
      const meta: Record<string, any> = {
        ...(sourceObject && {
          source: {
            _id: sourceObject._id,
            title: sourceObject.title,
            description: sourceObject.description,
          },
        }),
        ...(options.source_name &&
          !sourceObject && {
            source: {
              title: options.source_name,
            },
          }),
      };

      return {
        name: row.customer_name?.toString().trim() || "",
        company_name: row.company_name?.toString().trim() || "",
        phone_number: row.mobile ? String(row.mobile).trim() : "",
        email: row.email?.toString().trim() || "",
        address: row.address?.toString().trim() || "",
        comment: row.comment?.toString().trim() || "",
        reference: row.reference?.toString().trim() || "",
        logs: [],
        follow_ups: [],
        tasks: [],
        status: options.status_id || null,
        labels: options.label_ids || [],
        assigned_to: options.assigned_to || null,
        assigned_by: options.assigned_to
          ? new Types.ObjectId(propertyId)
          : null,
        meta: meta,
        property_id: new Types.ObjectId(propertyId),
      };
    });

    // Use bulk insert service
    const result = await bulkInsertLeadsWithValidation(
      leadDtos,
      ip,
      new Types.ObjectId(propertyId)
    );

    console.log(
      `Import completed: ${result.success} successful, ${result.failed} failed`
    );

    // Log errors if any
    if (result.failed > 0) {
      console.warn("Import errors:", result.errors);
    }

    // Clean up uploaded file
    fs.unlinkSync(filePath);

    return {
      total: rows.length,
      success: result.success,
      failed: result.failed,
      errors: result.errors,
      leads: result.insertedLeads,
    };
  } catch (error: any) {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    throw error;
  }
};

const _exportLeadsFromDBToExcel = async () => {
  // 1. Fetch all leads
  const leads = await Lead.find().lean();

  // 2. Map leads to desired column format
  const data = leads.map((lead) => ({
    customer_name: lead.name || "",
    company_name: lead.company_name || "",
    email: lead.email || "",
    mobile: lead.phone_number || "",
    address: lead.address || "",
    reference: lead.reference || "",
    comment: lead.comment || "",
  }));

  // 3. Create worksheet and workbook
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Leads");

  const excelBuffer = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "buffer",
  });

  return excelBuffer;
};

const _createExternalLeadService = async (
  leadData: ExternalLeadGenerationDto
) => {
  const {
    customer_name,
    company_name,
    phone_number,
    email,
    address,
    reference,
    comment,
    property_id,
  } = leadData;

  const property = await Property.findById(property_id);
  if (!property) {
    throw new Error("Property not found");
  }

  const source = await Source.findOne({
    title: "Website",
  });

  if (!source) {
    throw new Error("Default source 'Website' not found in the system");
  }

  if (property.usage_count >= property.usage_limits) {
    throw new Error("Not enough credits to create a lead via API");
  }
  // Create lead
  const newLead = await Lead.create({
    name: customer_name,
    company_name,
    phone_number, // matches your schema
    email,
    address,
    reference,
    comment,
    property_id,
    logs: [
      {
        title: "Lead Created via API",
        description: `(${customer_name}) named lead created externally through API.`,
        status: "INFO",
        meta: { source: "API" },
      },
    ],
    source: source._id,
  });

  // Also log in property logs (optional but recommended)
  await Property.findByIdAndUpdate(property_id, {
    $push: {
      logs: {
        title: "New Lead Created",
        description: `(${customer_name}) named created via API.`,
        status: "INFO",
        meta: { leadId: newLead._id, source: "API" },
      },
    },
  });

  return newLead;
};

export {
  _fetchLeadDetails,
  _createNewFollowUp,
  _updateLabelForLead,
  _homePageLeadService,
  _createLeadService,
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
  _createExternalLeadService,
};
