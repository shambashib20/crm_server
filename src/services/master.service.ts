import { Types } from "mongoose";
import Customer from "../models/customer.model";
import Status from "../models/status.model";
import Lead from "../models/lead.model";
import User from "../models/user.model";

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

export { _fetchCustomersInAllProperties, _getLeadsTrendByTelecallerService };
