import {
  _createClient,
  _fetchPaginatedClients,
} from "../services/client.service";

import SuccessResponse from "../middlewares/success.middleware";

const CreateClient = async (req: any, res: any) => {
  try {
    const { name, mobile_number, email, message, from_route } = req.body;
    const ip =
      req.ip ||
      req.headers["x-forwarded-for"] ||
      req.connection.remoteAddress ||
      "";
    const newClient = await _createClient(
      { name, mobile_number, email, message, from_route },
      ip as string
    );
    return res
      .status(201)
      .json(new SuccessResponse("Client created successfully", 201, newClient));
  } catch (error: any) {
    return res

      .status(500)
      .json(new SuccessResponse(error.message || "Something went wrong", 500));
  }
};

const FetchClients = async (req: any, res: any) => {
  try {
    const { page = 1, limit = 10 } = req.body;

    const clients = await _fetchPaginatedClients(page, limit);
    return res
      .status(200)
      .json(new SuccessResponse("Clients fetched successfully", 200, clients));
  } catch (error: any) {
    return res.status(500).json(new SuccessResponse(error.message, 500));
  }
};

export { CreateClient, FetchClients };
