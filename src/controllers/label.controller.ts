import SuccessResponse from "../middlewares/success.middleware";
import {
  _createLabelInProperty,
  _fetchLabelsInProperty,
  _fetchPaginatedLabels,
} from "../services/label.service";

const CreateLabel = async (req: any, res: any) => {
  const propId = req.user.property_id;
  const { title, description } = req.body;
  try {
    const result = await _createLabelInProperty(propId, title, description);
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

export { FetchLabels, CreateLabel, FetchPaginatedLabelsController };
