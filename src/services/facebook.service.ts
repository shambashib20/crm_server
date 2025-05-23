import axios from "axios";

const _getUserPages = async (accessToken: string) => {
  try {
    const response = await axios.get(
      "https://graph.facebook.com/v21.0/me/accounts",
      {
        params: {
          access_token: accessToken,
        },
      }
    );
    return response.data.data;
  } catch (err) {
    throw new Error("Failed to fetch pages");
  }
};

const _getLeadsFromForm = async (formId: string, accessToken: string) => {
  try {
    const response = await axios.get(
      `https://graph.facebook.com/v21.0/${formId}/leads`,
      {
        params: {
          access_token: accessToken,
        },
      }
    );
    return response.data.data;
  } catch (err: any) {
    console.error(err.message);
    throw new Error("Failed to fetch leads");
  }
};
export { _getUserPages, _getLeadsFromForm };
