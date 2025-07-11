import SuccessResponse from "../middlewares/success.middleware";
import { _createCustomerFromLead } from "../services/customer.service";

const CreateCustomerFromLead = async (req: any, res: any) => {
  try {
    const propId = req.user.property_id;

    const leadId = req.body.leadId;

    const result = await _createCustomerFromLead(leadId, propId);
    if (!result) {
    }

    return res
      .status(201)
      .json(
        new SuccessResponse(
          "Lead converted into customer successfully!",
          201,
          result
        )
      );
  } catch (error: any) {
    const validationErrors = [
      "Lead does not exist!",
      "Property does not exist!",
      "This lead has already been converted into a customer!",
    ];

    const statusCode = validationErrors.includes(error.message) ? 400 : 500;

    return res
      .status(statusCode)
      .json(new SuccessResponse(error.message, statusCode));
  }
};

export { CreateCustomerFromLead };
