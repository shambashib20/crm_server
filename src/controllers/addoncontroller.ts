import { _createAddOnService } from "../services/addon.service";

import SuccessResponse from "../middlewares/success.middleware";

const CreateAddOnController = async (req: any, res: any) => {
  const { title, description = "", value } = req.body;

  if (!title || !value) {
    return res.status(400).json({
      message: "title and value are required to create an Add-On.",
    });
  }

  try {
    const payload = { title, description, value };
    const result = await _createAddOnService(payload);

    if (!result) {
      return res
        .status(400)
        .json(new SuccessResponse("Add-On creation failed.", 400, result));
    }
    return res
      .status(200)
      .json(new SuccessResponse("Add-On created successfully!", 200, result));
  } catch (error: any) {
    return res.status(500).json(new SuccessResponse(error.message, 500));
  }
};

export { CreateAddOnController };
