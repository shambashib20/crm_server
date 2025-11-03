import { AddOnDto } from "../dtos/addons.dto";
import AddOns from "../models/addonsmodel";

const _createAddOnService = async (data: AddOnDto) => {
  const newAddOn = new AddOns({
    ...data,
  });
  await newAddOn.save();
  return newAddOn;
};

export { _createAddOnService };
