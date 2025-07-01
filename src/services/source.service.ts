import { Types } from "mongoose";
import Lead from "../models/lead.model";
import Property from "../models/property.model";
import User from "../models/user.model";
import { LogStatus } from "../dtos/property.dto";

const _createSource = async (
  title: string,
  property_id: Types.ObjectId,
  description: string,
  meta: any,
  propId: Types.ObjectId
) => {
  const existingSuperadmin = await User.findOne({ property_id: propId });
  if (!existingSuperadmin) {
    throw new Error("Superadmin not found");
  }
  

};

export { _createSource };
