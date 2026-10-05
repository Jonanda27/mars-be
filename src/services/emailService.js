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

// Unified OTP Email Template Builder (Consistent Layout & Branding)
function buildOtpEmailTemplate({
  badgeText,
  badgeBg = '#e0f2fe',
  badgeColor = '#0369a1',
  recipientName,
  introParagraph,
  otpCode,
  validityMinutes = 5,
  benefitParagraph,
  footerNote
}) {
  return `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verifikasi OTP MARS</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f1f5f9; padding: 32px 12px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 540px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06); border: 1px solid #e2e8f0;">
          
          <!-- Header Branding (Navy to Airport Blue Gradient) -->
          <tr>
            <td style="background: linear-gradient(135deg, #0b2545 0%, #134074 50%, #008db9 100%); padding: 30px 24px; text-align: center;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td align="center">
                    <div style="display: inline-block; background-color: rgba(255, 255, 255, 0.15); border: 1px solid rgba(255, 255, 255, 0.25); border-radius: 8px; padding: 5px 14px; margin-bottom: 10px;">
                      <span style="font-size: 15px; font-weight: 800; color: #ffffff; letter-spacing: 3px;">MARS</span>
                    </div>
                    <h1 style="color: #ffffff; font-size: 15px; font-weight: 700; margin: 0; letter-spacing: 1px; text-transform: uppercase;">
                      Mimika Airport Revenue System
                    </h1>
                    <p style="color: rgba(255, 255, 255, 0.8); font-size: 11px; margin: 6px 0 0 0; letter-spacing: 0.5px;">
                      UPBU Kelas I Mozes Kilangin Timika &bull; Dinas Perhubungan Kabupaten Mimika
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Content Body -->
          <tr>
            <td style="padding: 30px 26px;">
              <!-- Category Badge -->
              <div style="margin-bottom: 20px;">
                <span style="display: inline-block; background-color: ${badgeBg}; color: ${badgeColor}; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; padding: 5px 14px; border-radius: 20px;">
                  ${badgeText}
                </span>
              </div>

              <!-- Greeting -->
              <p style="font-size: 15px; line-height: 1.5; color: #0f172a; margin: 0 0 12px 0;">
                Halo <strong>${recipientName}</strong>,
              </p>

              <!-- Intro Description -->
              <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 24px 0;">
                ${introParagraph}
              </p>

              <!-- OTP Highlight Box -->
              <div style="background: linear-gradient(145deg, #f0f7fb 0%, #e2f1f8 100%); border: 1.5px dashed #008db9; border-radius: 14px; padding: 22px; text-align: center; margin: 0 0 24px 0;">
                <span style="display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #64748b; margin-bottom: 8px;">
                  KODE VERIFIKASI RESMI (OTP)
                </span>
                <div style="font-family: 'Courier New', Courier, monospace, sans-serif; font-size: 36px; font-weight: 800; letter-spacing: 10px; color: #008db9; margin: 6px 0; text-indent: 10px;">
                  ${otpCode}
                </div>
                <div style="font-size: 12px; color: #475569; margin-top: 8px; font-weight: 500;">
                  ⏱️ Berlaku selama <strong>${validityMinutes} menit</strong>
                </div>
              </div>

              <!-- Contextual Benefit / Next Steps -->
              <p style="font-size: 13px; line-height: 1.6; color: #475569; margin: 0 0 20px 0;">
                ${benefitParagraph}
              </p>

              <!-- Security Notice -->
              <div style="background-color: #fffbeb; border-left: 3px solid #f59e0b; border-radius: 6px; padding: 12px 14px; margin-top: 24px;">
                <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #92400e;">
                  🔒 <strong>Peringatan Keamanan:</strong> Jangan berikan kode OTP ini kepada siapa pun. Petugas resmi Dishub Mimika maupun pengelola bandara tidak akan pernah meminta kode verifikasi rahasia Anda.
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #f1f5f9; padding: 22px 24px; text-align: center;">
              <p style="font-size: 11px; color: #64748b; line-height: 1.5; margin: 0 0 6px 0;">
                ${footerNote}
              </p>
              <p style="font-size: 11px; color: #94a3b8; line-height: 1.5; margin: 0;">
                Kantor UPBU Kelas I Mozes Kilangin &bull; Jl. Cenderawasih, Timika, Papua Tengah<br />
                &copy; ${new Date().getFullYear()} Dinas Perhubungan Kabupaten Mimika. Hak Cipta Dilindungi.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

exports.sendOtpEmail = async (to, otpCode, name = 'Mitra Baru') => {
  try {
    const tp = await initTransporter();
    const fromEmail = process.env.SMTP_USER || 'noreply@mars.co.id';
    
    const mailOptions = {
      from: `"MARS Mozes Kilangin" <${fromEmail}>`,
      to: to,
      subject: `[MARS] Kode OTP Verifikasi Pendaftaran Akun Mitra: ${otpCode}`,
      html: buildOtpEmailTemplate({
        badgeText: 'Pendaftaran Akun Mitra',
        badgeBg: '#e0f2fe',
        badgeColor: '#0369a1',
        recipientName: name,
        introParagraph: 'Terima kasih telah melakukan pendaftaran akun kemitraan di sistem <strong>MARS (Mimika Airport Revenue System)</strong> UPBU Mozes Kilangin Timika. Untuk memverifikasi keabsahan alamat email dan melanjutkan proses pendaftaran akun Anda, silakan masukkan kode OTP di bawah ini:',
        otpCode: otpCode,
        validityMinutes: 5,
        benefitParagraph: 'Setelah verifikasi berhasil, akun Anda akan terdaftar untuk pengajuan layanan sewa fasilitas, pelaporan operasional armada/kargo, serta monitoring penerbitan e-SKRD resmi secara mandiri.',
        footerNote: 'Email ini dikirimkan secara otomatis untuk proses verifikasi pendaftaran akun di portal MARS.'
      })
    };

    const info = await tp.sendMail(mailOptions);
    console.log('[MARS-EMAIL] Registration OTP Email sent to %s (MessageID: %s)', to, info.messageId);
    return { success: true };
  } catch (error) {
    console.error('Error sending Registration OTP Email:', error);
    throw error;
  }
};

exports.sendChatOtpEmail = async (to, name, otpCode) => {
  try {
    const tp = await initTransporter();
    const fromEmail = process.env.SMTP_USER || 'noreply@mars.co.id';
    
    const mailOptions = {
      from: `"MARS Helpdesk Mozes Kilangin" <${fromEmail}>`,
      to: to,
      subject: `[MARS Helpdesk] Kode OTP Verifikasi Live Chat: ${otpCode}`,
      html: buildOtpEmailTemplate({
        badgeText: 'Verifikasi Sesi Live Chat',
        badgeBg: '#e0f2fe',
        badgeColor: '#0369a1',
        recipientName: name || 'Bapak/Ibu',
        introParagraph: 'Anda sedang memulai sesi konsultasi dan tanya jawab langsung dengan <strong>M Naufal (Asisten Cerdas MARS)</strong> pada layanan helpdesk resmi Bandara Mozes Kilangin Timika. Silakan gunakan kode OTP di bawah ini untuk memverifikasi sesi percakapan Anda:',
        otpCode: otpCode,
        validityMinutes: 5,
        benefitParagraph: 'Setelah verifikasi selesai, Anda dapat langsung menanyakan informasi terkait tarif retribusi bandara, e-SKRD, fasilitas terminal/apron, serta panduan pembayaran resmi Kas Daerah Bank Papua.',
        footerNote: 'Email ini dikirimkan otomatis oleh Layanan Bantuan & Customer Service AI MARS Bandara Mozes Kilangin.'
      })
    };

    const info = await tp.sendMail(mailOptions);
    console.log('[MARS-EMAIL] Chat OTP Email sent to %s (MessageID: %s)', to, info.messageId);
    return { success: true };
  } catch (error) {
    console.error('Error sending Chat OTP Email:', error);
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


