import { Types } from "mongoose";
import { _createSource } from "../services/source.service";

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

    return res.status(201).json({
      success: true,
      message: "Source created successfully",
      data: source,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create source",
    });
  }
};
