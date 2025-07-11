import { Schema, model } from "mongoose";

import { CustomerDto } from "../dtos/customer.dto";

const CustomerSchema = new Schema<CustomerDto & Document>(
  {
    name: {
      type: String,
      default: "",
    },
    date_of_birth: {
      type: Date,
      default: null,
    },
    company_name: {
      type: String,
      default: "",
    },
    anniversary_date: {
      type: Date,
      default: null,
    },
    email: {
      type: String,
      default: "",
    },
    phone_number: {
      type: String,
      default: "",
    },
    gst_no: {
      type: String,
      default: "",
    },
    address: { type: String, default: "" },
    assign_tag: { type: String, default: "" },

    created_by: {
      type: Schema.Types.Mixed,
      default: {},
    },
    converted_by: {
      type: Schema.Types.Mixed,
      default: {},
    },
    converted_date: {
      type: Date,
      default: null,
    },
    meta: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true, versionKey: false }
);

const Customer = model<CustomerDto & Document>("Customer", CustomerSchema);

export default Customer;
