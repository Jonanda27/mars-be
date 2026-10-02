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

exports.sendEmergencyInvoiceEmail = async ({ to, invoice, log, contract, paymentLink }) => {
  try {
    const tp = await initTransporter();
    const dueDateFormatted = invoice.due_date 
      ? new Date(invoice.due_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
      : '-';

    const mailOptions = {
      from: '"UPBU Mozes Kilangin - Dishub Mimika" <noreply@mars.mimikakab.go.id>',
      to: to,
      subject: `[e-SKRD Pendaratan Darurat] ${invoice.invoice_number} - ${log?.registration_number || 'Armada'}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e0e0e0; border-radius: 8px; color: #333; background: #ffffff;">
          <div style="text-align: center; border-bottom: 2px solid #3c8dbc; padding-bottom: 16px; margin-bottom: 20px;">
            <h2 style="color: #1e3a8a; margin: 0; font-size: 20px; text-transform: uppercase;">Dinas Perhubungan Kabupaten Mimika</h2>
            <h3 style="color: #3c8dbc; margin: 4px 0; font-size: 15px;">UPBU MOZES KILANGIN TIMIKA</h3>
            <p style="font-size: 12px; color: #666; margin: 4px 0;">Penerbitan Surat Ketetapan Retribusi Daerah (e-SKRD) Pendaratan Darurat</p>
          </div>

          <p>Kepada Yth. Perwakilan / Manajemen,</p>
          <p style="margin-top: -8px;"><strong>${contract?.tenants?.nama_perusahaan || 'Operator Armada Tamu'}</strong></p>
          <p style="font-size: 13px; line-height: 1.6;">
            Terima kasih atas kerja samanya selama pemanfaatan fasilitas bandara dalam status pendaratan darurat di Bandara Mozes Kilangin Timika. Dokumen Surat Ketetapan Retribusi Daerah (e-SKRD) resmi telah diterbitkan dengan rincian sebagai berikut:
          </p>

          <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px;">
            <tr style="background: #f8fafc;">
              <td style="padding: 10px 12px; border: 1px solid #e2e8f0; font-weight: bold; width: 42%;">Nomor e-SKRD</td>
              <td style="padding: 10px 12px; border: 1px solid #e2e8f0; font-family: monospace; color: #1e3a8a; font-weight: bold;">${invoice.invoice_number}</td>
            </tr>
            <tr>
              <td style="padding: 10px 12px; border: 1px solid #e2e8f0; font-weight: bold;">Nomor PKS Darurat</td>
              <td style="padding: 10px 12px; border: 1px solid #e2e8f0; font-family: monospace;">${contract?.contract_number || '-'}</td>
            </tr>
            <tr style="background: #f8fafc;">
              <td style="padding: 10px 12px; border: 1px solid #e2e8f0; font-weight: bold;">Registrasi Armada</td>
              <td style="padding: 10px 12px; border: 1px solid #e2e8f0; font-weight: bold;">${log?.registration_number || contract?.fasilitas?.registration_number || '-'}</td>
            </tr>
            <tr>
              <td style="padding: 10px 12px; border: 1px solid #e2e8f0; font-weight: bold;">Total Retribusi</td>
              <td style="padding: 10px 12px; border: 1px solid #e2e8f0; font-size: 16px; font-weight: bold; color: #047857;">Rp ${Number(invoice.amount).toLocaleString('id-ID')}</td>
            </tr>
            <tr style="background: #f8fafc;">
              <td style="padding: 10px 12px; border: 1px solid #e2e8f0; font-weight: bold;">Jatuh Tempo</td>
              <td style="padding: 10px 12px; border: 1px solid #e2e8f0; color: #b91c1c; font-weight: bold;">${dueDateFormatted}</td>
            </tr>
          </table>

          <div style="background-color: #f0fdf4; border-left: 4px solid #16a34a; padding: 14px; margin: 18px 0; border-radius: 4px;">
            <p style="margin: 0 0 4px 0; font-size: 13px; font-weight: bold; color: #15803d;">Rekening Resmi Kas Daerah / Dishub Kab. Mimika:</p>
            <p style="margin: 0; font-size: 12px; line-height: 1.6; color: #166534;">
              Bank: <strong>Bank BPD Papua (Bank Papua)</strong><br />
              Nomor Rekening: <strong>100-01-000000-0</strong><br />
              Atas Nama: <strong>Bendahara Penerimaan Dishub Kab. Mimika</strong>
            </p>
          </div>

          <p style="font-size: 13px; line-height: 1.5;">
            Karena Anda tidak memerlukan akun di portal sistem MARS, silakan gunakan tautan khusus dan aman di bawah ini untuk <strong>mengunggah (upload) bukti pembayaran</strong>:
          </p>

          <div style="text-align: center; margin: 24px 0;">
            <a href="${paymentLink}" style="background-color: #00a65a; color: #ffffff; padding: 13px 28px; text-decoration: none; font-weight: bold; font-size: 14px; border-radius: 4px; display: inline-block; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              Unggah Bukti Pembayaran e-SKRD
            </a>
          </div>

          <p style="font-size: 11px; color: #64748b; word-break: break-all;">
            Tautan Akses Langsung:<br />
            <a href="${paymentLink}" style="color: #3c8dbc;">${paymentLink}</a>
          </p>

          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 0;">
            Pemberitahuan Otomatis &bull; Sistem Informasi Pendapatan Daerah (MARS) &bull; UPBU Mozes Kilangin Timika
          </p>
        </div>
      `
    };

    const info = await tp.sendMail(mailOptions);
    console.log('Emergency SKRD Email sent: %s', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending Emergency SKRD Email:', error);
    return { success: false, error: error.message };
  }
};

exports.sendWarningLetterEmail = async ({ to, tenant, warning, invoice }) => {
  try {
    const tp = await initTransporter();
    const dueDateFormatted = invoice?.due_date 
      ? new Date(invoice.due_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
      : '-';

    const isSP1 = (warning.type || '').includes('1');
    const headerBg = isSP1 ? '#fefce8' : '#fff7ed';
    const headerBorder = isSP1 ? '#eab308' : '#ea580c';
    const headerText = isSP1 ? '#854d0e' : '#9a3412';

    const mailOptions = {
      from: '"Dinas Perhubungan Kab. Mimika - UPBU Mozes Kilangin" <noreply@mars.mimikakab.go.id>',
      to: to,
      subject: `[${warning.type}] Peringatan Keterlambatan Pembayaran e-SKRD ${invoice?.invoice_number || ''} - ${tenant.nama_perusahaan}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e0e0e0; border-radius: 8px; color: #333; background: #ffffff;">
          <div style="text-align: center; border-bottom: 2px solid #3c8dbc; padding-bottom: 16px; margin-bottom: 20px;">
            <h2 style="color: #1e3a8a; margin: 0; font-size: 20px; text-transform: uppercase;">Dinas Perhubungan Kabupaten Mimika</h2>
            <h3 style="color: #3c8dbc; margin: 4px 0; font-size: 15px;">UPBU MOZES KILANGIN TIMIKA</h3>
            <p style="font-size: 12px; color: #666; margin: 4px 0;">Pengendalian Piutang &amp; Surat Peringatan Resmi (SP)</p>
          </div>

          <div style="background-color: ${headerBg}; border-left: 4px solid ${headerBorder}; padding: 12px 16px; margin-bottom: 20px;">
            <h4 style="margin: 0 0 4px 0; color: ${headerText}; font-size: 14px; text-transform: uppercase;">
              ${warning.type} - PEMBERITAHUAN TUNGGAKAN RETRIBUSI
            </h4>
            <p style="margin: 0; font-size: 12px; color: #475569;">
              Nomor Surat: <strong>${warning.warning_number}</strong>
            </p>
          </div>

          <p>Kepada Yth. Pimpinan / Manajemen,</p>
          <p style="margin-top: -8px;"><strong>${tenant.nama_perusahaan}</strong></p>
          ${tenant.pic ? `<p style="margin-top: -8px; font-size: 12px; color: #64748b;">u.p. ${tenant.pic}</p>` : ''}

          <p style="font-size: 13px; line-height: 1.6;">
            Bersama surat ini kami sampaikan bahwa tagihan Surat Ketetapan Retribusi Daerah (e-SKRD) atas pemanfaatan fasilitas kebandarudaraan telah melewati batas waktu jatuh tempo dengan rincian sebagai berikut:
          </p>

          <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px;">
            <tr style="background: #f8fafc;">
              <td style="padding: 10px 12px; border: 1px solid #e2e8f0; font-weight: bold; width: 42%;">Nomor SKRD</td>
              <td style="padding: 10px 12px; border: 1px solid #e2e8f0; font-family: monospace; color: #1e3a8a; font-weight: bold;">${invoice?.invoice_number || '-'}</td>
            </tr>
            <tr>
              <td style="padding: 10px 12px; border: 1px solid #e2e8f0; font-weight: bold;">Tunggakan Pokok</td>
              <td style="padding: 10px 12px; border: 1px solid #e2e8f0; font-size: 15px; font-weight: bold; color: #dc2626;">Rp ${Number(invoice?.amount || 0).toLocaleString('id-ID')}</td>
            </tr>
            <tr style="background: #f8fafc;">
              <td style="padding: 10px 12px; border: 1px solid #e2e8f0; font-weight: bold;">Tanggal Jatuh Tempo</td>
              <td style="padding: 10px 12px; border: 1px solid #e2e8f0; font-weight: bold; color: #b91c1c;">${dueDateFormatted}</td>
            </tr>
            <tr>
              <td style="padding: 10px 12px; border: 1px solid #e2e8f0; font-weight: bold;">Sanksi Denda Keterlambatan</td>
              <td style="padding: 10px 12px; border: 1px solid #e2e8f0; color: #475569;">1% per bulan kalender</td>
            </tr>
          </table>

          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 14px; margin: 18px 0; border-radius: 4px; font-size: 12px; line-height: 1.6;">
            <strong>Pesan Dinas:</strong><br />
            ${warning.message || 'Segera lakukan pelunasan tagihan untuk menghindari sanksi administratif lanjutan dan pembatasan operasional fasilitas.'}
          </div>

          <p style="font-size: 13px; line-height: 1.5;">
            Diharapkan pihak maskapai/mitra dapat segera melakukan pelunasan tagihan melalui Portal Tenant MARS atau konfirmasi langsung ke Bendahara Penerimaan Dishub Kab. Mimika.
          </p>

          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 0;">
            Surat Peringatan Resmi &bull; Dinas Perhubungan Kabupaten Mimika &bull; UPBU Mozes Kilangin Timika
          </p>
        </div>
      `
    };

    const info = await tp.sendMail(mailOptions);
    console.log('Warning Letter Email sent: %s', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending Warning Letter Email:', error);
    return { success: false, error: error.message };
  }
};


