import { Types } from "mongoose";
import Status from "../models/status.model";
import Property from "../models/property.model";

const _fetchStatusInProperty = async (propId: Types.ObjectId) => {
  const statuses = await Status.find({
    property_id: propId,
  });

  const property = await Property.findOne({
    _id: propId,
  });

  if (!statuses) {
    throw new Error(`No statuses found for ${property?.name}!`);
  }

  return statuses;
};

export { _fetchStatusInProperty };
