import { Types } from "mongoose";
import { PurchaseRecordsDto } from "../dtos/purchaserecords.dto";
import Package from "../models/package.model";
import PurchaseRecordsModel from "../models/purchaserecords.model";
import Property from "../models/property.model";
import { _createRazorpayPaymentLink } from "./payment.service";
import User from "../models/user.model";

const _fetchPricingPlans = async () => {
  const existingPlans = await Package.find({}).populate("features");
  if (!existingPlans || existingPlans.length === 0) {
    throw new Error("No pricing plans found.");
  }

  return existingPlans;
};

const _createPurchaseRecord = async (
  data: PurchaseRecordsDto,
  session: any
) => {
  const pkg = await Package.findById(data.package_id).populate("features");

  if (!pkg) {
    throw new Error("Package not found");
  }

  const now = new Date();
  const validityDate = new Date(now);
  validityDate.setDate(validityDate.getDate() + pkg.validity_in_days);

  const activatedFeatures = pkg.features.map((feature: any) => ({
    feature_id: feature._id,
    title: feature.title,
    limit: feature.meta.limit,
    used: 0,
    validity: validityDate,
    validity_in_days: pkg.validity_in_days,
    validity_left_till_expiration: pkg.validity_in_days,
  }));

  data.meta = {
    ...data.meta,
    activated_features: activatedFeatures,
  };

  const newRecord = new PurchaseRecordsModel({
    ...data,
    status: "COMPLETED", // or PENDING if needed
  });

  await newRecord.save({ session });
  return newRecord;
};

const _createPaymentLinkForPackage = async (
  packageId: Types.ObjectId,
  propId: Types.ObjectId,
  userId: Types.ObjectId
) => {
  try {
    const pkg = await Package.findById(packageId);
    if (!pkg) {
      throw new Error("Package not found");
    }

    const userWorkspace = await Property.findById(propId);
    if (!userWorkspace) {
      throw new Error("Property not found");
    }

    const user = await User.findById(userId);

    const pkgMeta: any =
      pkg.meta instanceof Map
        ? Object.fromEntries(pkg.meta.entries())
        : { ...pkg.meta };
    const templateLinkId = pkgMeta.payment_link_id || undefined;
    const safeNotes: Record<string, string> = {
      package_id: pkg._id.toString(),
      user_id: user?._id.toString() || "",
      property_id: userWorkspace._id.toString(),
      package_code: pkgMeta.package_code?.toString() || "",
    };
    const notes = {
      package_id: pkg._id.toString(),
      user_id: user?._id.toString(),
      property_id: userWorkspace._id.toString(),
      package_code: pkgMeta.package_code || null,
    };
    const rpResponse = await _createRazorpayPaymentLink({
      amountInINR: pkg.price,
      referenceId: `${userWorkspace._id}_${Date.now()}`,
      description: `Purchase ${pkg.title}`,
      validityInDays: pkg.validity_in_days || undefined,
      notes: safeNotes,
    } as any);

    return {
      payment_link: rpResponse.short_url,
      payment_link_id: rpResponse.id,
      raw: rpResponse,
      notes,
    };
  } catch (error) {
    throw error;
  }
};

export {
  _fetchPricingPlans,
  _createPurchaseRecord,
  _createPaymentLinkForPackage,
};
