import { Types } from "mongoose";
import SuccessResponse from "../middlewares/success.middleware";
import {
  _createLabelInProperty,
  _deleteLabel,
  _fetchLabelsInProperty,
  _fetchPaginatedLabels,
  _updateLabel,
} from "../services/label.service";

const CreateLabel = async (req: any, res: any) => {
  const propId = req.user.property_id;
  const { title, description, chatAgentIds } = req.body;

  try {
    const result = await _createLabelInProperty(
      propId,
      title,
      description,
      chatAgentIds
    );

    return res
      .status(201)
      .json(new SuccessResponse("Created a label successfully!", 201, result));
  } catch (error: any) {
    return res.status(500).json(new SuccessResponse(error.message, 500));
  }
};

const FetchLabels = async (req: any, res: any) => {
  const user = req.user;

  try {
    const result = await _fetchLabelsInProperty(user.property_id);
    return res
      .status(200)
      .json(
        new SuccessResponse(
          "Statuses fetched in this organization",
          200,
          result
        )
      );
  } catch (error: any) {
    return res.status(500).json(new SuccessResponse(error.message, 500));
  }
};

const FetchPaginatedLabelsController = async (req: any, res: any) => {
  try {
    const propId = req.user.property_id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const data = await _fetchPaginatedLabels(propId, page, limit);

    return res
      .status(200)
      .json(new SuccessResponse("Labels fetched successfully", 200, data));
  } catch (err: any) {
    return res
      .status(500)
      .json(new SuccessResponse(err.message || "Something went wrong", 500));
  }
};

const UpdateLabelController = async (req: any, res: any) => {
  try {
    const { labelId } = req.params;
    const { title, description, chatAgentIds, color_code } = req.body;
    const user = req.user;

    const updates: {
      title?: string;
      description?: string;
      meta?: any;
    } = {};

    if (title) updates.title = title;
    if (description) updates.description = description;

    // Handle meta updates
    const metaUpdates: any = {};

    if (Array.isArray(chatAgentIds) && chatAgentIds.length > 0) {
      const now = new Date();
      metaUpdates.assigned_agents = chatAgentIds.map((id: string) => ({
        agent_id: new Types.ObjectId(id),
        assigned_at: now,
      }));
    }

    if (color_code) {
      metaUpdates.color_code = color_code;
    }

    if (Object.keys(metaUpdates).length > 0) {
      updates.meta = metaUpdates;
    }

    if (Object.keys(updates).length === 0) {
      return res
        .status(400)
        .json(new SuccessResponse("No fields provided for update", 400));
    }

    const updatedLabel = await _updateLabel(
      new Types.ObjectId(user.property_id),
      new Types.ObjectId(labelId),
      updates
    );

    return res
      .status(200)
      .json(
        new SuccessResponse("Label updated successfully", 200, updatedLabel)
      );
  } catch (error: any) {
    return res
      .status(500)
      .json(new SuccessResponse(error.message || "Something went wrong", 500));
  }
};


const DeleteLabelController = async (req: any, res: any) => {
  try {
    const { labelId } = req.params;
    const user = req.user;

    const deleted = await _deleteLabel(
      new Types.ObjectId(user.property_id),
      new Types.ObjectId(labelId)
    );

    return res
      .status(200)
      .json(new SuccessResponse("Label deleted successfully", 200, deleted));
  } catch (error: any) {
    return res
      .status(500)
      .json(new SuccessResponse(error.message || "Something went wrong", 500));
  }
};

export {
  FetchLabels,
  CreateLabel,
  FetchPaginatedLabelsController,
  UpdateLabelController,
  DeleteLabelController,
};
