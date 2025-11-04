import axios from "axios";

import { WhatsAppDevice } from "../models/wapmonkeyusers.model";

const WAPMONKEY_URL = "https://api.wapmonkey.com/v1/getuserdeviceapi";
const WM_AUTH = process.env.WAPMONKEY_AUTH_TOKEN!;

const _fetchAndSyncWapMonkeyDevices = async () => {
  try {
    const res = await axios.post(
      WAPMONKEY_URL,
      {},
      {
        headers: {
          Authorization: WM_AUTH,
        },
      }
    );

    if (res.data.status !== 1 || !Array.isArray(res.data.data)) {
      console.log("⚠️ WapMonkey returned no devices");
      return;
    }

    const devices = res.data.data;

    for (const device of devices) {
      const exists = await WhatsAppDevice.findOne({ d_id: device.d_id });

      if (!exists) {
        console.log("📥 New device found, saving:", device.device_name);
        await WhatsAppDevice.create(device);
      }
    }

    console.log("✅ WapMonkey sync complete");
  } catch (err: any) {
    console.error("❌ Error syncing WapMonkey devices:", err.message);
    throw err;
  }
};

export { _fetchAndSyncWapMonkeyDevices };
