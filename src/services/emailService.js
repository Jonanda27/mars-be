const nodemailer = require('nodemailer');

let transporter = null;

async function initTransporter() {
  if (transporter) return transporter;

  // Use SMTP Config from .env
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 465,
    secure: true, 
    auth: {
      user: process.env.SMTP_USER, 
      pass: process.env.SMTP_PASS,
    },
  });

  console.log('SMTP Email Transporter Initialized for:', process.env.SMTP_USER);
  return transporter;
}

exports.sendOtpEmail = async (to, otpCode) => {
  try {
    const tp = await initTransporter();
    
    const mailOptions = {
      from: '"MARS Mozes Kilangin" <noreply@mars.co.id>',
      to: to,
      subject: 'Kode OTP Verifikasi Pendaftaran',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
          <h2 style="color: #3c8dbc; text-align: center;">Verifikasi Pendaftaran Akun</h2>
          <p>Halo,</p>
          <p>Terima kasih telah mendaftar di sistem MARS (Mimika Airport Revenue System) Mozes Kilangin.</p>
          <p>Berikut adalah kode OTP untuk melanjutkan pendaftaran Anda:</p>
          <div style="background-color: #f4f6f9; padding: 15px; border-radius: 5px; text-align: center; margin: 20px 0;">
            <h1 style="letter-spacing: 5px; margin: 0; color: #333;">${otpCode}</h1>
          </div>
          <p>Kode ini hanya berlaku selama 5 menit. Jangan berikan kode ini kepada siapa pun.</p>
          <p style="margin-top: 30px; font-size: 12px; color: #777; text-align: center;">
            &copy; ${new Date().getFullYear()} Mozes Kilangin. All rights reserved.
          </p>
        </div>
      `
    };

    const info = await tp.sendMail(mailOptions);
    console.log('OTP Email sent: %s', info.messageId);
    console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
    
    return {
      success: true,
      previewUrl: nodemailer.getTestMessageUrl(info)
    };
  } catch (error) {
    console.error('Error sending OTP Email:', error);
    throw error;
  }
};
