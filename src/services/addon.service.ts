import { Types } from "mongoose";
import { AddOnDto } from "../dtos/addons.dto";
import AddOns from "../models/addonsmodel";
import { _createRazorpayPaymentLink } from "./payment.service";
import { v4 as uuidv4 } from "uuid";
import Property from "../models/property.model";

const _createAddOnService = async (data: AddOnDto, propId: Types.ObjectId) => {
  const existingAddOn = await AddOns.findOne({ title: data.title });
  if (existingAddOn) {
    throw new Error("Add-On with this title already exists.");
  }

  // ✅ Create Add-On entry
  const newAddOn = await AddOns.create({
    ...data,
    property_id: propId,
    meta: { payment_links: [] },
  });
  await newAddOn.save();

  // ✅ Fetch the property to get the active_package (purchase record)
  const property = await Property.findById(propId);
  const activePackageId =
    property?.meta?.active_package?._id ||
    property?.meta?.active_package ||
    null;

  // ✅ Create Razorpay payment link with reference to purchase record
  const payment = await _createRazorpayPaymentLink({
    amountInINR: data.value,
    referenceId: `addon_${newAddOn._id.toString()}`,
    description: `Add-on: ${data.title}`,
    defaultMRId: propId,
    notes: {
      addon_id: newAddOn._id.toString(),
      property_id: propId.toString(),
      title: data.title,
      purchase_record_id: activePackageId ? activePackageId.toString() : null, // 💡 include active purchase
    },
  });

  const paymentLinkData = {
    link_id: payment.id,
    short_url: payment.short_url,
    amount: payment.amount,
    created_at: new Date(),
    status: payment.status || "created",
    is_active: true,
  };

  const updatedAddOn = await AddOns.findByIdAndUpdate(
    newAddOn._id,
    {
      $push: { "meta.payment_links": paymentLinkData },
    },
    { new: true }
  );

  return updatedAddOn;
};


const _editAddOnService = async (
  addOnId: Types.ObjectId,
  data: Partial<AddOnDto>,
  propId: Types.ObjectId
) => {
  const existingAddOn: any = await AddOns.findOne({
    _id: addOnId,
  });

  if (!existingAddOn) {
    throw new Error("Add-On not found or unauthorized access.");
  }

  let paymentLinkData: any = null;

  const valueChanged =
    typeof data.value === "number" &&
    Number(data.value) !== Number(existingAddOn.value);

  if (valueChanged) {
    await AddOns.findByIdAndUpdate(
      addOnId,
      {
        $set: { "meta.payment_links.$[elem].is_active": false },
      },
      {
        arrayFilters: [{ "elem.is_active": true }],
        new: true,
      }
    );

    const newAmount = Number(data.value);
    const shortId = uuidv4().replace(/-/g, "").slice(0, 24);
    const payment = await _createRazorpayPaymentLink({
      amountInINR: newAmount,
      referenceId: `addon_${shortId}`,
      description: `Add-on updated: ${existingAddOn.title}`,
      defaultMRId: propId,
      notes: {
        addon_id: addOnId.toString(),
        property_id: propId.toString(),
        title: existingAddOn.title,
        reason: "Updated add-on amount",
      },
    });

    paymentLinkData = {
      link_id: payment.id,
      short_url: payment.short_url,
      amount: payment.amount,
      created_at: new Date(),
      status: payment.status || "created",
      is_active: true,
    };
  }

  const updatePayload: any = { ...data };

  if (valueChanged && paymentLinkData) {
    updatePayload.$push = {
      "meta.payment_links": paymentLinkData,
    };
  }

  const updatedAddOn = await AddOns.findByIdAndUpdate(addOnId, updatePayload, {
    new: true,
  });

  return updatedAddOn;
};

const _fetchPaginatedAddOns = async (page: number = 1, limit: number = 10) => {
  const skip = (page - 1) * limit;

  const [addons, total] = await Promise.all([
    AddOns.find().sort({ createdAt: -1 }).skip(skip).limit(limit),
    AddOns.countDocuments(),
  ]);

  const totalPages = Math.ceil(total / limit);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  return {
    addons,
    pagination: {
      totalItems: total,
      totalPages,
      currentPage: page,
      limit,
      hasNextPage,
      hasPrevPage,
    },
  };
};

export { _createAddOnService, _fetchPaginatedAddOns, _editAddOnService };
