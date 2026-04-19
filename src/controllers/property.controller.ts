import { Types } from "mongoose";
import SuccessResponse from "../middlewares/success.middleware";
import { _createNewUserForOnboarding } from "../services/onboarding.service";
import {
  _createApiKeyService,
  _createPropertyForOnboarding,
  _fetchApiKeysService,
  _fetchPaginatedProperties,
  _fetchPropertyDetails,
  _fetchPropertyLogs,
  _updatePropertyById,
  _uploadWorkspaceProfilePicture,
  _deleteWorkspaceLogService,
} from "../services/property.service";
import Property from "../models/property.model";

const FetchPropertyLogs = async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const user_id = req.user._id;

    const logs = await _fetchPropertyLogs(
      new Types.ObjectId(id),
      new Types.ObjectId(user_id)
    );
    return res
      .status(200)
      .json(
        new SuccessResponse("Workspace logs fetched successfully", 200, logs)
      );
  } catch (error: any) {
    return res
      .status(500)
      .json(new SuccessResponse(error.message || "Something went wrong", 500));
  }
};

const PropertyDetails = async (req: any, res: any) => {
  try {
    const propId = req.user.property_id;
    const user_id = req.user._id;

    const property = await _fetchPropertyDetails(
      new Types.ObjectId(propId),
      new Types.ObjectId(user_id)
    );
    return res
      .status(200)
      .json(
        new SuccessResponse(
          "Workspace details fetched successfully",
          200,
          property
        )
      );
  } catch (error: any) {
    return res
      .status(500)
      .json(new SuccessResponse(error.message || "Something went wrong", 500));
  }
};

const CreatePropertyForOnboarding = async (req: any, res: any) => {
  try {
    const {
      roleName,
      name,
      email,
      phone_number,
      password,
      orgName,
      orgDescription,
    } = req.body;

    const newOnboarding = await _createNewUserForOnboarding(
      roleName,
      name,
      email,
      phone_number,
      password,
      orgName,
      orgDescription,
    );
    return res
      .status(201)
      .json(
        new SuccessResponse(
          "Workspace created successfully",
          201,
          newOnboarding
        )
      );
  } catch (error: any) {
    return res
      .status(500)
      .json(new SuccessResponse(error.message || "Something went wrong", 500));
  }
};

const UpdatePropertyById = async (req: any, res: any) => {
  try {
    const propId = req.body.propId;
    const { name, description, status } = req.body;
    const performedBy = req.user?.name || "System";

    const response = await _updatePropertyById(
      new Types.ObjectId(propId),
      { name, description, status },
      performedBy
    );

    return res
      .status(201)
      .json(
        new SuccessResponse("Workspace updated successfully", 201, response)
      );
  } catch (error: any) {
    return res
      .status(500)
      .json(new SuccessResponse(error.message || "Something went wrong", 500));
  }
};

const TogglePropertyLogReadStatus = async (req: any, res: any) => {
  try {
    const propId = req.user.property_id;
    const { logId } = req.body;
    const property = await Property.findById(propId);

    if (!property) {
      return res
        .status(404)
        .json(new SuccessResponse("Property not found", 404));
    }

    const log = property.logs.find(
      (l) => l._id?.toString() === logId.toString()
    );

    if (!log) {
      return res
        .status(404)
        .json(new SuccessResponse("Log not found in property", 404));
    }

    const isCurrentlyRead = log.meta?.readStatus === "READ";

    log.meta = {
      ...log.meta,
      readStatus: isCurrentlyRead ? "UNREAD" : "READ",
      readAt: isCurrentlyRead ? null : new Date(),
    };

    await property.save();

    return res
      .status(200)
      .json(
        new SuccessResponse(
          `Log marked as ${isCurrentlyRead ? "UNREAD" : "READ"} successfully`,
          200,
          log
        )
      );
  } catch (error: any) {
    return res
      .status(500)
      .json(new SuccessResponse(error.message || "Something went wrong", 500));
  }
};

const CreateApiKeyController = async (req: any, res: any) => {
  try {
    const propId = req.user.property_id;
    const existingProperty = await Property.findById(propId);

    if (!existingProperty) {
      return res
        .status(404)
        .json(new SuccessResponse("Property not found", 404));
    }

    const { purpose, label_id, expiry_at } = req.body;

    const apiKey = await _createApiKeyService(propId, {
      purpose,
      label_id,
      expiry_at: expiry_at ? new Date(expiry_at) : undefined,
    });

    return res
      .status(200)
      .json(new SuccessResponse(`Api key created successfully`, 200, apiKey));
  } catch (err: any) {
    return res
      .status(500)
      .json(new SuccessResponse(err.message || "Something went wrong", 500));
  }
};

const FetchApiKeysController = async (req: any, res: any) => {
  try {
    const propId = req.user.property_id;

    const keys = await _fetchApiKeysService(propId);

    return res
      .status(200)
      .json(new SuccessResponse("API keys fetched successfully", 200, keys));
  } catch (err: any) {
    return res
      .status(500)
      .json(new SuccessResponse(err.message || "Something went wrong", 500));
  }
};

const FetchProperties = async (req: any, res: any) => {
  try {
    const { page = 1, limit = 10 } = req.body;

    const clients = await _fetchPaginatedProperties(page, limit);
    return res
      .status(200)
      .json(
        new SuccessResponse("Workspaces fetched successfully", 200, clients)
      );
  } catch (error: any) {
    return res.status(500).json(new SuccessResponse(error.message, 500));
  }
};

const UploadProfilePhotoforWorkspace = async (req: any, res: any) => {
  const propId = req.user.property_id;
  const { fileUrl } = req.body;
  try {
    const result = await _uploadWorkspaceProfilePicture(fileUrl, propId);
    return res
      .status(200)
      .json(
        new SuccessResponse(
          "Profile picture successfully uploaded!",
          200,
          result
        )
      );
  } catch (error: any) {
    return res.status(500).json(new SuccessResponse(error.message, 500));
  }
};

const DeleteWorkspaceLogController = async (req: any, res: any) => {
  try {
    const property_id = req.user.property_id;
    const user_id = req.user._id;
    const { logId } = req.params;

    if (!logId) {
      return res
        .status(400)
        .json(new SuccessResponse("Log ID is required!", 400));
    }

    const archived = await _deleteWorkspaceLogService(
      new Types.ObjectId(property_id),
      new Types.ObjectId(logId),
      new Types.ObjectId(user_id)
    );

    return res
      .status(200)
      .json(
        new SuccessResponse("Workspace log deleted and archived successfully!", 200, archived)
      );
  } catch (error: any) {
    console.error("❌ Error in DeleteWorkspaceLogController:", error);
    const status = error.message.includes("not found") ? 404 : 500;
    return res.status(status).json(new SuccessResponse(error.message, status));
  }
};

export {
  FetchPropertyLogs,
  PropertyDetails,
  CreatePropertyForOnboarding,
  UpdatePropertyById,
  TogglePropertyLogReadStatus,
  CreateApiKeyController,
  FetchApiKeysController,
  FetchProperties,
  UploadProfilePhotoforWorkspace,
  DeleteWorkspaceLogController,
};
