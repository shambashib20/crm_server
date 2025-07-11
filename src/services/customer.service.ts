import Lead from "../models/lead.model";
import Customer from "../models/customer.model";
import { Types } from "mongoose";
import Property from "../models/property.model";
import { LeadLogStatus } from "../dtos/lead.dto";
import { LogStatus } from "../dtos/property.dto";

const _createCustomerFromLead = async (
  leadId: Types.ObjectId,
  propId: Types.ObjectId
) => {
  const now = new Date();

  const existingCustomer = await Customer.find({ "meta.lead_id": leadId });
  if (existingCustomer) {
    throw new Error("This lead has already been converted into a customer!");
  }
  const existingLead = await Lead.findById({ _id: leadId })
    .populate({ path: "assigned_to", select: "name" })
    .lean()
    .exec();
  if (!existingLead) {
    throw new Error("Lead does not exist!");
  }
  const existingProperty = await Property.findById({ _id: propId });
  if (!existingProperty) {
    throw new Error("Property does not exist!");
  }

  const newCustomer = await Customer.create({
    name: existingLead?.name,
    company_name: existingLead.company_name || "",
    email: existingLead.email || "",
    phone_number: existingLead.phone_number,
    address: existingLead.address,
    created_by: existingLead.assigned_to,
    meta: {
      ...existingLead?.meta,
      lead_id: leadId,
    },
  });

  await Lead.findByIdAndUpdate(leadId, {
    $push: {
      logs: {
        title: "Lead converted to Customer!",
        description: `Lead named ${
          existingLead?.name || "Unknown"
        } was converted to Customer successfully by ${
          (existingLead?.assigned_to as { name?: string })?.name || ""
        }`,
        status: LeadLogStatus.ACTION,
        meta: {},
        createdAt: now,
        updatedAt: now,
      },
    },
  });

  await Property.findByIdAndUpdate(propId, {
    $inc: {
      usage_count: 1,
    },
    $push: {
      logs: {
        title: "Lead converted to Customer!",
        description: `Lead named ${
          existingLead?.name || "Unknown"
        } was converted to Customer successfully by ${
          (existingLead?.assigned_to as { name?: string })?.name || ""
        }in this property!`,
        status: LogStatus.INFO,
        meta: { leadId: existingLead._id },
        createdAt: now,
        updatedAt: now,
      },
    },
  });

  return newCustomer;
};

export { _createCustomerFromLead };
