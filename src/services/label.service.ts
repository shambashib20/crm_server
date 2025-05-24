import { Types } from "mongoose";

import Label from "../models/label.model";

import Property from "../models/property.model";

const _fetchLabelsInProperty = async (propId: Types.ObjectId) => {
  const labels = await Label.find();

  const property = await Property.findOne({
    _id: propId,
  });

  if (!labels) {
    throw new Error(`No labels found for ${property?.name}!`);
  }

  return labels;
};

export { _fetchLabelsInProperty };
