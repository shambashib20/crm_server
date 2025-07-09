import SuccessResponse from "../middlewares/success.middleware";
import { _createNewUserForOnboarding } from "../services/onboarding.service";
import {
  _createPropertyForOnboarding,
  _fetchPropertyDetails,
  _fetchPropertyLogs,
} from "../services/property.service";

const FetchPropertyLogs = async (req: any, res: any) => {
  try {
    const { id } = req.params;

    const logs = await _fetchPropertyLogs(id);
    return res
      .status(200)
      .json(
        new SuccessResponse("Workspace logs fetched successfully", 200, logs)
      );
  } catch (error: any) {
    return res
      .status(500)
      .json(new SuccessResponse(error.message || "Something went wrong", 500));
  }
};

const PropertyDetails = async (req: any, res: any) => {
  try {
    const propId = req.user.property_id;

    const property = await _fetchPropertyDetails(propId);
    return res
      .status(200)
      .json(
        new SuccessResponse(
          "Workspace details fetched successfully",
          200,
          property
        )
      );
  } catch (error: any) {
    return res
      .status(500)
      .json(new SuccessResponse(error.message || "Something went wrong", 500));
  }
};

const CreatePropertyForOnboarding = async (req: any, res: any) => {
  try {
    const {
      roleName,
      name,
      email,
      phone_number,
      password,
      orgName,
      orgDescription,
    } = req.body;

    const newOnboarding = await _createNewUserForOnboarding(
      roleName,
      name,
      email,
      phone_number,
      password,
      orgName,
      orgDescription
    );
    return res
      .status(201)
      .json(
        new SuccessResponse(
          "Workspace created successfully",
          201,
          newOnboarding
        )
      );
  } catch (error: any) {
    return res
      .status(500)
      .json(new SuccessResponse(error.message || "Something went wrong", 500));
  }
};

export { FetchPropertyLogs, PropertyDetails, CreatePropertyForOnboarding };
