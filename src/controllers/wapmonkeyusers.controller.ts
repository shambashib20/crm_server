import SuccessResponse from "../middlewares/success.middleware";
import { _fetchAndSyncWapMonkeyDevices } from "../services/wapmonkeyusers.service";

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

export { SyncWhatsAppDevicesController };
