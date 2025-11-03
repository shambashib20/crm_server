import { Types } from "mongoose";
import { AddOnDto } from "../dtos/addons.dto";
import AddOns from "../models/addonsmodel";

const _createAddOnService = async (data: AddOnDto, propId: Types.ObjectId) => {
  const newAddOn = new AddOns({
    ...data,
    property_id: propId,
  });
  await newAddOn.save();
  return newAddOn;
};

const _fetchPaginatedAddOns = async (page: number = 1, limit: number = 10) => {
  const skip = (page - 1) * limit;

  const [addons, total] = await Promise.all([
    AddOns.find().sort({ createdAt: -1 }).skip(skip).limit(limit),
    AddOns.countDocuments(),
  ]);

  const totalPages = Math.ceil(total / limit);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  return {
    addons,
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

export { _createAddOnService, _fetchPaginatedAddOns };
