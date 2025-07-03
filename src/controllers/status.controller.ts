import SuccessResponse from "../middlewares/success.middleware";
import {
  _createStatusInProperty,
  _editStatusInProperty,
  _fetchStatusInProperty,
} from "../services/status.service";

const FetchStatuses = async (req: any, res: any) => {
  const user = req.user;

  try {
    const result = await _fetchStatusInProperty(user.property_id);
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

const CreateStatusInProperty = async (req: any, res: any) => {
  const propId = req.user.property_id;
  const { title, description } = req.body;

  try {
    const result = await _createStatusInProperty(title, description, propId);
    return res
      .status(201)
      .json(new SuccessResponse("Created a status succesfully!", 201, result));
  } catch (error: any) {
    return res.status(500).json(new SuccessResponse(error.message, 500));
  }
};

const UpdateStatusInProperty = async (req: any, res: any) => {
  const propId = req.user.property_id;
  const { statusId, title, description } = req.body;

  try {
    const result = await _editStatusInProperty(
      statusId,
      title,
      description,
      propId
    );
    return res
      .status(200)
      .json(
        new SuccessResponse("Updated the status succesfully!", 200, result)
      );
  } catch (error: any) {
    return res.status(500).json(new SuccessResponse(error.message, 500));
  }
};

export { FetchStatuses, CreateStatusInProperty, UpdateStatusInProperty };
