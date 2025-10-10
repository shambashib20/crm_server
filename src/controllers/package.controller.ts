import SuccessResponse from "../middlewares/success.middleware";
import {
  _createPuchaseRecord,
  _fetchPricingPlans,
} from "../services/package.service";

import mongoose from "mongoose";

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
    const record = await _createPuchaseRecord(req.body, session);
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

export { FetchPricingPlans, CreatePurchaseRecord };
