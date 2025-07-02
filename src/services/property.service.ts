import Property from "../models/property.model";
import { PropertyDto } from "../dtos/property.dto";
import { Types } from "mongoose";

const _fetchPropertyLogs = async (propId: Types.ObjectId) => {
  try {
    const property = await Property.findById(propId, { logs: 1 });

    if (!property) {
      throw new Error("Property not found");
    }

    return property.logs;
  } catch (error: any) {
    throw new Error(`Failed to fetch logs: ${error.message}`);
  }
};

export { _fetchPropertyLogs };
