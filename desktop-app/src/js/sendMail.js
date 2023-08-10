const nodemailer = require("nodemailer");
require("dotenv").config();

const sendMail = async (to, subject, body) => {
  const transporter = nodemailer.createTransport({
    host: process.env.CONTACT_MAIL_HOST,
    port: 587,
    secure: false,
    auth: {
      user: process.env.CONTACT_MAIL_USER,
      pass: process.env.CONTACT_MAIL_PASS
    }
  });

  await transporter.sendMail({
    from: `${process.env.CONTACT_MAIL_NAME} <${process.env.CONTACT_MAIL_USER}>`,
    to,
    subject,
    html: body,
  });
};

module.exports = sendMail;