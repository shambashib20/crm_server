import { Types } from "mongoose";
import {
  _createSource,
  _getAllSources,
  _updateSource,
} from "../services/source.service";
import SuccessResponse from "../middlewares/success.middleware";

const CreateSourceController = async (req: any, res: any) => {
  try {
    const { title, description, meta } = req.body;
    const user = req.user;

    const source = await _createSource(
      title,
      description,
      meta,
      new Types.ObjectId(user.property_id)
    );

    return res
      .status(201)
      .json(new SuccessResponse("Source created successfully", 201, source));
  } catch (error: any) {
    return res
      .status(500)
      .json(new SuccessResponse(error.message || "Something went wrong", 500));
  }
};

const FetchSourcesController = async (req: any, res: any) => {
  try {
    const propId = req.user.property_id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const data = await _getAllSources(propId, page, limit);

    return res
      .status(200)
      .json(new SuccessResponse("Source created successfully", 200, data));
  } catch (err: any) {
    return res
      .status(500)
      .json(new SuccessResponse(err.message || "Something went wrong", 500));
  }
};

const UpdateSourceController = async (req: any, res: any) => {
  try {
    const { sourceId } = req.params;
    const { title, description, meta } = req.body;
    const user = req.user;

    const updates: {
      title?: string;
      description?: string;
      meta?: any;
    } = {};

    if (title) updates.title = title;
    if (description) updates.description = description;
    if (meta) updates.meta = meta;

    if (Object.keys(updates).length === 0) {
      return res
        .status(400)
        .json(new SuccessResponse("No fields provided for update", 400));
    }

    const updatedSource = await _updateSource(
      new Types.ObjectId(user.property_id),
      new Types.ObjectId(sourceId),
      updates
    );

    return res
      .status(200)
      .json(
        new SuccessResponse("Source updated successfully", 200, updatedSource)
      );
  } catch (error: any) {
    return res
      .status(500)
      .json(new SuccessResponse(error.message || "Something went wrong", 500));
  }
};

export {
  CreateSourceController,
  FetchSourcesController,
  UpdateSourceController,
};
