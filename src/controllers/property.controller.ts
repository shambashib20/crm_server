import SuccessResponse from "../middlewares/success.middleware";
import { _fetchPropertyLogs } from "../services/property.service";

const FetchPropertyLogs = async (req: any, res: any) => {
  try {
    const { id } = req.params;

    const logs = await _fetchPropertyLogs(id);
    return res
      .status(200)
      .json(
        new SuccessResponse("Workspace logs fetched successfully", 200, logs)
      );
  } catch (error: any) {
    return res
      .status(500)
      .json(new SuccessResponse(error.message || "Something went wrong", 500));
  }
};

export { FetchPropertyLogs };
