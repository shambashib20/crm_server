import { Schema, model, Document } from "mongoose";

import { ClientDto } from "../dtos/client.dto";

const clientSchema = new Schema<ClientDto & Document>(
  {
    name: {
      type: String,
      default: "",
    },
    mobile_number: {
      type: String,
      default: "",
    },
    email: {
      type: String,
      default: "",
    },
    message: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["new", "contacted", "in_progress", "converted", "closed"],
      default: "new",
    },
    meta: {
      type: Map,
      of: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

const Client = model<ClientDto & Document>("Client", clientSchema);
export default Client;
