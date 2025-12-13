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
import { getMetaValue } from "../utils/meta.util";
import PurchaseRecordsModel from "../models/purchaserecords.model";
import { PurchaseStatus } from "../dtos/purchaserecords.dto";
import { _triggerLeadAutomationWebhook } from "../webhooks/lead_automation.webhook";
import { _triggerWhatsAppAutomation } from "../webhooks/whatsapp_automation.webhook";
import {
  cacheSet,
  makeCacheKey,
  acquireLock,
  releaseLock,
  cacheGet,
  cache,
} from "./cache.util";

import crypto from "crypto";
import { StatusDto } from "../dtos/status.dto";

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
  email: string;
  phone_number: string;
  address: string;
  company_name: string;
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

const homeKeyPrefix = "home_leads_v1";

const allKeys = cache.keys();
const relatedKeys = allKeys.filter((k) => k.startsWith(`${homeKeyPrefix}:`));

relatedKeys.forEach((k) => cache.del(k));

console.log(`🧹 Cache invalidated for: ${relatedKeys.length} lead lists`);

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

const _editFollowUp = async (
  leadId: Types.ObjectId,
  followUpId: Types.ObjectId,
  userId: Types.ObjectId,
  nextFollowUp?: string,
  comment?: string,
  attachmentUrl?: string,
  audioAttachmentUrl?: string
) => {
  const existingUser = await User.findById(userId).select("name");
  if (!existingUser) {
    throw new Error("User not found");
  }

  const lead = await Lead.findById(leadId);
  if (!lead) {
    throw new Error("Lead not found");
  }

  const followUpIndex = lead.follow_ups.findIndex(
    (f: any) => f._id.toString() === followUpId.toString()
  );

  if (followUpIndex === -1) {
    throw new Error("Follow-up not found for this lead");
  }

  // Prepare updated follow-up fields
  const updatedFollowUp = {
    ...(comment && { comment: comment.trim() }),
    ...(nextFollowUp && { next_followup_date: new Date(nextFollowUp) }),
    ...(attachmentUrl && { "meta.attachment_url": attachmentUrl }),
    ...(audioAttachmentUrl && {
      "meta.audio_attachment_url": audioAttachmentUrl,
    }),
    "meta.updated_by": userId,
    "meta.updated_at": new Date(),
  };

  // Update follow-up entry using positional operator
  const updatedLead = await Lead.findOneAndUpdate(
    { _id: leadId, "follow_ups._id": followUpId },
    {
      $set: Object.entries(updatedFollowUp).reduce(
        (acc, [key, val]) => ({
          ...acc,
          [`follow_ups.$.${key}`]: val,
        }),
        {}
      ),
    },
    { new: true }
  ).select("name follow_ups property_id");

  if (!updatedLead) {
    throw new Error("Failed to update follow-up");
  }

  // Log entry for lead & property
  const logEntry = {
    title: "Lead Follow-up updated",
    description: `${existingUser.name} edited a follow-up for lead ${updatedLead.name}`,
    status: LogStatus.INFO,
    meta: {
      leadId,
      userId,
      followUpId,
    },
  };

  // Update property logs
  await Property.findByIdAndUpdate(
    updatedLead.property_id,
    { $push: { logs: logEntry } },
    { new: true }
  );

  // Add lead-specific log
  const leadLogEntry = {
    title: "Lead Follow-up updated",
    description: `${existingUser.name} updated a follow-up for this lead`,
    status: LeadLogStatus.ACTION,
    meta: {
      leadId,
      userId,
      followUpId,
    },
  };

  await Lead.findByIdAndUpdate(leadId, {
    $push: { logs: leadLogEntry },
  });

  // ✅ FIX HERE
  const updatedFollowUpObj = updatedLead.follow_ups.find(
    (f: any) => f._id.toString() === followUpId.toString()
  );

  return {
    followUp: updatedFollowUpObj,
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
  assignedByUserIds: Types.ObjectId[],
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

  if (assignedByUserIds.length > 0) {
    const existingUsers = await User.find({
      _id: { $in: assignedByUserIds },
      property_id: userPropId,
    }).lean();
    validUserIds = existingUsers.map((user) => user._id);
    if (validUserIds.length > 0) {
      query.assigned_by = { $in: validUserIds };
    }
  }

  // ✅ Source Names

  if (sourceNames.length > 0) {
    query["meta.source"] = {
      $in: sourceNames.map((id) => new Types.ObjectId(id)),
    };
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

  const cardProjection = {
    name: 1,
    phone_number: 1,
    email: 1,
    comment: 1,
    reference: 1,
    logs: 1, // if heavy, consider selecting last log only (see later)
    labels: 1,
    assigned_to: 1,
    assigned_by: 1,
    meta: 1,
    property_id: 1,
    follow_ups: 1,
    tasks: 1,
    createdAt: 1,
    updatedAt: 1,
  };

  // ✅ Sort options
  const tableProjection = {};

  // -----------------------------
  // Build sort
  // -----------------------------
  let sort: any = { createdAt: -1 };
  if (sortBy === "by_created_date") sort = { createdAt: -1 };
  // note: you were sorting by next_followup in-app using JS. We keep same behavior:
  // fetch (with projection) then sort in-memory for that specific flow.

  // -----------------------------
  // CACHING STRATEGY
  // - Card view: snapshot cache (short TTL), because UI often requests same filters
  // - Table view: cache per query+page (short TTL)
  // TTL recommendations: card 30s-60s, table 60s-120s
  // -----------------------------
  const cachePrefix = "home_leads_v1";
  const cacheKeyPayload = {
    query,
    page,
    limit,
    is_table_view,
    sortBy,
  };
  const cacheKey = makeCacheKey(cachePrefix, cacheKeyPayload);

  // Try redis first
  try {
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return cached; // cached response already has leads + statuses + pagination
    }
  } catch (err) {
    // redis might be down — continue to DB fallback
    console.warn("Redis read failed", err);
  }

  // Acquire a light lock to avoid stampede
  const lockKey = `${cacheKey}:lock`;
  const lockToken = await acquireLock(lockKey, 5000);

  // If we didn't get lock, wait briefly and try cache again
  if (!lockToken) {
    // short sleep, then check cache again
    await new Promise((r) => setTimeout(r, 150));
    const cached = await cacheGet(cacheKey);
    if (cached) return cached;
    // else continue (no lock) — it's okay, we'll read DB
  }

  // -----------------------------
  // DB fetch (no aggregation)
  // - Use lean() to reduce mongoose overhead
  // - Limit & skip for table view
  // - For card view: limit to 150 (safe), do light populate
  // -----------------------------
  let leads: any[] = [];
  let total = 0;

  if (is_table_view) {
    total = await Lead.countDocuments(query);

    leads = await Lead.find(query, tableProjection as any)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .populate({ path: "status", select: "_id title" })
      .populate({ path: "assigned_to", select: "name" })
      .populate({ path: "assigned_by", select: "name" })
      .populate({ path: "labels", select: "_id title description meta" })
      .lean();
  } else {
    // Card view (snapshot)
    leads = await Lead.find(query, cardProjection as any)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .populate({ path: "status", select: "_id title" })
      .populate({ path: "assigned_to", select: "name" })
      .populate({ path: "assigned_by", select: "name" })
      .populate({ path: "labels", select: "_id title description meta" })
      .lean();
    total = await Lead.countDocuments(query);
  }

  // -----------------------------
  // Enrich follow_ups created_by users (same efficient approach)
  // Get set of follow created_by IDs across the fetched leads only
  // -----------------------------
  const createdBySet = new Set<string>();
  for (const lead of leads) {
    (lead.follow_ups || []).forEach((fu: any) => {
      const uid = fu?.meta?.created_by;
      if (uid) createdBySet.add(uid.toString());
    });
  }

  let followUsersMap = new Map<string, any>();
  if (createdBySet.size > 0) {
    const users = await User.find(
      { _id: { $in: Array.from(createdBySet) } },
      "name title email"
    ).lean();
    followUsersMap = new Map(users.map((u) => [u._id.toString(), u]));
  }
  leads.forEach((lead) => {
    (lead.follow_ups || []).forEach((fu: any) => {
      const id = fu?.meta?.created_by?.toString();
      if (id && followUsersMap.has(id))
        fu.created_by_user = followUsersMap.get(id);
    });
  });

  if (leads.length > 1) {
    const latest = leads.reduce((a, b) =>
      new Date(a.createdAt) > new Date(b.createdAt) ? a : b
    );
    leads = [
      latest,
      ...leads.filter((l) => l._id.toString() !== latest._id.toString()),
    ];
  }

  if (sortBy === "by_next_followup_date") {
    const leadsExceptLatest = leads.slice(1); // skip latest lead
    leadsExceptLatest.sort((a, b) => {
      const aNext = getEarliestFollowUpDate(a.follow_ups);
      const bNext = getEarliestFollowUpDate(b.follow_ups);
      if (!aNext && !bNext) return 0;
      if (!aNext) return 1;
      if (!bNext) return -1;
      return new Date(aNext).getTime() - new Date(bNext).getTime();
    });
    leads = [leads[0], ...leadsExceptLatest];
  }

  // -----------------------------
  // Statuses (cache recommended separately)
  // -----------------------------
  const statusesCacheKey = `statuses:${userPropId.toString()}`;
  let statuses = await cacheGet(statusesCacheKey);
  if (!statuses) {
    const propertyStatuses = await Status.find({
      property_id: userPropId,
      "meta.is_active": true,
    }).lean();
    const defaultStatuses = await Status.find({
      title: { $in: ["New", "Processing", "Confirm", "Cancel"] },
      "meta.is_active": true,
    }).lean();
    statuses = [
      ...propertyStatuses,
      ...defaultStatuses.filter(
        (def) =>
          !propertyStatuses.some((p) => p._id.toString() === def._id.toString())
      ),
    ].map((s) => ({ ...s, _id: s._id.toString() }));

    await cacheSet(statusesCacheKey, statuses, 300);
  }

  const response = {
    leads,
    statuses,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPrevPage: page > 1,
    },
  };


 
  try {
    const ttl = is_table_view ? 120 : 45;
    await cacheSet(cacheKey, response, ttl);

    // release lock if we acquired it
    if (lockToken) await releaseLock(lockKey, lockToken);
  } catch (err) {
    console.warn("Redis write failed", err);
    if (lockToken) await releaseLock(lockKey, lockToken);
  }

  return response;
};

const _leadCreationViaApi = async (
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
  const now = new Date();

  const source = await Source.findOne({
    title: "Website",
  });

  if (!source) {
    throw new Error("Default source 'Website' not found in the system");
  }

  const defaultStatus = await Status.findOne({
    title: "New",
  });
  if (!defaultStatus) {
    throw new Error("Default status 'New' not found in the system");
  }

  const ray_id = `ray-id-${uuidv4()}`;


  // Create lead
  const newLead = new Lead({
    name: customer_name,
    company_name,
    phone_number, 
    email,
    address,
    reference,
    comment,
    property_id,
    status: defaultStatus._id,
    logs: [
      {
        title: "Lead Created via API",
        description: `(${customer_name}) named lead created externally through API with status with status ${defaultStatus.title
          }.`,
        status: LeadLogStatus.ACTION,
        meta: { source: "API" },
        createdAt: now,
        updatedAt: now,
      },
    ],
    meta: {
      source: source._id,
      ray_id,
      status: "ACTIVE",
    }
  });


  if (!property) throw new Error("Workspace Linkage not found.");

  const activePackageIdRaw = getMetaValue(property.meta, "active_package");
  if (!activePackageIdRaw)
    throw new Error("No active package found for this property.");

  const activePackageId =
    typeof activePackageIdRaw === "string"
      ? new Types.ObjectId(activePackageIdRaw)
      : activePackageIdRaw;

  const activePackage = await PurchaseRecordsModel.findById(activePackageId);
  if (!activePackage)
    throw new Error("Active package not found for this property.");
  if (activePackage.status !== PurchaseStatus.COMPLETED) {
    throw new Error(
      `Your current package is ${activePackage.status}. Please renew or upgrade.`
    );
  }

  // ---------------------------------------------------
  // 🔹 VALIDATE FEATURE LIMIT
  // ---------------------------------------------------
  const activatedFeatures =
    getMetaValue(activePackage.meta, "activated_features") || [];

  const leadsFeature = activatedFeatures.find(
    (f: any) => f.title === "Leads Limit"
  );

  if (!leadsFeature)
    throw new Error("Your plan does not include Leads Limit. Please upgrade.");

  const validityDate = new Date(leadsFeature.validity);
  if (new Date() > validityDate) {
    throw new Error(
      `Lead limit expired on ${validityDate.toLocaleDateString()}. Please renew your plan.`
    );
  }

  if (leadsFeature.used >= leadsFeature.limit) {
    await Property.findByIdAndUpdate(
      defaultStatus.property_id,
      {
        $push: {
          logs: {
            title: "Lead Creation Failed",
            description: `Lead limit reached (${leadsFeature.used}/${leadsFeature.limit}). Lead (${leadData.customer_name}) NOT created.`,
            status: LogStatus.WARNING,
            meta: { leadPreview: leadData },
            createdAt: now,
            updatedAt: now,
          },
        },
      },
      { new: true }
    );

    throw new Error(
      `Lead limit reached. Used ${leadsFeature.used}/${leadsFeature.limit}.`
    );
  }

 
  await newLead.save();


  await Property.findByIdAndUpdate(
    defaultStatus.property_id,
    {
      $inc: { usage_count: 1 },
      $push: {
        logs: {
          title: "Lead Created",
          description: `(${customer_name}) named lead created externally through API with status with status ${defaultStatus.title
            }.`,
          status: LogStatus.INFO,
          meta: { leadId: newLead._id },
          createdAt: now,
          updatedAt: now,
        },
      },
    },
    { new: true }
  );


  const updatedPackage = await PurchaseRecordsModel.findOneAndUpdate(
    { _id: activePackageId, "meta.activated_features.title": "Leads Limit" },
    { $inc: { "meta.activated_features.$.used": 1 } },
    { new: true }
  );
  if (!updatedPackage) {
    throw new Error("Failed to update feature usage in package.");
  }

  // TODO: just call this function in future, to ensure that whenever a lead is created externally, you can send whatsapp mesages by deicidng a default agent in advance! 
  // await _triggerLeadAutomationWebhook(newLead);


  return newLead;
};


const _createLeadService = async (data: CreateLeadDto, ip: string) => {
  const now = new Date();
  const meta: Record<string, any> = data.meta || {};
  const locationData = await getLocationFromIP(ip);
  let assignedToId: Types.ObjectId | null = null;

  // ---------------------------------------------------
  // 🔹 ROUND-ROBIN ASSIGNMENT
  // ---------------------------------------------------
  if (data.labels?.length) {
    const label = await Label.findById(data.labels[0]);
    if (!label) throw new Error(`Label with ID ${data.labels[0]} not found`);

    label.meta ||= {};
    const assignedAgents = (label.meta.assigned_agents || []) as {
      agent_id: Types.ObjectId;
      assigned_at: Date;
    }[];

    if (assignedAgents.length) {
      const lastIndex = (label.meta.last_assigned_index as number) ?? 0;
      const nextIndex = (lastIndex + 1) % assignedAgents.length;
      assignedToId = assignedAgents[nextIndex].agent_id;

      label.meta.last_assigned_index = nextIndex;
      label.markModified("meta");
      await label.save();
    }
  }

  // ---------------------------------------------------
  // 🔹 FALLBACK TO SUPERADMIN
  // ---------------------------------------------------
  if (!assignedToId) {
    const superAdminRole = await Role.findOne({ name: "Superadmin" });
    if (!superAdminRole)
      throw new Error("Superadmin role not found in this property!");

    const superAdminUser = await User.findOne({
      property_id: data.property_id,
      role: superAdminRole._id,
    });

    if (!superAdminUser)
      throw new Error("No Superadmin user found in this property!");

    assignedToId = superAdminUser._id;
  }

  // ---------------------------------------------------
  // 🔹 DEFAULT SOURCE & STATUS
  // ---------------------------------------------------
  const [defaultSource, defaultStatus] = await Promise.all([
    Source.findOne({ title: "Landing Page Leads" }),
    Status.findOne({ title: "New" }),
  ]);

  if (!defaultStatus)
    throw new Error("Status must contain a Status named New!");

  const ray_id = `ray-id-${uuidv4()}`;

  // ---------------------------------------------------
  // 🔹 CREATE LEAD DOCUMENT
  // ---------------------------------------------------
  const lead = new Lead({
    ...data,
    labels: data.labels?.map((id) => new Types.ObjectId(id)) || [],
    status: data.status || defaultStatus._id,
    assigned_to: assignedToId,
    assigned_by: data.assigned_by ? new Types.ObjectId(data.assigned_by) : null,
    property_id: data.property_id || defaultStatus.property_id,
    meta: {
      ray_id,
      source: data.source || defaultSource?._id,
      location: locationData,
      status: "ACTIVE",
      whatsapp: meta.whatsapp || "",
      course: meta.course || "",
      stream: meta.stream || "",
    },
    logs: [
      {
        title: "Lead created",
        description: `Lead created by ${data?.name || "Unknown"} with status ${
          defaultStatus.title
        }`,
        status: LeadLogStatus.ACTION,
        meta: {},
        createdAt: now,
        updatedAt: now,
      },
    ],
  });

  // ---------------------------------------------------
  // 🔹 FETCH PROPERTY + ACTIVE PACKAGE
  // ---------------------------------------------------
  const property = await Property.findById(data.property_id).lean();
  if (!property) throw new Error("Workspace Linkage not found.");

  const activePackageIdRaw = getMetaValue(property.meta, "active_package");
  if (!activePackageIdRaw)
    throw new Error("No active package found for this property.");

  const activePackageId =
    typeof activePackageIdRaw === "string"
      ? new Types.ObjectId(activePackageIdRaw)
      : activePackageIdRaw;

  const activePackage = await PurchaseRecordsModel.findById(activePackageId);
  if (!activePackage)
    throw new Error("Active package not found for this property.");

  // ---------------------------------------------------
  // 🔹 CHECK PACKAGE STATUS
  // ---------------------------------------------------
  if (activePackage.status !== PurchaseStatus.COMPLETED) {
    throw new Error(
      `Your current package is ${activePackage.status}. Please renew or upgrade.`
    );
  }

  // ---------------------------------------------------
  // 🔹 VALIDATE FEATURE LIMIT
  // ---------------------------------------------------
  const activatedFeatures =
    getMetaValue(activePackage.meta, "activated_features") || [];

  const leadsFeature = activatedFeatures.find(
    (f: any) => f.title === "Leads Limit"
  );

  if (!leadsFeature)
    throw new Error("Your plan does not include Leads Limit. Please upgrade.");

  const validityDate = new Date(leadsFeature.validity);
  if (new Date() > validityDate) {
    throw new Error(
      `Lead limit expired on ${validityDate.toLocaleDateString()}. Please renew your plan.`
    );
  }

  if (leadsFeature.used >= leadsFeature.limit) {
    await Property.findByIdAndUpdate(
      defaultStatus.property_id,
      {
        $push: {
          logs: {
            title: "Lead Creation Failed",
            description: `Lead limit reached (${leadsFeature.used}/${leadsFeature.limit}). Lead (${data.name}) NOT created.`,
            status: LogStatus.WARNING,
            meta: { leadPreview: data },
            createdAt: now,
            updatedAt: now,
          },
        },
      },
      { new: true }
    );

    throw new Error(
      `Lead limit reached. Used ${leadsFeature.used}/${leadsFeature.limit}.`
    );
  }

  // ---------------------------------------------------
  // 🔹 SAVE LEAD
  // ---------------------------------------------------
  await lead.save();

  // ---------------------------------------------------
  // 🔹 SUCCESS LOG + USAGE UPDATE
  // ---------------------------------------------------
  await Property.findByIdAndUpdate(
    defaultStatus.property_id,
    {
      $inc: { usage_count: 1 },
      $push: {
        logs: {
          title: "Lead Created",
          description: `Lead (${lead.name}) created successfully.`,
          status: LogStatus.INFO,
          meta: { leadId: lead._id },
          createdAt: now,
          updatedAt: now,
        },
      },
    },
    { new: true }
  );

  const updatedPackage = await PurchaseRecordsModel.findOneAndUpdate(
    { _id: activePackageId, "meta.activated_features.title": "Leads Limit" },
    { $inc: { "meta.activated_features.$.used": 1 } },
    { new: true }
  );
  if (!updatedPackage) {
    throw new Error("Failed to update feature usage in package.");
  }

  // ---------------------------------------------------
  // 🔹 TRIGGER AUTOMATION
  // ---------------------------------------------------
  await _triggerLeadAutomationWebhook(lead);

  return lead;
};

const _getMissedFollowUpsService = async (
  propId: Types.ObjectId
): Promise<MissedFollowUpLead[]> => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const leads = await Lead.find(
    {
      property_id: propId,
      "follow_ups.next_followup_date": { $lt: today },
    },
    {
      name: 1,
      follow_ups: 1,
      status: 1,
      assigned_to: 1,
      labels: 1,
      meta: 1,
      phone_number: 1,
      email: 1,
      company_name: 1,
      addresss: 1,
    }
  )

    .populate<{ status: any }>("status", "title")
    .populate<{ assigned_to: any }>("assigned_to", "name email")
    .populate<{ labels: any[] }>("labels", "title")
    .lean();

  const missed: MissedFollowUpLead[] = [];

  for (const lead of leads) {
    if (!lead.follow_ups?.length) continue;

    const latest = lead.follow_ups.reduce((a: any, b: any) =>
      new Date(a.next_followup_date) > new Date(b.next_followup_date) ? a : b
    );

    const followDate = new Date(latest.next_followup_date);

    if (followDate < today) {
      missed.push({
        leadId: lead._id,
        name: lead.name,

        phone_number: lead.phone_number || "",
        email: lead.email || "",
        address: lead.address || "",
        company_name: lead.company_name || "",


        status:
          lead.status && typeof lead.status === "object" && lead.status.title
            ? lead.status
            : {},

        assigned_to:
          lead.assigned_to && typeof lead.assigned_to === "object"
            ? lead.assigned_to
            : null,

        labels:
          Array.isArray(lead.labels) && lead.labels.length ? lead.labels : [],

        next_followup_date: followDate,
        comment: latest.comment,
        meta: lead.meta,
      });
    }
  }

  missed.sort(
    (a, b) => a.next_followup_date.getTime() - b.next_followup_date.getTime()
  );

  return missed;
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
    throw new Error("Telecaller not found");
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
    title: "A new Telecaller assigned!",
    description: `${existingUser.name} changed lead's assignment to ${existingChatAgent?.name}`,
    status: LogStatus.INFO,
    meta: {
      leadId,
      userId,
    },
  };

  const leadLogEntry = {
    title: "A new Telecaller assigned!",
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
  const matchStage: any = {
    "meta.status": { $ne: "ARCHIVED" },
  };

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



const _getMissedFollowUpsForDay = async (
  userId: Types.ObjectId,
  propertyId?: string
) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const query: any = {
    "follow_ups.next_followup_date": { $lt: today },
  };

  if (propertyId) {
    query.property_id = new Types.ObjectId(propertyId);
  }
  if (userId) {
    query.assigned_to = new Types.ObjectId(userId);
  }

  const leads = await Lead.find(query)
    .populate("assigned_to", "name email")
    .populate("status", "name")
    .populate("labels", "name")
    .lean();

  const filteredLeads = leads.map((lead) => {
    const missedFollowUps = lead.follow_ups.filter(
      (fu: any) => fu.next_followup_date && fu.next_followup_date < today
    );
    return {
      ...lead,
      missed_follow_ups: missedFollowUps,
    };
  });

  return filteredLeads.filter((l) => l.missed_follow_ups.length > 0);
};

const _fetchPaginatedArchivedLeads = async (
  propId: Types.ObjectId,
  page: number = 1,
  limit: number = 10
) => {
  const skip = (page - 1) * limit;

  const filter = {
    property_id: propId,
    "meta.status": "ARCHIVED",
  };

  const [leads, total] = await Promise.all([
    Lead.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("assigned_to", "name email")
      .populate("status", "name")
      .populate("labels", "name")
      .lean(),
    Lead.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(total / limit);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  return {
    leads,
    pagination: {
      totalItems: total,
      totalPages,
      currentPage: page,
      limit,
      hasNextPage,
      hasPrevPage,
    },
  };
};

const _getTodaysFollowups = async (
  userId: Types.ObjectId,
  propertyId?: string
) => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const query: any = {
    "follow_ups.next_followup_date": {
      $gte: startOfDay,
      $lte: endOfDay,
    },
  };

  if (propertyId) {
    query.property_id = new Types.ObjectId(propertyId);
  }
  if (userId) {
    query.assigned_to = new Types.ObjectId(userId);
  }

  const leads = await Lead.find(query)
    .populate("assigned_to", "name email")
    .populate("status", "name")
    .populate("labels", "name")
    .lean();

  // Filter followups to only today's
  const filteredLeads = leads.map((lead) => {
    const todaysFollowUps = lead.follow_ups.filter(
      (fu: any) =>
        fu.next_followup_date &&
        new Date(fu.next_followup_date) >= startOfDay &&
        new Date(fu.next_followup_date) <= endOfDay
    );
    return {
      ...lead,
      todays_follow_ups: todaysFollowUps,
    };
  });

  // Return only leads that have today's followups
  return filteredLeads.filter((l) => l.todays_follow_ups.length > 0);
};

const _getLeadsBySourceAndAgentService = async (propIdRaw: Types.ObjectId | string) => {
  const propId =
    typeof propIdRaw === "string" ? new Types.ObjectId(propIdRaw) : propIdRaw;

  // Get telecaller role
  const telecallerRole = await Role.findOne({ name: "Telecaller" });

  // Get ALL sources for this property
  const sources = await Source.find({ property_id: propId }).sort({ createdAt: 1 });

  // Build map sourceId → title
  const sourcesMap: Record<string, string> = {};
  sources.forEach((s) => {
    sourcesMap[String(s._id)] = s.title;
  });

  const baseMatch = {
    property_id: propId,
    "meta.status": { $nin: ["ARCHIVED", "CONVERTED TO CUSTOMER"] }
  };

  // Total leads
  const totalLeads = await Lead.countDocuments(baseMatch);

  /**
   * IMPORTANT:
   * We DO NOT group by role here.
   * We group by agent + sourceId.
   */
  const sourceWiseCounts = await Lead.aggregate([
    { $match: baseMatch },

  // bring assigned user (may be null)
    {
      $lookup: {
        from: "users",
        localField: "assigned_to",
        foreignField: "_id",
        as: "assignedUser",
      }
    },
    {
      $unwind: {
        path: "$assignedUser",
        preserveNullAndEmptyArrays: true
      }
    },

    // group by agent + source
    {
      $group: {
        _id: {
          agentId: { $ifNull: ["$assigned_to", null] }, // unassigned
          agentName: { $ifNull: ["$assignedUser.name", "Unassigned"] },
          sourceId: { $ifNull: ["$meta.source", null] }
        },
        count: { $sum: 1 }
      }
    }
  ]);

  // ------------------------------
  // Build agent map
  // ------------------------------
  const agentMap: Record<string, any> = {};

  sourceWiseCounts.forEach((row) => {
    const rawAgentId = row._id.agentId;
    const agentKey = rawAgentId ? String(rawAgentId) : "UNASSIGNED";
    const agentName = row._id.agentName;

    const sourceId = row._id.sourceId ? String(row._id.sourceId) : null;
    const sourceTitle =
      sourceId && sourcesMap[sourceId] ? sourcesMap[sourceId] : "Unknown";

    const cnt = row.count || 0;

    if (!agentMap[agentKey]) {
      agentMap[agentKey] = {
        agent_id: rawAgentId || null,
        agent_name: agentName,
        lead_count: 0,
        leads_per_source_map: {}
      };
    }

    agentMap[agentKey].lead_count += cnt;
    agentMap[agentKey].leads_per_source_map[sourceTitle] =
      (agentMap[agentKey].leads_per_source_map[sourceTitle] || 0) + cnt;
  });

  // ------------------------------
  // Build final agents array
  // ------------------------------
  const agents = Object.values(agentMap).map((a: any) => {
    const leads_per_source = sources.map((s) => ({
      [s.title]: a.leads_per_source_map[s.title] || 0
    }));

    if (a.leads_per_source_map["Unknown"])
      leads_per_source.push({ Unknown: a.leads_per_source_map["Unknown"] });

    return {
      agent_id: a.agent_id,
      agent_name: a.agent_name,
      lead_count: a.lead_count,
      leads_per_source
    };
  });

  // ------------------------------
  // Unassigned
  // ------------------------------
  const unassignedCount = agentMap["UNASSIGNED"]
    ? agentMap["UNASSIGNED"].lead_count
    : 0;

  // ------------------------------
  // MISSED FOLLOWUPS (same logic)
  // ------------------------------
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let missed_followups = { total: 0, telecallers: [] as any[] };

  if (telecallerRole) {
    const missed = await Lead.aggregate([
      {
        $match: {
          ...baseMatch,
          "follow_ups.next_followup_date": { $lt: today }
        }
      },
      {
        $lookup: {
          from: "users",
          localField: "assigned_to",
          foreignField: "_id",
          as: "assignedUser"
        }
      },
      { $unwind: { path: "$assignedUser", preserveNullAndEmptyArrays: true } },
      { $match: { "assignedUser.role": telecallerRole._id } },
      {
        $group: {
          _id: { agentId: "$assigned_to", agentName: "$assignedUser.name" },
          missedCount: { $sum: 1 }
        }
      }
    ]);

    missed_followups.total = missed.reduce((s, r) => s + r.missedCount, 0);
    missed_followups.telecallers = missed.map((r) => ({
      agent_id: r._id.agentId,
      agent_name: r._id.agentName,
      missed_count: r.missedCount
    }));
  }

  // ------------------------------
  // CONVERSION RATES
  // ------------------------------
  let conversion_rates = { totalConverted: 0, telecallers: [] as any[] };

  if (telecallerRole) {
    const converted = await Lead.aggregate([
      {
        $match: {
          ...baseMatch,
          "meta.status": "CONVERTED TO CUSTOMER"
        }
      },
      {
        $lookup: {
          from: "users",
          localField: "assigned_to",
          foreignField: "_id",
          as: "assignedUser"
        }
      },
      { $unwind: { path: "$assignedUser", preserveNullAndEmptyArrays: true } },
      { $match: { "assignedUser.role": telecallerRole._id } },
      {
        $group: {
          _id: { agentId: "$assigned_to", agentName: "$assignedUser.name" },
          convertedCount: { $sum: 1 }
        }
      }
    ]);

    conversion_rates.totalConverted = converted.reduce(
      (s, r) => s + r.convertedCount,
      0
    );

    conversion_rates.telecallers = converted.map((r) => {
      const agentIdStr = r._id.agentId ? String(r._id.agentId) : null;
      const totalForAgent =
        agentIdStr && agentMap[agentIdStr]
          ? agentMap[agentIdStr].lead_count
          : 0;

      const rate =
        totalForAgent > 0 ? (r.convertedCount / totalForAgent) * 100 : 0;

      return {
        agent_id: r._id.agentId,
        agent_name: r._id.agentName,
        converted: r.convertedCount,
        conversion_rate: Number(rate.toFixed(2))
      };
    });
  }

  // ------------------------------
  // FINAL RESPONSE
  // ------------------------------
  return {
    totalLeads,
    agents,
    unassigned: { lead_count: unassignedCount },
    missed_followups,
    conversion_rates
  };
};



const _getLeadsByLabelAndAgentService = async (
  propIdRaw: Types.ObjectId | string
) => {
  const propId =
    typeof propIdRaw === "string" ? new Types.ObjectId(propIdRaw) : propIdRaw;

  const telecallerRole = await Role.findOne({ name: "Telecaller" });

  // fetch all labels under this property
  const labels = await Label.find({ property_id: propId }).sort({
    createdAt: 1,
  });

  // build label map — labelId(string) → title
  const labelsMap: Record<string, string> = {};
  labels.forEach((l) => {
    labelsMap[String(l._id)] = l.title;
  });

  const baseMatch = {
    property_id: propId,
    "meta.status": { $nin: ["ARCHIVED", "CONVERTED TO CUSTOMER"] },
  };

  // total lead count
  const totalLeads = await Lead.countDocuments(baseMatch);

  /**
   * IMPORTANT:
   * Leads may have MULTIPLE labels.
   * We use $unwind to count per-label correctly.
   */
  const labelWiseCounts = await Lead.aggregate([
    { $match: baseMatch },

    { $unwind: { path: "$labels", preserveNullAndEmptyArrays: true } },

  // bring assigned user (to get agent name)
    {
      $lookup: {
        from: "users",
        localField: "assigned_to",
        foreignField: "_id",
        as: "assignedUser",
      },
    },
    {
      $unwind: {
        path: "$assignedUser",
        preserveNullAndEmptyArrays: true,
      },
    },

    {
      $group: {
        _id: {
          agentId: { $ifNull: ["$assigned_to", null] },
          agentName: { $ifNull: ["$assignedUser.name", "Unassigned"] },
          labelId: { $ifNull: ["$labels", null] },
        },
        count: { $sum: 1 },
      },
    },
  ]);

  // Build agent map
  const agentMap: Record<string, any> = {};

  labelWiseCounts.forEach((row) => {
    const rawAgentId = row._id.agentId;
    const agentKey = rawAgentId ? String(rawAgentId) : "UNASSIGNED";
    const agentName = row._id.agentName;

    const labelId = row._id.labelId ? String(row._id.labelId) : null;
    const labelTitle =
      labelId && labelsMap[labelId] ? labelsMap[labelId] : "Unknown";

    const cnt = row.count || 0;

    if (!agentMap[agentKey]) {
      agentMap[agentKey] = {
        agent_id: rawAgentId || null,
        agent_name: agentName,
        lead_count: 0,
        leads_per_label_map: {},
      };
    }

    agentMap[agentKey].lead_count += cnt;
    agentMap[agentKey].leads_per_label_map[labelTitle] =
      (agentMap[agentKey].leads_per_label_map[labelTitle] || 0) + cnt;
  });

  // Convert agent map → final array format
  const agents = Object.values(agentMap).map((agent: any) => {
    const leads_per_label = labels.map((l) => ({
      [l.title]: agent.leads_per_label_map[l.title] || 0,
    }));

    if (agent.leads_per_label_map["Unknown"]) {
      leads_per_label.push({ Unknown: agent.leads_per_label_map["Unknown"] });
    }

    return {
      agent_id: agent.agent_id,
      agent_name: agent.agent_name,
      lead_count: agent.lead_count,
      leads_per_label,
    };
  });

  // unassigned
  const unassignedCount = agentMap["UNASSIGNED"]
    ? agentMap["UNASSIGNED"].lead_count
    : 0;

  // MISSED FOLLOWUPS (same as status service)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let missed_followups = { total: 0, telecallers: [] as any[] };

  if (telecallerRole) {
    const missed = await Lead.aggregate([
      {
        $match: {
          ...baseMatch,
          "follow_ups.next_followup_date": { $lt: today },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "assigned_to",
          foreignField: "_id",
          as: "assignedUser",
        },
      },
      {
        $unwind: {
          path: "$assignedUser",
          preserveNullAndEmptyArrays: true,
        },
      },
      { $match: { "assignedUser.role": telecallerRole._id } },
      {
        $group: {
          _id: { agentId: "$assigned_to", agentName: "$assignedUser.name" },
          missedCount: { $sum: 1 },
        },
      },
    ]);

    missed_followups.total = missed.reduce(
      (sum, r) => sum + r.missedCount,
      0
    );
    missed_followups.telecallers = missed.map((r) => ({
      agent_id: r._id.agentId,
      agent_name: r._id.agentName,
      missed_count: r.missedCount,
    }));
  }

  // CONVERSION RATES (same as status service)
  let conversion_rates = { totalConverted: 0, telecallers: [] as any[] };

  if (telecallerRole) {
    const converted = await Lead.aggregate([
      {
        $match: {
          ...baseMatch,
          "meta.status": "CONVERTED TO CUSTOMER",
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "assigned_to",
          foreignField: "_id",
          as: "assignedUser",
        },
      },
      {
        $unwind: {
          path: "$assignedUser",
          preserveNullAndEmptyArrays: true,
        },
      },
      { $match: { "assignedUser.role": telecallerRole._id } },
      {
        $group: {
          _id: { agentId: "$assigned_to", agentName: "$assignedUser.name" },
          convertedCount: { $sum: 1 },
        },
      },
    ]);

    conversion_rates.totalConverted = converted.reduce(
      (sum, r) => sum + r.convertedCount,
      0
    );

    conversion_rates.telecallers = converted.map((r) => {
      const agentIdStr = r._id.agentId ? String(r._id.agentId) : null;
      const totalForAgent =
        agentIdStr && agentMap[agentIdStr]
          ? agentMap[agentIdStr].lead_count
          : 0;

      const rate =
        totalForAgent > 0 ? (r.convertedCount / totalForAgent) * 100 : 0;

      return {
        agent_id: r._id.agentId,
        agent_name: r._id.agentName,
        converted: r.convertedCount,
        conversion_rate: Number(rate.toFixed(2)),
      };
    });
  }

  return {
    totalLeads,
    agents,
    unassigned: { lead_count: unassignedCount },
    missed_followups,
    conversion_rates,
  };
};


const _getLeadsByStatusAndAgentService = async (propIdRaw: Types.ObjectId | string) => {
  // normalize propId
  const propId = typeof propIdRaw === "string" ? new Types.ObjectId(propIdRaw) : propIdRaw;

  // fetch telecaller role and statuses
  const telecallerRole = await Role.findOne({ name: "Telecaller" });
  const statuses = await Status.find({ property_id: propId }).sort({ createdAt: 1 });

  // build map statusId(string) => title for reliable mapping later
  const statusesMap: Record<string, string> = {};
  statuses.forEach((s) => {
    statusesMap[String(s._id)] = s.title;
  });

  const baseMatch = {
    property_id: propId,
    "meta.status": { $nin: ["ARCHIVED", "CONVERTED TO CUSTOMER"] }
  };

  // total leads
  const totalLeads = await Lead.countDocuments(baseMatch);

  /**
   * IMPORTANT: group by the raw `status` ObjectId (no lookup).
   * We'll map the status id -> title using statusesMap after aggregation.
   */
  const statusWiseCounts = await Lead.aggregate([
    { $match: baseMatch },

  // bring assigned user (just to capture name) but not required for status matching
    {
      $lookup: {
        from: "users",
        localField: "assigned_to",
        foreignField: "_id",
        as: "assignedUser"
      }
    },
    { $unwind: { path: "$assignedUser", preserveNullAndEmptyArrays: true } },


    {
      $group: {
        _id: {
          agentId: { $ifNull: ["$assigned_to", null] },    // null for unassigned
          agentName: { $ifNull: ["$assignedUser.name", "Unassigned"] },
          statusId: { $ifNull: ["$status", null] }         // may be null
        },
        count: { $sum: 1 }
      }
    }
  ]);


  const agentMap: Record<string, any> = {};

  statusWiseCounts.forEach((row) => {
    const rawAgentId = row._id.agentId;
    const agentKey = rawAgentId ? String(rawAgentId) : "UNASSIGNED";
    const agentName = row._id.agentName || "Unassigned";


    const statusId = row._id.statusId ? String(row._id.statusId) : null;
    const statusTitle = statusId && statusesMap[statusId] ? statusesMap[statusId] : "Unknown";

    const cnt = row.count || 0;

    if (!agentMap[agentKey]) {
      agentMap[agentKey] = {
        agent_id: agentKey === "UNASSIGNED" ? null : rawAgentId,
        agent_name: agentName,
        lead_count: 0,
        leads_per_status_map: {} as Record<string, number>
      };
    }

    agentMap[agentKey].lead_count += cnt;


    agentMap[agentKey].leads_per_status_map[statusTitle] =
      (agentMap[agentKey].leads_per_status_map[statusTitle] || 0) + cnt;
  });


  const agents = Object.values(agentMap).map((a: any) => {
    const leads_per_status = statuses.map((s) => ({
      [s.title]: a.leads_per_status_map[s.title] || 0
    }));


    if (a.leads_per_status_map["Unknown"]) {
      leads_per_status.push({ Unknown: a.leads_per_status_map["Unknown"] });
    }

    return {
      agent_id: a.agent_id,
      agent_name: a.agent_name,
      lead_count: a.lead_count,
      leads_per_status
    };
  });


  const unassignedCount = agentMap["UNASSIGNED"] ? agentMap["UNASSIGNED"].lead_count : 0;


  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let missed_followups = { total: 0, telecallers: [] as any[] };
  if (telecallerRole) {
    const missed = await Lead.aggregate([
      {
        $match: Object.assign({}, baseMatch, {
          "follow_ups.next_followup_date": { $lt: today }
        })
      },
      {
        $lookup: {
          from: "users",
          localField: "assigned_to",
          foreignField: "_id",
          as: "assignedUser"
        }
      },
      { $unwind: { path: "$assignedUser", preserveNullAndEmptyArrays: true } },
      {
        $match: { "assignedUser.role": telecallerRole._id }
      },
      {
        $group: {
          _id: { agentId: "$assigned_to", agentName: "$assignedUser.name" },
          missedCount: { $sum: 1 }
        }
      }
    ]);

    missed_followups.total = missed.reduce((s: number, r: any) => s + r.missedCount, 0);
    missed_followups.telecallers = missed.map((r: any) => ({
      agent_id: r._id.agentId,
      agent_name: r._id.agentName,
      missed_count: r.missedCount
    }));
  }


  let conversion_rates = { totalConverted: 0, telecallers: [] as any[] };
  if (telecallerRole) {
    const converted = await Lead.aggregate([
      {
        $match: Object.assign({}, baseMatch, {
          "meta.status": "CONVERTED TO CUSTOMER"
        })
      },
      {
        $lookup: {
          from: "users",
          localField: "assigned_to",
          foreignField: "_id",
          as: "assignedUser"
        }
      },
      { $unwind: { path: "$assignedUser", preserveNullAndEmptyArrays: true } },
      {
        $match: { "assignedUser.role": telecallerRole._id }
      },
      {
        $group: {
          _id: { agentId: "$assigned_to", agentName: "$assignedUser.name" },
          convertedCount: { $sum: 1 }
        }
      }
    ]);

    conversion_rates.totalConverted = converted.reduce((s: number, r: any) => s + r.convertedCount, 0);
    conversion_rates.telecallers = converted.map((r: any) => {
      const agentIdStr = r._id.agentId ? String(r._id.agentId) : null;
      const telecallerTotal = agentIdStr && agentMap[agentIdStr] ? agentMap[agentIdStr].lead_count : 0;
      const rate = telecallerTotal > 0 ? (r.convertedCount / telecallerTotal) * 100 : 0;
      return {
        agent_id: r._id.agentId,
        agent_name: r._id.agentName,
        converted: r.convertedCount,
        conversion_rate: Number(rate.toFixed(2))
      };
    });
  }

  return {
    totalLeads,
    agents,
    unassigned: { lead_count: unassignedCount },
    missed_followups,
    conversion_rates
  };
};




export {
  _leadCreationViaApi,
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

  _getMissedFollowUpsForDay,
  _fetchPaginatedArchivedLeads,
  _getTodaysFollowups,
  _getLeadsBySourceAndAgentService,
  _getLeadsByLabelAndAgentService,
  _getLeadsByStatusAndAgentService,
  _editFollowUp,
};
