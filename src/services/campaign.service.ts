import CampaignTemplate from "../models/campaign.model";
import { v4 as uuidv4 } from "uuid";
import { CampaignTemplateDto } from "../dtos/campaigns.dto";
import { Types } from "mongoose";

const _createCampaignTemplate = async (data: CampaignTemplateDto) => {
  const VARIABLE_MAPPINGS = {
    "1": "customerName",
    "2": "customerNumber",
    "3": "customerEmail",
    "4": "customerAddress",
    "5": "customerCompany",
    "6": "customerGST",
  };

  const template = new CampaignTemplate({
    ...data,
    meta: {
      ray_id: `ray-id-${uuidv4()}`,
      variable_map: VARIABLE_MAPPINGS,
      is_active: true,
    },
  });

  await template.save();
  return template;
};

const _editCampaignTemplate = async (
  templateId: Types.ObjectId,
  property_id: Types.ObjectId,
  data: Partial<CampaignTemplateDto>
) => {
  delete data.meta;

  const updated = await CampaignTemplate.findOneAndUpdate(
    { _id: templateId, property_id },
    { $set: data },
    { new: true }
  );

  if (!updated) {
    throw new Error("Template not found or unauthorized access.");
  }

  return updated;
};

const _getCampaignTemplates = async (
  property_id: Types.ObjectId,
  page: number = 1,
  limit: number = 10
) => {
  const skip = (page - 1) * limit;

  const [campaigns, total] = await Promise.all([
    CampaignTemplate.find({ property_id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    CampaignTemplate.countDocuments({ property_id }),
  ]);

  const totalPages = Math.ceil(total / limit);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  return {
    campaigns,
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

const _getCampaignTemplatesInMasterPanel = async (
  page: number = 1,
  limit: number = 10
) => {
  const skip = (page - 1) * limit;

  const [campaigns, total] = await Promise.all([
    CampaignTemplate.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    CampaignTemplate.countDocuments(),
  ]);

  const totalPages = Math.ceil(total / limit);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  return {
    campaigns,
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

export {
  _createCampaignTemplate,
  _editCampaignTemplate,
  _getCampaignTemplates,
  _getCampaignTemplatesInMasterPanel,
};
