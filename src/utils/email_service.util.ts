import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

/**
 * Sends an email using Nodemailer
 * @param to Recipient email address
 * @param subject Subject of the email
 * @param text Plain text body of the email
 * @param html HTML body of the email
 * @returns Email sending status or error
 */
const sendEmail = async (
  to: string,
  subject: string,
  text: string,
  html: string
): Promise<string> => {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT;
  const emailUser = process.env.EMAIL_USERNAME;
  const emailPass = process.env.EMAIL_PASSWORD;

  if (!smtpHost || !smtpPort || !emailUser || !emailPass) {
    throw new Error(
      "SMTP configuration is missing. Please check your environment variables."
    );
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: parseInt(smtpPort, 10),
    auth: {
      user: emailUser,
      pass: emailPass,
    },
  });

  const mailOptions = {
    from: emailUser, // sender address
    to,
    subject,
    text,
    html,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent: " + info.response);
    return `Email sent successfully to ${to}`;
  } catch (error) {
    console.error("Error sending email:", error);
    throw new Error("Failed to send email.");
  }
};

export { sendEmail };
