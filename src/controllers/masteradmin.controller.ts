import os from "os";
import {
  _fetchCustomersInAllProperties,
  _getMasterStats,
  _getUsersWithRolesInAllProperties,
} from "../services/master.service";
import SuccessResponse from "../middlewares/success.middleware";
import User from "../models/user.model";
import { _createPackageManually } from "../services/package.service";
import { _createFeatureService } from "../services/feature.service";
import { getDbStatus } from "../../config/db.config";
import { checkRazorpayWebhookStatus } from "../health-checkers/razorpay-webhook-checker";


const SERVER_START_TIME = new Date();

function formatUptime(startTime: Date) {
  const now = new Date();
  const diff = now.getTime() - startTime.getTime();

  const seconds = Math.floor(diff / 1000) % 60;
  const minutes = Math.floor(diff / (1000 * 60)) % 60;
  const hours = Math.floor(diff / (1000 * 60 * 60)) % 24;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  return `${days} day, ${hours} hours, ${minutes} minutes, ${seconds} seconds ago`;
}


function getSystemHealth() {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const memUsagePercent = ((usedMem / totalMem) * 100).toFixed(2);

  return {
    cpuLoad: os.loadavg()[0].toFixed(2),
    memory: {
      totalGB: (totalMem / 1024 / 1024 / 1024).toFixed(2),
      usedGB: (usedMem / 1024 / 1024 / 1024).toFixed(2),
      usagePercent: memUsagePercent,
    },
  };
}
const GetCustomersInAllProperties = async (req: any, res: any) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const result = await _fetchCustomersInAllProperties(page, limit);

    return res
      .status(200)
      .json(new SuccessResponse("Customers fetched successfully", 200, result));
  } catch (error: any) {
    return res
      .status(500)
      .json(
        new SuccessResponse(error.message || "Failed to fetch customers", 500)
      );
  }
};

const GetUsersWithRolesInAllPropertiesController = async (
  req: any,
  res: any
) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const data = await _getUsersWithRolesInAllProperties(page, limit);

    return res
      .status(200)
      .json(
        new SuccessResponse(
          "Users with roles across all properties fetched successfully!",
          200,
          data
        )
      );
  } catch (err: any) {
    return res.status(500).json({
      status: "ERROR",
      message: "Failed to fetch users with roles across all properties.",
      error: err.message || err,
    });
  }
};

const CreatePackageManually = async (req: any, res: any) => {
  try {
    const {
      title,
      description,
      validity,
      validity_in_days,
      price,
      features,
      status,
      createdBy,
      meta,
    } = req.body;

    const userId = req.user._id;

    const defaultMRIdCheck = await User.findOne({
      _id: userId,
      name: "MR Superadmin",
    });

    if (!defaultMRIdCheck) {
      return res.status(400).json({
        success: false,
        message: "Default MR ID is required for payment link generation",
      });
    }
    const defaultMRId = defaultMRIdCheck._id;

    const result = await _createPackageManually(
      {
        title,
        description,
        validity: new Date(validity),
        validity_in_days: parseInt(validity_in_days),
        price: parseFloat(price),
        features: Array.isArray(features) ? features : [],
        status,
        createdBy,
        meta,
      },
      defaultMRId
    );

    res.status(201).json(result);
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message || "Failed to create package",
    });
  }
};

const CreateFeatureController = async (req: any, res: any) => {
  try {
    const { title, description, meta } = req.body;
    const result = await _createFeatureService({
      title,
      description,
      meta,
    });
    return res
      .status(201)
      .json(new SuccessResponse("Feature created successfully", 201, result));
  } catch (error: any) {
    return res
      .status(500)
      .json(
        new SuccessResponse(error.message || "Failed to create feature", 500)
      );
  }
};


const ServerStatsController = async (req: any, res: any) => {
  try {
    // Fetch all status information in parallel for better performance
    const [dbStatus, health, paymentWebhookStatus, masterStats] =
      await Promise.all([
        getDbStatus(),
        getSystemHealth(),
        checkRazorpayWebhookStatus(),
        _getMasterStats(),
      ]);

    const serverStart = SERVER_START_TIME;
    const uptimeMsg = formatUptime(SERVER_START_TIME);

    res.status(200).json({
      status: 200,
      message: "Server and DB status fetched successfully!",
      data: {
        server: `ETC CRM server started on ${serverStart.toString()}, ${uptimeMsg}`,
        dbStatus,
        cpuLoad: health.cpuLoad,
        memory: health.memory,
        paymentWebhookStatus,
        card_statistics: {
          totalLeads: masterStats.totalLeads,
          totalClients: masterStats.totalClients,
          totalCustomers: masterStats.totalCustomers,
          totalProperties: masterStats.totalProperties,
          activeProperties: masterStats.activeProperties,
        },
      },
    });
  } catch (err: any) {
    console.error("Error in Server Status:", err);
    res.status(500).json({
      status: 500,
      message: "Error in fetching server status",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
}

export {
  GetCustomersInAllProperties,
  GetUsersWithRolesInAllPropertiesController,
  CreatePackageManually,
  CreateFeatureController, 
  ServerStatsController,
  getSystemHealth
};
