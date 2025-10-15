import Client from "../models/client.model";
import { v4 as uuidv4 } from "uuid";
import { getRoughLocationFromIP } from "../utils/get_rough_location.util";

const _createClient = async (
  clientData: {
    name: string;
    mobile_number: string;
    email: string;
    message: string;
    from_route: string;
  },
  ip: string
) => {
  try {
    const rayId = `ray-id-${uuidv4()}`;

    const location = await getRoughLocationFromIP(ip);

    const meta = {
      ray_id: rayId,
      login_session: {
        from_route: clientData.from_route,
        submitted_at: new Date(),
        location,
      },
    };

    const newClient = await Client.create({
      name: clientData.name,
      mobile_number: clientData.mobile_number,
      email: clientData.email,
      message: clientData.message,
      meta,
    });

    return newClient;
  } catch (error) {
    console.error("Error creating client:", error);
    throw new Error("Failed to create client");
  }
};

const _fetchPaginatedClients = async (page: number = 1, limit: number = 10) => {
  const skip = (page - 1) * limit;

  const [clients, total] = await Promise.all([
    Client.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Client.countDocuments(),
  ]);

  const totalPages = Math.ceil(total / limit);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  return {
    clients,
    pagination: {
      totalItems: total,
      totalPages,
      currentPage: page,
      limit,
      hasNextPage,
      hasPrevPage,
    },
  };
};

export { _createClient, _fetchPaginatedClients };
