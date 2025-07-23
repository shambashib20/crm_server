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

  // Check if lead already converted (based on meta.status)
  const existingLead = await Lead.findById({ _id: leadId })
    .populate({ path: "assigned_to", select: "name" })
    .lean()
    .exec();

  if (!existingLead) {
    throw new Error("Lead does not exist!");
  }

  if (existingLead.meta?.status === "CONVERTED TO CUSTOMER") {
    throw new Error("This lead has already been converted into a customer!");
  }

  const existingProperty = await Property.findById({ _id: propId });
  if (!existingProperty) {
    throw new Error("Property does not exist!");
  }

  // Create the customer
  const newCustomer = await Customer.create({
    name: existingLead.name,
    company_name: existingLead.company_name || "",
    email: existingLead.email || "",
    phone_number: existingLead.phone_number,
    address: existingLead.address,
    created_by: existingLead.assigned_to,
    converted_date: now,
    meta: {
      ...existingLead.meta,
      lead_id: leadId,
      active: true,
      property_id: existingProperty._id,
    },
  });

  // Update lead meta status + logs
  await Lead.findByIdAndUpdate(leadId, {
    $set: {
      "meta.status": "CONVERTED TO CUSTOMER",
    },
    $push: {
      logs: {
        title: "Lead converted to Customer!",
        description: `Lead named ${
          existingLead.name || "Unknown"
        } was converted to Customer successfully by ${
          (existingLead.assigned_to as { name?: string })?.name || ""
        }`,
        status: LeadLogStatus.ACTION,
        meta: {},
        createdAt: now,
        updatedAt: now,
      },
    },
  });

  // Update property logs + usage count
  await Property.findByIdAndUpdate(propId, {
    $inc: {
      usage_count: 1,
    },
    $push: {
      logs: {
        title: "Lead converted to Customer!",
        description: `Lead named ${
          existingLead.name || "Unknown"
        } was converted to Customer successfully by ${
          (existingLead.assigned_to as { name?: string })?.name || ""
        } in this property!`,
        status: LogStatus.INFO,
        meta: { leadId: existingLead._id },
        createdAt: now,
        updatedAt: now,
      },
    },
  });

  return newCustomer;
};

const _fetchCustomersInProperty = async (
  propId: Types.ObjectId,
  page: number = 1,
  limit: number = 10
) => {
  const skip = (page - 1) * limit;

  const customers = await Customer.find({ "meta.property_id": propId })
    .skip(skip)
    .limit(limit)
    .sort({ createdAt: -1 })
    .lean()
    .exec();

  const total = await Customer.countDocuments({ "meta.property_id": propId });

  return {
    customers,
    total,
    page,
    limit,
  };
};

export { _createCustomerFromLead, _fetchCustomersInProperty };
