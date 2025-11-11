import { _fetchCustomersInAllProperties } from "../services/master.service";
import SuccessResponse from "../middlewares/success.middleware";

const GetCustomersInAllProperties = async (req: any, res: any) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const result = await _fetchCustomersInAllProperties(page, limit);

    return res
      .status(200)
      .json(new SuccessResponse("Customers fetched successfully", 200, result));
  } catch (error: any) {
    return res
      .status(500)
      .json(
        new SuccessResponse(error.message || "Failed to fetch customers", 500)
      );
  }
};

export { GetCustomersInAllProperties };
