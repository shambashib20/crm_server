import { readFileSync } from "fs";
import path from "path";
import { sendEmail } from "../utils/email_service.util";
import Lead from "../models/lead.model";

/**
 * Loads the HTML email template from the templates folder
 */
const loadTemplate = (): string => {
  const filePath = path.join(__dirname, "../templates/campaign_template.html");
  return readFileSync(filePath, "utf-8");
};

const populateTemplate = (
  template: string,
  variables: Record<string, string>
) => {
  let populated = template;
  Object.keys(variables).forEach((key) => {
    populated = populated.replace(
      new RegExp(`{{${key}}}`, "g"),
      variables[key]
    );
  });
  return populated;
};

export const sendMarketingEmails = async () => {
  const template = loadTemplate();

  // Fetch all leads with non-empty email
  const leads = await Lead.find({ email: { $ne: "" } }).lean();

  for (const lead of leads) {
    const personalizedHtml = populateTemplate(template, {
      name: lead.name || "there",
    });

    try {
      await sendEmail(
        lead.email,
        "🚀 Unlock Your Special Offer Today!",
        `Hi ${lead.name || "there"}, we've got something exciting for you.`,
        personalizedHtml
      );

      console.log(`✅ Email sent to: ${lead.email}`);
    } catch (err) {
      console.error(`❌ Failed to send to ${lead.email}:`, err);
    }
  }
};
