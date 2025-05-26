import SuccessResponse from "../middlewares/success.middleware";
import { _fetchStatusInProperty } from "../services/status.service";

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





export { FetchStatuses };
