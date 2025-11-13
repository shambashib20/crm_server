import { Types } from "mongoose";
import { PurchaseRecordsDto } from "../dtos/purchaserecords.dto";
import Package from "../models/package.model";
import PurchaseRecordsModel from "../models/purchaserecords.model";
import Property from "../models/property.model";
import { _createRazorpayPaymentLink } from "./payment.service";
import User from "../models/user.model";
import { PackageStatus } from "../dtos/package.dto";
import Feature from "../models/feature.model";

export interface CreatePackageInput {
  title: string;
  description: string;
  validity: Date;
  validity_in_days: number;
  price: number;
  features: string[];
  status?: PackageStatus;
  createdBy?: string;
  meta?: Record<string, any>;
}

export interface UpdatePackageInput {
  title?: string;
  description?: string;
  validity?: Date;
  validity_in_days?: number;
  price?: number;
  features?: string[];
  status?: PackageStatus;
  meta?: Record<string, any>;
}

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

const _createPackageManually = async (
  input: CreatePackageInput,
  defaultMRId: Types.ObjectId
) => {
  try {
    // Validate features exist
    const featureIds = input.features.map((id) => new Types.ObjectId(id));
    const existingFeatures = await Feature.find({
      _id: { $in: featureIds },
    });

    if (existingFeatures.length !== input.features.length) {
      throw new Error("One or more feature IDs are invalid");
    }

    // Create package
    const newPackage = await Package.create({
      title: input.title,
      description: input.description,
      validity: input.validity,
      validity_in_days: input.validity_in_days,
      price: input.price,
      features: featureIds,
      status: input.status || PackageStatus.ACTIVE,
      createdBy: defaultMRId ? new Types.ObjectId(defaultMRId) : null,
      meta: input.meta || {},
      logs: [
        {
          title: "Package Created",
          description: `${input.title} created successfully`,
          status: PackageStatus.ACTIVE,
          meta: { source: "package_service" },
        },
      ],
    });

    // Generate Razorpay payment link if price > 0
    let paymentLinkData: {
      payment_link: any;
      payment_link_id: any;
      payment_link_status: any;
      payment_link_expire_by: Date | null;
      payment_link_last_generated_at: Date;
    } | null = null;
    if (input.price > 0) {
      try {
        const rpResponse = await _createRazorpayPaymentLink({
          amountInINR: input.price,
          referenceId: newPackage._id.toString(),
          description: `Purchase ${input.title}`,
          validityInDays: input.validity_in_days,
          defaultMRId: defaultMRId,
          notes: {
            package_id: newPackage._id.toString(),
            package_title: input.title,
            type: "package_purchase",
          },
        });

        paymentLinkData = {
          payment_link: rpResponse.short_url || null,
          payment_link_id: rpResponse.id || null,
          payment_link_status: rpResponse.status || null,
          payment_link_expire_by: rpResponse.expire_by
            ? new Date(rpResponse.expire_by * 1000)
            : null,
          payment_link_last_generated_at: new Date(),
        };

        // Update package with payment link info
        await Package.findByIdAndUpdate(newPackage._id, {
          $set: { meta: { ...input.meta, ...paymentLinkData } },
        });

        // Add log entry for payment link generation
        await Package.findByIdAndUpdate(newPackage._id, {
          $push: {
            logs: {
              title: "Payment Link Generated",
              description: `Razorpay payment link generated for ${input.title}`,
              status: PackageStatus.ACTIVE,
              meta: {
                payment_link_id: rpResponse.id,
                amount: input.price,
              },
            },
          },
        });
      } catch (paymentError: any) {
        console.error("Failed to create Razorpay payment link:", paymentError);
        // Continue without payment link - package is still created
        await Package.findByIdAndUpdate(newPackage._id, {
          $push: {
            logs: {
              title: "Payment Link Generation Failed",
              description: `Failed to generate Razorpay payment link for ${input.title}`,
              status: PackageStatus.ACTIVE,
              meta: {
                error: paymentError.message,
              },
            },
          },
        });
      }
    }

    // Populate features and return complete package
    const populatedPackage = await Package.findById(newPackage._id)
      .populate("features", "title description status meta")
      .populate("createdBy", "name email")
      .lean();

    return {
      success: true,
      data: {
        ...populatedPackage,
        paymentLink: paymentLinkData,
      },
      message: "Package created successfully",
    };
  } catch (error) {
    console.error("Error creating package:", error);
    throw error;
  }
};

export {
  _fetchPricingPlans,
  _createPurchaseRecord,
  _createPaymentLinkForPackage,
  _createPackageManually,
};
