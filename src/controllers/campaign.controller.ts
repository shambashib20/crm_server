import { Types } from "mongoose";
import SuccessResponse from "../middlewares/success.middleware";
import {
  _createCampaignTemplate,
  _editCampaignTemplate,
  _getCampaignTemplates,
  _getCampaignTemplatesInMasterPanel,
} from "../services/campaign.service";

const CreateCampaignTemplateController = async (req: any, res: any) => {
  try {
    const { type, title, message, subject, email_message, sms_template_id } =
      req.body;

    const property_id = req.user?.property_id;

    if (!property_id) {
      return res
        .status(400)
        .json(
          new SuccessResponse(
            "Property ID is required! Please reauthenticate!",
            400
          )
        );
    }

    const attachments = req.files?.length
      ? req.files.map(
          (file: Express.Multer.File) => `/uploads/${file.filename}`
        )
      : [];

    const result = await _createCampaignTemplate({
      type,
      title,
      message,
      subject,
      email_message,
      sms_template_id,
      attachments,
      property_id,
    });

    return res
      .status(201)
      .json(new SuccessResponse("Add-On created successfully!", 200, result));
  } catch (err: any) {
    console.error("Create Template Error:", err);
    return res.status(500).json(new SuccessResponse(err.message, 500));
  }
};

const EditCampaignTemplateController = async (req: any, res: any) => {
  try {
    const {
      templateId,
      type,
      title,
      message,
      subject,
      email_message,
      sms_template_id,
    } = req.body;

    const property_id = req.user?.property_id;
    if (!property_id) {
      return res.status(400).json(new SuccessResponse("Reauthenticate!", 400));
    }

    let attachments = req.files?.length
      ? req.files.map(
          (file: Express.Multer.File) => `/uploads/${file.filename}`
        )
      : undefined;

    const payload: any = {
      templateId,
      type,
      title,
      message,
      subject,
      email_message,
      sms_template_id,
    };

    if (attachments) payload.attachments = attachments;

    const result = await _editCampaignTemplate(
      payload.id,
      new Types.ObjectId(property_id),
      payload
    );

    return res
      .status(200)
      .json(new SuccessResponse("Template updated successfully!", 200, result));
  } catch (err: any) {
    console.error("Edit Template Error:", err);
    return res.status(500).json(new SuccessResponse(err.message, 500));
  }
};

const FetchCampaignTemplatesController = async (req: any, res: any) => {
  try {
    const property_id = req.user?.property_id;
    if (!property_id) {
      return res.status(400).json(new SuccessResponse("Reauthenticate!", 400));
    }

    const result = await _getCampaignTemplates(new Types.ObjectId(property_id));
    return res
      .status(200)
      .json(
        new SuccessResponse("Templates fetched successfully!", 200, result)
      );
  } catch (err: any) {
    console.error("Fetch Templates Error:", err);
    return res.status(500).json(new SuccessResponse(err.message, 500));
  }
};

const FetchCampaignTemplatesInMasterPanelController = async (
  req: any,
  res: any
) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const result = await _getCampaignTemplatesInMasterPanel(page, limit);
    return res
      .status(200)
      .json(
        new SuccessResponse("Templates fetched successfully!", 200, result)
      );
  } catch (err: any) {
    console.error("Fetch Templates Error:", err);
    return res.status(500).json(new SuccessResponse(err.message, 500));
  }
};
export {
  CreateCampaignTemplateController,
  EditCampaignTemplateController,
  FetchCampaignTemplatesController,
  FetchCampaignTemplatesInMasterPanelController,
};
