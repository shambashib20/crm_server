import { Types } from "mongoose";
import { _createSource } from "../services/source.service";
import SuccessResponse from "../middlewares/success.middleware";

// Controller usage
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

export { CreateSourceController };
