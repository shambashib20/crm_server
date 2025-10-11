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
  const statuses = ["New", "Processing", "Confirm", "Cancel"];

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
        meta: {
          is_active: true,
        },
      });

      // TODO console logs will have to be incorporated!

      console.log(`✔️ Seeded status`);
    } else {
      console.log(`ℹ️ Status already exists`);
    }
  }

  console.log("✅ Default lead statuses seeding complete.");
}
