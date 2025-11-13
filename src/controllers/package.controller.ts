import SuccessResponse from "../middlewares/success.middleware";

import {
  _createPackageManually,
  _createPaymentLinkForPackage,
  _createPurchaseRecord,
  _fetchPricingPlans,
} from "../services/package.service";

import mongoose, { Types } from "mongoose";

const FetchPricingPlans = async (req: any, res: any) => {
  try {
    const plans = await _fetchPricingPlans();
    return res
      .status(200)
      .json(new SuccessResponse("Pricing Plans fetched!", 200, plans));
  } catch (error: any) {
    console.error("Error fetching pricing plans:", error);
    return res.status(500).json(new SuccessResponse(error.message, 500));
  }
};

const CreatePurchaseRecord = async (req: any, res: any) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const record = await _createPurchaseRecord(req.body, session);
    await session.commitTransaction();
    session.endSession();

    return res
      .status(201)
      .json(new SuccessResponse("Purchase record created!", 201, record));
  } catch (error: any) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error creating purchase record:", error);

    return res.status(500).json(new SuccessResponse(error.message, 500));
  }
};

const CreatePaymentProcessForPackage = async (req: any, res: any) => {
  try {
    const { packageId } = req.body;

    if (!packageId) {
      return res
        .status(400)
        .json(new SuccessResponse("packageId is required", 400));
    }

    const userWorkspace = req.user.property_id;

    if (!userWorkspace) {
      return res
        .status(400)
        .json(new SuccessResponse("User's property_id is missing", 400));
    }

    const paymentLinkData = await _createPaymentLinkForPackage(
      new Types.ObjectId(packageId),
      new Types.ObjectId(userWorkspace),
      new Types.ObjectId(req.user._id)
    );

    return res
      .status(200)
      .json(new SuccessResponse("Payment link created!", 200, paymentLinkData));
  } catch (error: any) {
    console.error("Error creating payment link for package:", error);
    return res.status(500).json(new SuccessResponse(error.message, 500));
  }
};

export {
  FetchPricingPlans,
  CreatePurchaseRecord,
  CreatePaymentProcessForPackage,
};
