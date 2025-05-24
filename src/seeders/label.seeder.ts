import Property from "../models/property.model";

import Label from "../models/label.model";

export async function seedDefaultLabelStatuses() {
  const existingProperty = await Property.findOne({
    name: "MR Group of Colleges and Hospitals",
  });

  if (!existingProperty) {
    console.error("Property not found.");
    return;
  }
  const labels = [
    "Pharmacy Lead Strategy 5",
    "1st July Nursing Leads",
    "2023-24 H.S Data",
    "26th July Nursing Leads",
    "Academic Counsellor Hiring",
    "Associate",
    "B.Pharm for WBJEE Students",
    "B.Pharm Upto 50K for Scholarship",
    "B.Pharm-Collegedunia",
    "B.sc Nursing 1L 25K Discount",
    "B.sc Nursing 2L 25k",
    "Call",
    "Career Guidance",
    "Content Writer",
    "Krishnagar Pharmacy Lead",
    "Medinipur Nursing Lead",
    "Medinipur Pharmacy Lead",
    "Mother Mary Institute of Nursing",
    "Mother Rijiya Institue of Nursing",
    "Mother Teresa Institute of Nursing",
    "Murshidabad Nursing Lead",
    "Murshidabad Pharmacy Lead",
  ];

  for (const statusTitle of labels) {
    const exists = await Label.findOne({
      title: statusTitle,
      property_id: existingProperty._id,
    });

    if (!exists) {
      await Label.create({
        title: statusTitle,
        description: `${statusTitle} status`,
        property_id: existingProperty._id,
        meta: {
          is_active: true,
        },
      });

      console.log(`✔️ Seeded label`);
    } else {
      console.log(`ℹ️ Label already exists: ${statusTitle}`);
    }
  }
}
