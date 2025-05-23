import Property from "../models/property.model";
import Status from "../models/status.model";

export async function seedDefaultLeadStatuses() {
  const existingProperty = await Property.findOne({
    name: "MR Group of Colleges and Hospitals",
  });

  if (!existingProperty) {
    console.error("Property not found.");
    return;
  }
  const statuses = [
    "New",
    "Processing",
    "Agent",
    "Confirm",
    "H.S 2025",
    "Switch Off/ Out of Service",
    "RNR",
    "Fees Issue",
    "Distance Issue",
    "Close-By",
    "Campus Visit",
    "Seat booking",
    "Others Course",
    "JOB Enquiry",
    "Male Nursing",
    "Cancel",
  ];

  for (const statusTitle of statuses) {
    const exists = await Status.findOne({
      title: statusTitle,
      property_id: existingProperty._id,
    });

    if (!exists) {
      await Status.create({
        title: statusTitle,
        description: `${statusTitle} status`,
        property_id: existingProperty._id,
      });

      console.log(`✔️ Seeded status: ${statusTitle}`);
    } else {
      console.log(`ℹ️ Status already exists: ${statusTitle}`);
    }
  }

  console.log("✅ Default lead statuses seeding complete.");
}
