import { LogStatus, PropertyStatus } from "../dtos/property.dto";
import Property from "../models/property.model";
import Role from "../models/role.model";
import bcrypt from "bcrypt";

export async function seedDefaultProperty() {
  const existing = await Property.findOne({
    name: "MR Group of Colleges and Hospitals",
  });

  if (existing) {
    console.log("ℹ️ Property already exists.");
    return;
  }

  const superadminRole = await Role.findOne({ name: "Superadmin" });

  if (!superadminRole) {
    throw new Error(
      "❌ Superadmin role not found. Please run roles-permissions seeder first."
    );
  }

  const now = new Date();

  const logMessage = `Workspace with name "MR Group of Colleges and Hospitals" generated successfully at ${new Intl.DateTimeFormat(
    "en-IN",
    {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: "Asia/Kolkata",
    }
  ).format(now)}`;

  await Property.create({
    name: "MR Group of Colleges and Hospitals",
    description: `Welcome to M.R Group of Colleges: Empowering Education for a Bright Future.

Established in 2012, M.R Group of Colleges is a renowned educational institution operating under the umbrella of the M.R Charitable Trust. We take pride in our collaboration with our own thirteen colleges that offer a diverse range of courses to cater to the ever-evolving educational needs of students. Our colleges are dedicated to providing quality education and shaping the leaders of tomorrow.

At M.R Group of Colleges, we prioritize academic excellence, practical exposure, and holistic development. Our dedicated faculty members are highly experienced professionals who are committed to nurturing students' talents and guiding them on their educational journey.`,

    is_verified: true,
    reported: false,
    is_banned: false,
    status: PropertyStatus.ACTIVE,
    role: superadminRole._id,
    usage_count: 0,
    logs: [
      {
        title: "Property Created",
        description: logMessage,
        status: LogStatus.SYSTEM,
        meta: {
          source: "seeder",
          createdBy: "system",
        },
      },
    ],
  });

  console.log(
    "✅ MR Group of Colleges and Hospitals property seeded successfully."
  );
}
