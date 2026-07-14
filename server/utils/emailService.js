const nodemailer = require('nodemailer');

/**
 * Send an email using nodemailer transport
 * @param {Object} options
 * @param {string} options.email - Recipient email address
 * @param {string} options.subject - Email subject line
 * @param {string} options.html - HTML body of the email
 */
const sendEmail = async (options) => {
    // Create Microsoft 365 / standard SMTP transporter
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.office365.com',
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: false, // TLS
        auth: {
            user: process.env.SMTP_EMAIL,
            pass: process.env.SMTP_PASSWORD,
        },
        tls: {
            ciphers: 'SSLv3',
            rejectUnauthorized: false, // Bypass self-signed cert validation issues if any
        },
    });

    const mailOptions = {
        from: `"${process.env.FROM_NAME || 'Peninsula Laundries'}" <${process.env.FROM_EMAIL || process.env.SMTP_EMAIL}>`,
        to: options.email,
        subject: options.subject,
        html: options.html,
    };

    console.log(`✉️ Attempting to send email to ${options.email} with subject: "${options.subject}"`);
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent successfully. Message ID: ${info.messageId}`);
    return info;
};

module.exports = sendEmail;
