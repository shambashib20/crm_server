import Property from "../models/property.model";

import Label from "../models/label.model";
import { Types } from "mongoose";

export async function seedDefaultLabelStatuses() {
  const property = await Property.findOne({
    name: "MR Group of Colleges and Hospitals",
  });

  if (!property) {
    console.error("❌ Property not found.");
    return;
  }

  const labels = ["Test Label 1", "Test Label 2"];

  for (const rawTitle of labels) {
    const normalizedTitle = rawTitle.trim().toLowerCase();

    const exists = await Label.findOne({
      title: normalizedTitle,
      property_id: property._id,
    });

    if (!exists) {
      await Label.create({
        title: normalizedTitle,
        description: `${rawTitle.trim()} label`,
        property_id: property._id,
        meta: {
          is_active: true,
          assigned_agents: [],
          color_code: "",
          is_editable: false,
        },
      });

      console.log(`✔️ Seeded label: ${rawTitle}`);
    } else {
      console.log(`ℹ️ Label already exists: ${rawTitle}`);
    }
  }
}
