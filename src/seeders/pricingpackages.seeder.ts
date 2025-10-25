import Feature from "../models/feature.model";
import Package from "../models/package.model";
import { FeatureStatus, FeatureLogsStatus } from "../dtos/feature.dto";
import { PackageStatus } from "../dtos/package.dto";
import { Types } from "mongoose";
import { _createRazorpayPaymentLink } from "../services/payment.service";
import User from "../models/user.model";

export async function seedFeaturesAndPackages() {
  console.log("🌱 Checking if Packages and Features need seeding...");

  const freePlanExists = await Package.findOne({ title: "Free Plan" });
  const basicPlanExists = await Package.findOne({ title: "Basic Plan" });

  if (freePlanExists && basicPlanExists) {
    console.log("ℹ️ Free & Basic packages already exist. Skipping seeding.");
    return;
  }

  const now = new Date();
  const validityDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const MR_USER_ID = await User.findOne({
    name: "MR Superadmin",
  });

  console.log("mr user id", MR_USER_ID?._id);
  /** ------------------------
   * 1️⃣ CREATE FREE PLAN
   * ------------------------ */
  console.log("🔨 Creating Free Plan package...");
  const freePackage = await Package.create({
    title: "Free Plan",
    description: "Free plan with limited features",
    validity: validityDate,
    validity_in_days: 7,
    price: 0,
    features: [], // temp user if needed
    status: PackageStatus.ACTIVE,
    logs: [
      {
        title: "Package Created",
        description: `Free Plan created at ${now.toISOString()}`,
        status: "ACTIVE",
        meta: { source: "seeder" },
      },
    ],
    meta: {},
  });

  /** Features for Free Plan */
  const freeFeaturesData = [
    { title: "Labels Limit", desc: "Max number of labels", limit: 1 },
    { title: "Statuses Limit", desc: "Max number of statuses", limit: 2 },
    { title: "Leads Limit", desc: "Max number of leads", limit: 5 },
  ];

  const freeFeatureIds: Types.ObjectId[] = [];

  console.log("🔨 Creating Free Plan features...");
  for (const feature of freeFeaturesData) {
    const createdFeature = await Feature.create({
      title: feature.title,
      description: feature.desc,
      status: FeatureStatus.ACTIVE,
      meta: {
        package_id: freePackage._id,
        limit: feature.limit,
      },
      logs: [
        {
          title: "Feature Created",
          description: `${feature.title} for Free Plan at ${now.toISOString()}`,
          status: FeatureLogsStatus.ACTIVE,
          meta: { source: "seeder" },
        },
      ],
    });
    freeFeatureIds.push(createdFeature._id);
  }

  await Package.findByIdAndUpdate(freePackage._id, {
    features: freeFeatureIds,
  });
  console.log("✅ Free Plan seeded successfully.");

  /** ------------------------
   * 2️⃣ CREATE BASIC PLAN
   * ------------------------ */
  console.log("🔨 Creating Basic Plan package...");
  const basicPackage = await Package.create({
    title: "Basic Plan",
    description: "Basic plan with extended features",
    validity: validityDate,
    validity_in_days: 7,
    price: 200,
    features: [],
    status: PackageStatus.ACTIVE,
    logs: [
      {
        title: "Package Created",
        description: `Basic Plan created at ${now.toISOString()}`,
        status: "ACTIVE",
        meta: { source: "seeder" },
      },
    ],
    meta: {
      package_code: "BASIC_01",
    },
  });

  /** Features for Basic Plan */
  const basicFeaturesData = [
    { title: "Labels Limit", desc: "Max number of labels", limit: 5 },
    { title: "Statuses Limit", desc: "Max number of statuses", limit: 6 },
    { title: "Leads Limit", desc: "Max number of leads", limit: 20 },
  ];

  const basicFeatureIds: Types.ObjectId[] = [];

  console.log("🔨 Creating Basic Plan features...");
  for (const feature of basicFeaturesData) {
    const createdFeature = await Feature.create({
      title: feature.title,
      description: feature.desc,
      status: FeatureStatus.ACTIVE,
      meta: {
        package_id: basicPackage._id,
        limit: feature.limit,
      },
      logs: [
        {
          title: "Feature Created",
          description: `${
            feature.title
          } for Basic Plan at ${now.toISOString()}`,
          status: FeatureLogsStatus.ACTIVE,
          meta: { source: "seeder" },
        },
      ],
    });
    basicFeatureIds.push(createdFeature._id);
  }

  await Package.findByIdAndUpdate(basicPackage._id, {
    features: basicFeatureIds,
  });
  try {
    const rpResponse = await _createRazorpayPaymentLink({
      amountInINR: basicPackage.price,
      referenceId: basicPackage._id.toString(),
      description: `Purchase ${basicPackage.title}`,
      validityInDays: basicPackage.validity_in_days,
      defaultMRId: MR_USER_ID?._id!,
    });

    // rpResponse includes id, short_url, status, expire_by, created_at etc.
    const metaUpdate: any = {
      payment_link: rpResponse.short_url || null,
      payment_link_id: rpResponse.id || null,
      payment_link_status: rpResponse.status || null,
      payment_link_expire_by: rpResponse.expire_by
        ? new Date(rpResponse.expire_by * 1000)
        : null,
      payment_link_last_generated_at: new Date(),
      package_code: "BASIC_01",
    };

    // Use Map or object depending on your package.meta type
    await Package.findByIdAndUpdate(basicPackage._id, {
      $set: { meta: metaUpdate },
    });

    console.log("✅ Basic Plan seeded with Razorpay payment link.");
  } catch (err) {
    console.error("❌ Failed to create payment link for Basic Plan:", err);
    // we still seeded the package; operator can regenerate later via cron
  }

  console.log("🔨 Creating Super Plan package...");
  const superPackage = await Package.create({
    title: "Super Plan",
    description: "Super plan with extended features",
    validity: validityDate,
    validity_in_days: 7,
    price: 500,
    features: [],
    status: PackageStatus.ACTIVE,
    logs: [
      {
        title: "Package Created",
        description: `Super Plan created at ${now.toISOString()}`,
        status: "ACTIVE",
        meta: { source: "seeder" },
      },
    ],
    meta: {
      package_code: "SUPER_01",
    },
  });

  /** Features for Basic Plan */
  const superFeaturesData = [
    { title: "Labels Limit", desc: "Max number of labels", limit: 20 },
    { title: "Statuses Limit", desc: "Max number of statuses", limit: 26 },
    { title: "Leads Limit", desc: "Max number of leads", limit: 50 },
  ];

  const superFeatureIds: Types.ObjectId[] = [];

  console.log("🔨 Creating Basic Plan features...");
  for (const feature of superFeaturesData) {
    const createdFeature = await Feature.create({
      title: feature.title,
      description: feature.desc,
      status: FeatureStatus.ACTIVE,
      meta: {
        package_id: superPackage._id,
        limit: feature.limit,
      },
      logs: [
        {
          title: "Feature Created",
          description: `${
            feature.title
          } for Super Plan at ${now.toISOString()}`,
          status: FeatureLogsStatus.ACTIVE,
          meta: { source: "seeder" },
        },
      ],
    });
    superFeatureIds.push(createdFeature._id);
  }

  await Package.findByIdAndUpdate(superPackage._id, {
    features: basicFeatureIds,
  });
  try {
    const rpResponse = await _createRazorpayPaymentLink({
      amountInINR: superPackage.price,
      referenceId: superPackage._id.toString(),
      description: `Purchase ${superPackage.title}`,
      validityInDays: superPackage.validity_in_days,
      defaultMRId: MR_USER_ID?._id!,
    });

    // rpResponse includes id, short_url, status, expire_by, created_at etc.
    const metaUpdate: any = {
      payment_link: rpResponse.short_url || null,
      payment_link_id: rpResponse.id || null,
      payment_link_status: rpResponse.status || null,
      payment_link_expire_by: rpResponse.expire_by
        ? new Date(rpResponse.expire_by * 1000)
        : null,
      payment_link_last_generated_at: new Date(),
      package_code: "SUPER_01",
    };

    // Use Map or object depending on your package.meta type
    await Package.findByIdAndUpdate(superPackage._id, {
      $set: { meta: metaUpdate },
    });

    console.log("✅ Super Plan seeded with Razorpay payment link.");
  } catch (err) {
    console.error("❌ Failed to create payment link for Super Plan:", err);
    // we still seeded the package; operator can regenerate later via cron
  }

  console.log("✅ All packages & features seeded.");
}
