import axios from "axios";

export const getRoughLocationFromIP = async (ip: string) => {
  try {
    // If localhost / internal IP → fallback to "unknown"
    if (
      !ip ||
      ip === "127.0.0.1" ||
      ip === "::1" ||
      ip.startsWith("192.168.") ||
      ip.startsWith("10.") ||
      ip.startsWith("172.16.")
    ) {
      return {
        country: "unknown",
        region: "unknown",
        city: "unknown",
        ip,
      };
    }

    const response = await axios.get(`https://ipapi.co/${ip}/json/`);

    const { country_name, region, city } = response.data || {};

    return {
      country: country_name || "unknown",
      region: region || "unknown",
      city: city || "unknown",
      ip,
    };
  } catch (error) {
    console.error("Error fetching location:", error);
    return {
      country: "unknown",
      region: "unknown",
      city: "unknown",
      ip,
    };
  }
};
