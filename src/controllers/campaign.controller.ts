import { Types } from "mongoose";
import SuccessResponse from "../middlewares/success.middleware";
import {
  _createCampaignTemplate,
  _editCampaignTemplate,
  _getCampaignTemplates,
  _getCampaignTemplatesInMasterPanel,
  _getWhatsAppTemplateById,
  _getCampaignTemplateById,
  _deleteCampaignTemplate,
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
    const { id } = req.params;
    const {
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

    if (!id) {
      return res
        .status(400)
        .json(new SuccessResponse("Template ID is required!", 400));
    }

    let attachments = req.files?.length
      ? req.files.map(
          (file: Express.Multer.File) => `/uploads/${file.filename}`
        )
      : undefined;

    const payload: any = { type, title, message, subject, email_message, sms_template_id };
    if (attachments) payload.attachments = attachments;

    const result = await _editCampaignTemplate(
      new Types.ObjectId(id),
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
const FetchWhatsAppTemplateByIdController = async (req: any, res: any) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res
        .status(400)
        .json(new SuccessResponse("Template ID is required!", 400));
    }

    const result = await _getWhatsAppTemplateById(id);
    return res
      .status(200)
      .json(
        new SuccessResponse("WhatsApp template fetched successfully!", 200, result)
      );
  } catch (err: any) {
    console.error("Fetch WhatsApp Template By ID Error:", err);
    return res.status(500).json(new SuccessResponse(err.message, 500));
  }
};

const EditWhatsAppTemplateController = async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { title, message } = req.body;

    const property_id = req.user?.property_id;
    if (!property_id) {
      return res.status(400).json(new SuccessResponse("Reauthenticate!", 400));
    }

    if (!id) {
      return res
        .status(400)
        .json(new SuccessResponse("Template ID is required!", 400));
    }

    const attachments = req.files?.length
      ? req.files.map(
          (file: Express.Multer.File) => `/uploads/${file.filename}`
        )
      : undefined;

    const payload: any = { title, message, type: "WHATSAPP" };
    if (attachments) payload.attachments = attachments;

    const result = await _editCampaignTemplate(
      new Types.ObjectId(id),
      new Types.ObjectId(property_id),
      payload
    );

    return res
      .status(200)
      .json(
        new SuccessResponse("WhatsApp template updated successfully!", 200, result)
      );
  } catch (err: any) {
    console.error("Edit WhatsApp Template Error:", err);
    return res.status(500).json(new SuccessResponse(err.message, 500));
  }
};

const FetchCampaignTemplateByIdController = async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const property_id = req.user?.property_id;

    if (!property_id) {
      return res.status(400).json(new SuccessResponse("Reauthenticate!", 400));
    }

    if (!id) {
      return res
        .status(400)
        .json(new SuccessResponse("Template ID is required!", 400));
    }

    const result = await _getCampaignTemplateById(
      new Types.ObjectId(id),
      new Types.ObjectId(property_id)
    );

    return res
      .status(200)
      .json(new SuccessResponse("Template fetched successfully!", 200, result));
  } catch (err: any) {
    console.error("Fetch Template By ID Error:", err);
    const status = err.message.includes("not found") ? 404 : 500;
    return res.status(status).json(new SuccessResponse(err.message, status));
  }
};

const EditCampaignTemplateByIdController = async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { type, title, message, subject, email_message, sms_template_id } =
      req.body;

    const property_id = req.user?.property_id;
    if (!property_id) {
      return res.status(400).json(new SuccessResponse("Reauthenticate!", 400));
    }

    if (!id) {
      return res
        .status(400)
        .json(new SuccessResponse("Template ID is required!", 400));
    }

    const attachments = req.files?.length
      ? req.files.map(
          (file: Express.Multer.File) => `/uploads/${file.filename}`
        )
      : undefined;

    const payload: any = { type, title, message, subject, email_message, sms_template_id };
    if (attachments) payload.attachments = attachments;

    const result = await _editCampaignTemplate(
      new Types.ObjectId(id),
      new Types.ObjectId(property_id),
      payload
    );

    return res
      .status(200)
      .json(new SuccessResponse("Template updated successfully!", 200, result));
  } catch (err: any) {
    console.error("Edit Campaign Template By ID Error:", err);
    const status = err.message.includes("not found") ? 404 : 500;
    return res.status(status).json(new SuccessResponse(err.message, status));
  }
};

const DeleteCampaignTemplateController = async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const property_id = req.user?.property_id;

    if (!property_id) {
      return res.status(400).json(new SuccessResponse("Reauthenticate!", 400));
    }

    if (!id) {
      return res
        .status(400)
        .json(new SuccessResponse("Template ID is required!", 400));
    }

    const result = await _deleteCampaignTemplate(
      new Types.ObjectId(id),
      new Types.ObjectId(property_id)
    );

    return res
      .status(200)
      .json(new SuccessResponse("Template deleted successfully!", 200, result));
  } catch (err: any) {
    console.error("Delete Campaign Template Error:", err);
    const status = err.message.includes("not found") ? 404 : 500;
    return res.status(status).json(new SuccessResponse(err.message, status));
  }
};

export {
  CreateCampaignTemplateController,
  EditCampaignTemplateController,
  FetchCampaignTemplatesController,
  FetchCampaignTemplatesInMasterPanelController,
  FetchWhatsAppTemplateByIdController,
  EditWhatsAppTemplateController,
  FetchCampaignTemplateByIdController,
  EditCampaignTemplateByIdController,
  DeleteCampaignTemplateController,
};
