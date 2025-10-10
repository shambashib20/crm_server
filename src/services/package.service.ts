import { PurchaseRecordsDto } from "../dtos/purchaserecords.dto";
import Package from "../models/package.model";
import PurchaseRecordsModel from "../models/purchaserecords.model";

const _fetchPricingPlans = async () => {
  const existingPlans = await Package.find({}).populate("features");
  if (!existingPlans || existingPlans.length === 0) {
    throw new Error("No pricing plans found.");
  }

  return existingPlans;
};

const _createPuchaseRecord = async (data: PurchaseRecordsDto, session: any) => {
  const newRecord = new PurchaseRecordsModel(data);
  await newRecord.save({ session });
  return newRecord;
};

export { _fetchPricingPlans, _createPuchaseRecord };
