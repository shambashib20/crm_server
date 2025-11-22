import { Types } from "mongoose";
import SuccessResponse from "../middlewares/success.middleware";
import {
  _fetchAndSyncWapMonkeyDevices,
  _updateOrAddWapMonkeyApiKey,
} from "../services/wapmonkeyusers.service";

const SyncWhatsAppDevicesController = async (req: any, res: any) => {
  try {
    await _fetchAndSyncWapMonkeyDevices();
    return res
      .status(200)
      .json(new SuccessResponse("Devices synced successfully", 200));
  } catch (err: any) {
    return res.status(500).json(new SuccessResponse(err.message, 500));
  }
};

const UpdateWapMonkeyApiKeyController = async (req: any, res: any) => {
  try {
    const property_id = req.user.property_id;
    const { wapmonkey_key } = req.body;

    if (!wapmonkey_key) {
      return res
        .status(400)
        .json(new SuccessResponse("API keys are missing!", 200));
    }

    const result = await _updateOrAddWapMonkeyApiKey(
      wapmonkey_key,
      new Types.ObjectId(property_id)
    );

    return res
      .status(200)
      .json(new SuccessResponse("API key succesfully added!", 201, result));
  } catch (err: any) {
    return res.status(500).json(new SuccessResponse(err.message, 500));
  }
};

export { SyncWhatsAppDevicesController, UpdateWapMonkeyApiKeyController };
