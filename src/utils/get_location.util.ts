import axios from "axios";

export const getLocationFromIP = async (ip: string) => {
  try {
    const response = await axios.get(`http://ip-api.com/json/${ip}`);

    if (response.data.status !== "fail") {
      const { lat, lon } = response.data;
      const refinedLocation = await axios.get(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`
      );

      const address = refinedLocation.data.address || {};

      return {
        country: address.country || response.data.country,
        country_code:
          address.country_code?.toUpperCase() || response.data.countryCode,
        region: address.state || response.data.regionName,
        city:
          address.city || address.town || address.village || response.data.city,
        postcode: address.postcode || null,
        lat,
        lon,
        timezone: response.data.timezone,
        display_name: refinedLocation.data.display_name || "",
        detailed_lead_address: {
          address,
          display_name: refinedLocation.data.display_name || "",
        },
      };
    } else {
      return {
        country: "Unknown",
        region: "Unknown",
        city: "Unknown",
        lat: null,
        lon: null,
        timezone: "UTC",
        display_name: "Unknown",
        detailed_lead_address: "Unknown",
      };
    }
  } catch (error) {
    console.error("Error fetching location data:", error);
    return {
      country: "Unknown",
      region: "Unknown",
      city: "Unknown",
      lat: null,
      lon: null,
      timezone: "UTC",
      display_name: "Unknown",
      detailed_lead_address: "Unknown",
    };
  }
};
