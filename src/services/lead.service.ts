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
    .populate("assigned_to", "name email");

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
    description: `${updatedLead.name} named lead updated the lead status!`,
    status: LogStatus.INFO,
    meta: {
      leadId,
      userId,
    },
  };

  const leadLogEntry = {
    title: "Lead Label updated",
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

const _homePageLeadService = async (
  labelIds: Types.ObjectId[],
  assignedToUserIds: Types.ObjectId[],
  sourceNames: string[],
  searchString: string
) => {
  const query: any = {};

  if (labelIds.length > 0) {
    const existingLabels = await Label.find({ _id: { $in: labelIds } });
    if (existingLabels.length > 0) {
      query.labels = { $in: labelIds };
    }
  }

  if (assignedToUserIds.length > 0) {
    query.assigned_to = { $in: assignedToUserIds };
  }
  if (sourceNames.length > 0) {
    query["meta.source.title"] = { $in: sourceNames };
  }

  if (searchString && searchString.trim() !== "") {
    query.$or = [
      { name: { $regex: new RegExp(searchString.trim(), "i") } },
      { phone_number: { $regex: new RegExp(searchString.trim(), "i") } },
      { email: { $regex: new RegExp(searchString.trim(), "i") } },
    ];
  }

  const leads = await Lead.find(query)
    .populate("status", "name")
    .populate("assigned_to", "name")
    .populate("assigned_by", "name")
    .populate("labels", "title")
    .lean();

  const uniquePropertyIds = [
    ...new Set(
      leads.map((lead) => lead.property_id?.toString()).filter(Boolean)
    ),
  ];

  const statuses = await Status.find({
    property_id: { $in: uniquePropertyIds },
  }).lean();

  return {
    leads,
    statuses,
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
    status: defaultStatus._id,
    assigned_to: data.assigned_to ? new Types.ObjectId(data.assigned_to) : null,
    assigned_by: data.assigned_by ? new Types.ObjectId(data.assigned_by) : null,
    property_id: defaultStatus.property_id,
    meta: {
      ray_id,
      source: defaultSource || "Landing Page Leads",
      location: locationData,
    },

    logs: [
      {
        title: "Lead created",
        description: `Lead created by ${
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
    .populate("status")
    .populate("labels")
    .populate("assigned_to")
    .populate("assigned_by")
    .populate("property_id")
    .sort({ createdAt: -1 });

  const leads_in_new: LeadDto[] = [];
  const leads_in_processing: LeadDto[] = [];

  leads.forEach((lead) => {
    const statusTitle = (lead.status as any)?.title;

    if (statusTitle === "new") {
      leads_in_new.push(lead);
    } else if (statusTitle === "processing") {
      leads_in_processing.push(lead);
    }
  });

  return {
    date: today.toISOString().split("T")[0],
    leads_in_new,
    leads_in_processing,
  };
};

export {
  _fetchLeadDetails,
  _createNewFollowUp,
  _updateLabelForLead,
  _homePageLeadService,
  _createLeadService,
  _getMissedFollowUpsService,
  _getTodayLeadsGrouped,
};
