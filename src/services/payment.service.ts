import axios from "axios";
import User from "../models/user.model";
import { Types } from "mongoose";

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID!;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET!;

if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
  throw new Error(
    "Razorpay keys missing. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET env vars."
  );
}

const RAZORPAY_API_BASE = "https://api.razorpay.com/v1";

/**
 * Create a Razorpay Payment Link
 * @param amountInINR number (e.g. 200)
 * @param referenceId string (your package id or code)
 * @param description string
 * @param validityInDays number (optional) -> used to calculate expire_by
 */
export async function _createRazorpayPaymentLink({
  amountInINR,
  referenceId,
  description,
  validityInDays,
  defaultMRId,
  notes,
}: {
  amountInINR: number;
  referenceId: string;
  description?: string;
  validityInDays?: number;
  defaultMRId: Types.ObjectId;
  notes?: any;
}) {
  try {
    const amountPaise = Math.max(0, Math.round(amountInINR * 100));

    const userDetails = await User.findById(defaultMRId);

    const payload: any = {
      amount: amountPaise,
      currency: "INR",
      accept_partial: false,
      description: description || `Purchase: ${referenceId}`,
      reference_id: referenceId,
      upi_link: false,
      notes,
      notify: {
        sms: true,
        email: false,
      },
    };

    if (validityInDays && Number(validityInDays) > 0) {
      // expire_by expects epoch seconds
      const expireBy =
        Math.floor(Date.now() / 1000) + Number(validityInDays) * 24 * 60 * 60;
      payload.expire_by = expireBy;
    }

    const res = await axios.post(
      `${RAZORPAY_API_BASE}/payment_links`,
      payload,
      {
        auth: {
          username: RAZORPAY_KEY_ID,
          password: RAZORPAY_KEY_SECRET,
        },
      }
    );

    return res.data;
  } catch (err: any) {
    console.error(
      "Error creating Razorpay payment link:",
      err?.response?.data || err.message
    );
    throw err;
  }
}

/**
 * Fetch a payment link details by link id
 * @param linkId string (e.g. plink_xxx)
 */
export async function fetchRazorpayPaymentLink(linkId: string) {
  try {
    const res = await axios.get(
      `${RAZORPAY_API_BASE}/payment_links/${linkId}`,
      {
        auth: {
          username: RAZORPAY_KEY_ID,
          password: RAZORPAY_KEY_SECRET,
        },
      }
    );
    return res.data;
  } catch (err: any) {
    // 404 or error
    const errData = err?.response?.data;
    console.error(
      "Error fetching Razorpay payment link:",
      errData || err.message
    );
    throw err;
  }
}
