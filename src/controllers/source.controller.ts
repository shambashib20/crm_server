import { Types } from "mongoose";
import { _createSource, _getAllSources } from "../services/source.service";
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
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const data = await _getAllSources(page, limit);

    return res
      .status(200)
      .json(new SuccessResponse("Source created successfully", 200, data));
  } catch (err: any) {
    return res
      .status(500)
      .json(new SuccessResponse(err.message || "Something went wrong", 500));
  }
};

export { CreateSourceController, FetchSourcesController };
