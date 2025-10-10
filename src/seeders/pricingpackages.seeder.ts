import Feature from "../models/feature.model";
import Package from "../models/package.model";
import { FeatureStatus, FeatureLogsStatus } from "../dtos/feature.dto";
import { PackageStatus } from "../dtos/package.dto";
import { Types } from "mongoose";

export async function seedFeaturesAndPackages() {
  console.log("🌱 Checking if Packages and Features need seeding...");

  const freePlanExists = await Package.findOne({ title: "Free Plan" });
  const basicPlanExists = await Package.findOne({ title: "Basic Plan" });

  if (freePlanExists && basicPlanExists) {
    console.log("ℹ️ Free & Basic packages already exist. Skipping seeding.");
    return;
  }

  const now = new Date();
  const validityDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // +7 days

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
    meta: {},
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
  console.log("✅ Basic Plan seeded successfully.");

  console.log("✅ All packages & features seeded.");
}
