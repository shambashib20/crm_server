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
  meta?: Record<string, any>;
}

const _fetchLeadDetails = async (leadId: Types.ObjectId) => {
  const existingLead = await Lead.findById(leadId)
    .populate("labels")
    .populate("status")
    .populate("assigned_to", "name email")
    .populate("assigned_by", "name email");

  if (!existingLead) {
    throw new Error("Lead not found!");
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
  page = 1,
  limit = 10,
  userPropId: Types.ObjectId
) => {
  const query: any = {
    property_id: userPropId,
    "meta.status": { $nin: ["ARCHIVED", "CONVERTED TO CUSTOMER"] },
  };

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
    .populate("status", "name")
    .populate("assigned_to", "name")
    .populate("assigned_by", "name")
    .populate("labels", "title")
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

  let createdById = meta.created_by || null;

  if (!createdById) {
    const chatAgentRole = await Role.findOne({ name: "Chat Agent" });

    if (!chatAgentRole) {
      throw new Error('No role named "Chat Agent" found.');
    }

    const chatAgents = await User.find({ role: chatAgentRole._id }).sort({
      createdAt: 1,
    });

    if (!chatAgents.length) {
      throw new Error("No chat agents found in the system.");
    }

    createdById = chatAgents[0]._id;
    meta.created_by = createdById;

    if (!data.assigned_to) {
      data.assigned_to = createdById.toString();
    }
  }

  const defaultSource = await Source.findOne({
    title: "Landing Page Leads",
  });

  const defaultStatus = await Status.findOne({ title: "New" });

  if (!defaultStatus) {
    throw new Error("Status must contain a Status named New!");
  }

  const ray_id = `ray-id-${uuidv4()}`;

  if (data.labels && data.labels.length > 0) {
    const validLabels = await Label.find({
      _id: { $in: data.labels.map((id) => new Types.ObjectId(id)) },
    });

    if (validLabels.length !== data.labels.length) {
      const validIds = validLabels.map((label) => label._id.toString());
      const invalidIds = data.labels.filter((id) => !validIds.includes(id));
      throw new Error(`This Labels does not exists: ${invalidIds.join(", ")}`);
    }
  }

  const lead = await Lead.create({
    ...data,
    labels: data.labels?.map((id) => new Types.ObjectId(id)) || [],
    status: defaultStatus._id || data.status,
    assigned_to: data.assigned_to ? new Types.ObjectId(data.assigned_to) : null,
    assigned_by: data.assigned_by ? new Types.ObjectId(data.assigned_by) : null,
    property_id: defaultStatus.property_id,
    meta: {
      ray_id,
      source: defaultSource || "Landing Page Leads",
      location: locationData,
      status: "ACTIVE",
      whatsapp: meta.whatsapp || "",
      course: meta.course || "",
      stream: meta.stream || "",
      // comment: data.comment,
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
    description: `${updatedLead.name} named lead updated the lead status to ${existingStatus.title}!`,
    status: LogStatus.INFO,
    meta: {
      leadId,
      userId,
    },
  };

  const leadLogEntry = {
    title: "Lead Status updated",
    description: `${updatedLead.name} named lead updated the lead status!`,
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
};
