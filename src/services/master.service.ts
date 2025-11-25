import { Types } from "mongoose";
import Customer from "../models/customer.model";
import Status from "../models/status.model";
import Lead from "../models/lead.model";
import User from "../models/user.model";
import Property from "../models/property.model";
import { PropertyStatus } from "../dtos/property.dto";
import Client from "../models/client.model";
import Role from "../models/role.model";

interface WorkspaceUser {
  user_id: Types.ObjectId;
  name: string;
  email: string;
  phone_number: string;
  role: string;
}

interface StatsData {
  totalLeads: number;
  totalClients: number;
  totalCustomers: number;
  totalProperties: number;
  activeProperties: number;
}
interface Workspace {
  property_id: Types.ObjectId;
  property_name: string;
  totalUsers: number;
  users: WorkspaceUser[];
}

const _fetchCustomersInAllProperties = async (
  page: number = 1,
  limit: number = 10
) => {
  const skip = (page - 1) * limit;

  const [customers, total] = await Promise.all([
    Customer.find()
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .lean()
      .exec(),
    Customer.countDocuments(),
  ]);

  const totalPages = Math.ceil(total / limit);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  return {
    customers,
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

const _getLeadsTrendByTelecallerService = async (
  agentId: Types.ObjectId,
  labelId: Types.ObjectId,
  statusId: Types.ObjectId,
  propId: Types.ObjectId,
  startDate?: string,
  endDate?: string
) => {
  const statusDoc = await Status.findById(statusId).select("title");
  const statusTitle = statusDoc?.title || "Unknown";

  const matchStage: any = {
    assigned_to: new Types.ObjectId(agentId),
    property_id: new Types.ObjectId(propId),
    status: new Types.ObjectId(statusId),
    labels: { $in: [new Types.ObjectId(labelId)] },
    "meta.status": {
      $ne: "CONVERTED TO CUSTOMER",
    },
  };

  if (startDate && endDate) {
    matchStage.createdAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    };
  }

  const result = await Lead.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
    {
      $project: {
        _id: 0,
        date: "$_id",
        lead_count: "$count",
      },
    },
  ]);

  const totalLeads = result.reduce((sum, r) => sum + r.lead_count, 0);
  const customerMatch: any = {
    "created_by._id": new Types.ObjectId(agentId),
    "meta.property_id": new Types.ObjectId(propId),
  };

  if (startDate && endDate) {
    customerMatch.createdAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    };
  }

  const customerResult = await Customer.aggregate([
    { $match: customerMatch },
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
      },
    },
  ]);

  const totalCustomers =
    customerResult.length > 0 ? customerResult[0].count : 0;

  const agent = await User.findById(agentId).select("name");
  const agentName = agent?.name || "Unassigned";

  // 6️⃣ Prepare unified response
  const response = {
    status: statusTitle,
    totalLeads,
    agents: [
      {
        agent_id: agentId,
        agent_name: agentName,
        lead_count: totalLeads,
      },
    ],
    unassigned: {
      lead_count: 0,
    },
    customers: {
      count: totalCustomers,
    },
  };

  return response;
};

const _getUsersWithRolesInAllProperties = async (
  page: number = 1,
  limit: number = 10
) => {
  const skip = (page - 1) * limit;

  // 1️⃣ Count total properties first
  const totalProperties = await Property.countDocuments();

  const totalPages = Math.ceil(totalProperties / limit);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  const properties = await Property.find({})
    .select("_id name")
    .skip(skip)
    .limit(limit);

  const workspaceData: Workspace[] = [];

  for (const prop of properties) {
    const users = await User.aggregate([
      {
        $match: {
          property_id: new Types.ObjectId(prop._id),
        },
      },
      {
        $lookup: {
          from: "roles",
          localField: "role",
          foreignField: "_id",
          as: "roleInfo",
        },
      },
      { $unwind: { path: "$roleInfo", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          user_id: "$_id",
          name: 1,
          email: 1,
          phone_number: 1,
          role: "$roleInfo.name",
        },
      },
    ]);

    workspaceData.push({
      property_id: prop._id,
      property_name: prop.name,
      totalUsers: users.length,
      users,
    });
  }

  return {
    workspaces: workspaceData,
    pagination: {
      totalItems: totalProperties,
      totalPages,
      currentPage: page,
      limit,
      hasNextPage,
      hasPrevPage,
    },
  };
};

const _getMasterStats = async (): Promise<StatsData> => {
  try {
    const totalLeads = await Lead.countDocuments();

    const totalClients = await Client.countDocuments();

    const superadminRole = await Role.findOne({ name: "Superadmin" });

    if (!superadminRole) {
      throw new Error("Superadmin role not found");
    }

    const totalCustomers = await User.countDocuments({
      role: superadminRole._id,
      property_id: { $exists: true, $ne: null },
    });

    const totalProperties = await Property.countDocuments();

    const activeProperties = await Property.countDocuments({
      status: PropertyStatus.ACTIVE,
      is_banned: false,
    });

    return {
      totalLeads,
      totalClients,
      totalCustomers,
      totalProperties,
      activeProperties,
    };
  } catch (error) {
    console.error("Error fetching master stats:", error);
    throw error;
  }
};



const _getTelecallerStatsService = async (
  agentId: Types.ObjectId,
  propId: Types.ObjectId,

  startDate?: string,
  endDate?: string
) => {
  const matchBase: any = {
    assigned_to: new Types.ObjectId(agentId),
    property_id: new Types.ObjectId(propId),
  };
  if (startDate && endDate) {
    matchBase.createdAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    };
  }

  const totalAssignedLeads = await Lead.countDocuments({
    ...matchBase,
    "meta.status": { $nin: ["CONVERTED TO CUSTOMER", "ARCHIVED"] },
  });


  const convertedLeads = await Lead.countDocuments({
    ...matchBase,
    "meta.status": "CONVERTED TO CUSTOMER",
  });

  const conversionRate =
    totalAssignedLeads > 0
      ? Number(((convertedLeads / totalAssignedLeads) * 100).toFixed(2))
      : 0;

  const missedFollowupsAgg = await Lead.aggregate([
    { $match: matchBase },
    { $unwind: "$follow_ups" },
    {
      $match: {
        "follow_ups.next_followup_date": { $lt: new Date() },
        "follow_ups.meta.completed": { $ne: true },
      },
    },
    { $count: "missed" },
  ]);

  const missedFollowups =
    missedFollowupsAgg.length > 0 ? missedFollowupsAgg[0].missed : 0;



  // 5️⃣ DAILY LEAD TREND
  const leadTrend = await Lead.aggregate([
    { $match: matchBase },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
    { $project: { date: "$_id", count: 1, _id: 0 } },
  ]);


  const agent = await User.findById(agentId).select("name email");

  return {
    agent: {
      id: agentId,
      name: agent?.name ?? "Unknown",
      email: agent?.email ?? "",
    },

    stats: {
      totalAssignedLeads,
      convertedLeads,
      conversionRate,
      missedFollowups,

      leadTrend,
    },
  };

}




export {
  _fetchCustomersInAllProperties,
  _getLeadsTrendByTelecallerService,
  _getUsersWithRolesInAllProperties,
  _getMasterStats,
  _getTelecallerStatsService
};
