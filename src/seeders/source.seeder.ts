import Property from "../models/property.model";
import Source from "../models/source.model";

export async function seedDefaultSources() {
  const existingProperty = await Property.findOne({
    name: "MR Group of Colleges and Hospitals",
  });

  if (!existingProperty) {
    console.error("Property not found.");
    return;
  }
  const sources = [
    "Customer Reminder",
    "Call",
    "Facebook",
    "Google Form",
    "Indiamart",
    "Instagram",
    "Offline",
    "Online",
    "Website",
    "Whatsapp",
  ];

  for (const statusTitle of sources) {
    const exists = await Source.findOne({
      title: statusTitle,
      property_id: existingProperty._id,
    });

    if (!exists) {
      await Source.create({
        title: statusTitle,
        description: `${statusTitle}`,
        property_id: existingProperty._id,
        meta: {
          is_active: true,
          is_editable: false,
        },
      });

      // TODO console logs will have to be incorporated!

      console.log(`✔️ Seeded status`);
    } else {
      console.log(`ℹ️ Source already exists`);
    }
  }

  console.log("✅ Default lead sources seeding complete.");
}
