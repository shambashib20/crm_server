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
      const existing = await WhatsAppDevice.findOne({ d_id: device.d_id });

      if (!existing) {
        console.log("📥 New device found, saving:", device.device_name);
        await WhatsAppDevice.create(device);
        continue;
      }

      let updated = false;
      const fieldsToSync = [
        "status",
        "device_status",
        "connectionId",
        "old_connection_id",
        "u_device_token",
        "host_device",
        "mobile_no",
        "device_name",
        "updated_at",
      ];
      const changes = {};
      for (const field of fieldsToSync) {
        if (existing[field] !== device[field]) {
          changes[field] = { old: existing[field], new: device[field] };
          existing[field] = device[field];
          updated = true;
        }
      }

      if (updated) {
        console.log("🔄 Changes:", changes);
        await existing.save();
      }
    }

    console.log("✅ WapMonkey sync complete");
  } catch (err: any) {
    console.error("❌ Error syncing WapMonkey devices:", err.message);
    throw err;
  }
};

export { _fetchAndSyncWapMonkeyDevices };
