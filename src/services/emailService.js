const nodemailer = require('nodemailer');
const dayjs = require('dayjs');

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
  validityMinutes = 3,
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

exports.sendWarningLetterEmail = async ({ to, tenant, warning, invoice, pdfAttachment }) => {
  try {
    const tp = await initTransporter();
    const dueDateFormatted = invoice?.due_date 
      ? new Date(invoice.due_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
      : '-';

    const isPemberitahuan = (warning.type || '').includes('Pemberitahuan');
    const isTeguran = (warning.type || '').includes('Teguran');
    const isSTRD = (warning.type || '').includes('STRD');

    let perihal = 'Pemberitahuan Jatuh Tempo Pembayaran Retribusi Daerah (H-7)';
    if (isTeguran) {
      perihal = 'Surat Teguran Pembayaran Retribusi Daerah Terutang (H+7)';
    } else if (isSTRD) {
      perihal = 'Penyampaian Surat Tagihan Retribusi Daerah (STRD)';
    }

    const mailOptions = {
      from: '"Dinas Perhubungan Kabupaten Mimika" <noreply@mars.mimikakab.go.id>',
      to: to,
      subject: `${perihal} - SKRD ${invoice?.invoice_number || ''} - ${tenant.nama_perusahaan}`,
      attachments: pdfAttachment ? [pdfAttachment] : [],
      html: `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>${perihal}</title>
</head>
<body style="margin: 0; padding: 24px; background-color: #ffffff; font-family: 'Times New Roman', Times, serif; color: #000000; line-height: 1.6; font-size: 14px;">
  <div style="max-width: 660px; margin: 0 auto;">
    
    <!-- Kop Surat Resmi Pemerintahan -->
    <div style="text-align: center; border-bottom: 2px solid #000000; padding-bottom: 12px; margin-bottom: 18px;">
      <div style="font-size: 15px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase;">PEMERINTAH KABUPATEN MIMIKA</div>
      <div style="font-size: 17px; font-weight: bold; text-transform: uppercase; margin: 2px 0;">DINAS PERHUBUNGAN</div>
      <div style="font-size: 13px; font-weight: bold; text-transform: uppercase;">UPBU KELAS I MOZES KILANGIN TIMIKA</div>
      <div style="font-size: 11px; margin-top: 4px; font-family: Arial, sans-serif;">
        Jl. Bandara Mozes Kilangin, Timika, Kabupaten Mimika, Provinsi Papua Tengah
      </div>
    </div>

    <!-- Rujukan Nomor Surat -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="2" border="0" style="margin-bottom: 18px; font-size: 13.5px;">
      <tr>
        <td width="85" valign="top">Nomor</td>
        <td width="15" valign="top">:</td>
        <td valign="top" style="font-weight: bold;">${warning.warning_number}</td>
        <td align="right" valign="top">Timika, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</td>
      </tr>
      <tr>
        <td valign="top">Sifat</td>
        <td valign="top">:</td>
        <td valign="top" colspan="2">Penting / Segera</td>
      </tr>
      <tr>
        <td valign="top">Lampiran</td>
        <td valign="top">:</td>
        <td valign="top" colspan="2">1 (satu) Berkas PDF Naskah Dinas Resmi</td>
      </tr>
      <tr>
        <td valign="top">Hal</td>
        <td valign="top">:</td>
        <td valign="top" colspan="2" style="font-weight: bold;">${perihal}</td>
      </tr>
    </table>

    <!-- Tujuan Surat -->
    <div style="margin-bottom: 18px; font-size: 13.5px;">
      Kepada Yth.<br />
      <strong>Pimpinan ${tenant.nama_perusahaan}</strong><br />
      ${tenant.pic ? `u.p. ${tenant.pic}<br />` : ''}
      di Tempat
    </div>

    <!-- Isi Surat -->
    <div style="text-align: justify; font-size: 13.5px; line-height: 1.7;">
      <p style="margin: 0 0 12px 0;">
        Dengan hormat,
      </p>
      <p style="margin: 0 0 14px 0;">
        Sehubungan dengan kewajiban pembayaran Retribusi Daerah atas pemanfaatan fasilitas di lingkungan UPBU Kelas I Mozes Kilangin Timika berdasarkan Peraturan Daerah Kabupaten Mimika Nomor 4 Tahun 2023 dan Peraturan Bupati Mimika Nomor 25 Tahun 2024 tentang Tata Cara Pemungutan Retribusi Daerah, bersama ini kami sampaikan rincian ketetapan retribusi daerah sebagai berikut:
      </p>

      <table width="100%" cellspacing="0" cellpadding="6" border="1" style="border-collapse: collapse; border: 1px solid #000000; margin: 16px 0; font-size: 13px;">
        <tr style="background-color: #f7f7f7;">
          <td width="35%" style="font-weight: bold; border: 1px solid #000000;">Nomor SKRD</td>
          <td style="font-family: 'Courier New', monospace; font-weight: bold; border: 1px solid #000000;">${invoice?.invoice_number || '-'}</td>
        </tr>
        <tr>
          <td style="font-weight: bold; border: 1px solid #000000;">Pokok Retribusi Terutang</td>
          <td style="font-weight: bold; border: 1px solid #000000;">Rp ${Number(invoice?.amount || 0).toLocaleString('id-ID')}</td>
        </tr>
        <tr style="background-color: #f7f7f7;">
          <td style="font-weight: bold; border: 1px solid #000000;">Tanggal Jatuh Tempo SKRD</td>
          <td style="font-weight: bold; border: 1px solid #000000;">${dueDateFormatted}</td>
        </tr>
        <tr>
          <td style="font-weight: bold; border: 1px solid #000000;">Rekening Penyetoran Kasda</td>
          <td style="border: 1px solid #000000;">Bank Papua Cabang Timika &bull; No. Rek: 100-01-02-00045-8 (Kas Umum Daerah Kab. Mimika)</td>
        </tr>
      </table>

      <p style="margin: 0 0 14px 0;">
        Naskah dinas resmi bertandatangan Kepala Dinas Perhubungan Kabupaten Mimika telah dilampirkan dalam format PDF pada surat elektronik ini. Diharapkan agar Saudara dapat segera melakukan penyetoran retribusi daerah secara penuh ke Rekening Kas Umum Daerah sebelum batas waktu jatuh tempo berakhir.
      </p>

      <p style="margin: 0 0 24px 0;">
        Demikian penyampaian ini kami sampaikan untuk menjadi perhatian dan dilaksanakan sebagaimana mestinya. Atas kerja sama dan kepatuhan Saudara, kami ucapkan terima kasih.
      </p>
    </div>

    <!-- Footer Catatan -->
    <div style="border-top: 1px solid #cccccc; margin-top: 24px; padding-top: 10px; font-size: 11px; color: #555555; font-family: Arial, sans-serif;">
      Surat elektronik ini dikirimkan otomatis melalui Sistem Informasi Manajemen Aset &amp; Retribusi Daerah (MARS) &bull; UPBU Kelas I Mozes Kilangin Timika, Dinas Perhubungan Kabupaten Mimika. Berkas naskah dinas resmi terlampir pada email ini.
    </div>

  </div>
</body>
</html>
      `
    };

    const info = await tp.sendMail(mailOptions);
    console.log('Official Warning Letter Email sent: %s', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending Warning Letter Email:', error);
    return { success: false, error: error.message };
  }
};

exports.sendHangarEntryPermitEmail = async ({ to, schedule, tenant, officer, pdfAttachment }) => {
  try {
    const tp = await initTransporter();
    const fromEmail = process.env.SMTP_USER || 'akunai2705@gmail.com';

    const arrivalFormatted = schedule.estimated_arrival
      ? dayjs(schedule.estimated_arrival).format('DD MMMM YYYY, HH:mm') + ' WIT'
      : '-';
    const departureFormatted = schedule.estimated_departure
      ? dayjs(schedule.estimated_departure).format('DD MMMM YYYY, HH:mm') + ' WIT'
      : '-';
    const verifiedAtFormatted = schedule.verified_at
      ? dayjs(schedule.verified_at).format('DD MMMM YYYY, HH:mm') + ' WIT'
      : dayjs().format('DD MMMM YYYY, HH:mm') + ' WIT';

    const qrData = encodeURIComponent(`MOZES-PERMIT:${schedule.schedule_number}|${schedule.registration_number}|${schedule.parking_location || 'Hanggar'}`);
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=${qrData}`;

    const mailOptions = {
      from: `"Petugas Lapangan - UPBU Mozes Kilangin" <${fromEmail}>`,
      to: to,
      subject: `[IZIN MASUK DISETUJUI] Tiket Izin Masuk Hanggar ${schedule.schedule_number} - ${schedule.registration_number} (${tenant?.nama_perusahaan || 'Tenant'})`,
      attachments: pdfAttachment ? [pdfAttachment] : [],
      html: `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tiket Izin Masuk Hanggar</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f1f5f9; padding: 30px 12px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 620px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08); border: 1px solid #e2e8f0;">
          
          <!-- Header Branding (Navy to Airport Blue Gradient) -->
          <tr>
            <td style="background: linear-gradient(135deg, #0b2545 0%, #134074 50%, #008db9 100%); padding: 26px 24px; text-align: center;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td align="center">
                    <div style="display: inline-block; background-color: rgba(255, 255, 255, 0.15); border: 1px solid rgba(255, 255, 255, 0.25); border-radius: 6px; padding: 4px 12px; margin-bottom: 8px;">
                      <span style="font-size: 13px; font-weight: 800; color: #ffffff; letter-spacing: 2px;">MARS AIRSIDE ACCESS</span>
                    </div>
                    <h1 style="color: #ffffff; font-size: 16px; font-weight: 700; margin: 0; letter-spacing: 0.5px; text-transform: uppercase;">
                      UPBU KELAS I MOZES KILANGIN TIMIKA
                    </h1>
                    <p style="color: rgba(255, 255, 255, 0.85); font-size: 11px; margin: 4px 0 0 0;">
                      Dinas Perhubungan Kabupaten Mimika &bull; Pelayanan Fasilitas Hanggar &amp; Apron
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Entry Pass Header Badge -->
          <tr>
            <td style="padding: 24px 28px 12px 28px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td>
                    <span style="display: inline-block; background-color: #f1f5f9; color: #0f172a; border: 1px solid #cbd5e1; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; padding: 5px 14px; border-radius: 4px;">
                      IZIN MASUK DISETUJUI &bull; VALID
                    </span>
                  </td>
                  <td align="right">
                    <span style="font-size: 11px; color: #64748b; font-weight: 600;">E-GATE PASS RESMI</span>
                  </td>
                </tr>
              </table>
              <h2 style="font-size: 18px; font-weight: 800; color: #0f172a; margin: 12px 0 4px 0;">
                Tiket Izin Masuk Hanggar (Hangar Entry Pass)
              </h2>
              <p style="font-size: 13px; color: #475569; margin: 0; line-height: 1.5;">
                Permohonan jadwal pemanfaatan fasilitas hanggar telah diperiksa dan disetujui oleh Petugas Lapangan. Gunakan tiket ini sebagai bukti izin masuk area airside.
              </p>
            </td>
          </tr>

          <!-- Boarding Pass Style Card -->
          <tr>
            <td style="padding: 12px 28px 24px 28px;">
              <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 10px; overflow: hidden;">
                <!-- Top strip -->
                <div style="background: #1e293b; color: #ffffff; padding: 10px 16px; font-size: 11px; font-weight: bold;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                    <tr>
                      <td style="color: #94a3b8; font-size: 11px;">NOMOR PENGAJUAN / PERMIT NO:</td>
                      <td align="right" style="color: #38bdf8; font-family: 'Courier New', monospace; font-size: 13px; font-weight: 800;">
                        ${schedule.schedule_number}
                      </td>
                    </tr>
                  </table>
                </div>

                <!-- Main ticket content table -->
                <div style="padding: 18px;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                    <tr>
                      <!-- Left details -->
                      <td valign="top" style="padding-right: 14px;">
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="6" border="0" style="font-size: 12px;">
                          <tr>
                            <td width="38%" style="color: #64748b; font-weight: 600;">Maskapai / Tenant:</td>
                            <td style="color: #0f172a; font-weight: 700;">
                              ${tenant?.nama_perusahaan || '-'}
                              ${tenant?.tenant_id_str ? `<span style="display: block; font-size: 11px; color: #64748b; font-weight: normal; font-family: monospace;">ID: ${tenant.tenant_id_str}</span>` : ''}
                            </td>
                          </tr>
                          <tr>
                            <td style="color: #64748b; font-weight: 600;">Armada Pesawat:</td>
                            <td style="color: #0369a1; font-weight: 800; font-family: 'Courier New', monospace; font-size: 14px;">
                              ${schedule.registration_number} <span style="font-size: 11px; font-weight: normal; color: #64748b;">(${schedule.aircraft_type || 'Standar'})</span>
                            </td>
                          </tr>
                          <tr>
                            <td style="color: #64748b; font-weight: 600;">Estimasi Kedatangan:</td>
                            <td style="color: #0f172a; font-weight: 700;">${arrivalFormatted}</td>
                          </tr>
                          <tr>
                            <td style="color: #64748b; font-weight: 600;">Keperluan:</td>
                            <td style="color: #0f172a; font-weight: 700;">${schedule.purpose || 'Inap / RON'}</td>
                          </tr>
                          <tr>
                            <td style="color: #64748b; font-weight: 600;">Alokasi Penempatan:</td>
                            <td style="color: #0f172a; font-weight: 700;">
                              ${schedule.parking_location || 'Hanggar Utama Mozes Kilangin'}
                            </td>
                          </tr>
                        </table>
                      </td>

                      <!-- Right QR Code Box -->
                      <td width="140" valign="top" align="center" style="border-left: 1.5px dashed #cbd5e1; padding-left: 14px;">
                        <img src="${qrCodeUrl}" width="120" height="120" alt="QR Code Permohonan" style="display: block; border-radius: 6px; border: 1px solid #e2e8f0;" />
                        <span style="display: block; font-size: 9px; color: #64748b; margin-top: 6px; text-align: center; line-height: 1.3;">
                          Pindai di Pos Jaga Hanggar Airside
                        </span>
                      </td>
                    </tr>
                  </table>
                </div>

                <!-- Verification footer inside card -->
                <div style="background-color: #f1f5f9; border-top: 1px solid #e2e8f0; padding: 12px 18px; font-size: 11px;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                    <tr>
                      <td>
                        <span style="color: #64748b;">Diverifikasi oleh:</span>
                        <strong style="color: #0f172a; margin-left: 4px;">${officer?.username || 'Petugas Lapangan'}</strong>
                      </td>
                      <td align="right">
                        <span style="color: #64748b;">Waktu Verifikasi:</span>
                        <strong style="color: #0f172a; margin-left: 4px;">${verifiedAtFormatted}</strong>
                      </td>
                    </tr>
                  </table>
                  ${schedule.officer_notes ? `
                  <div style="margin-top: 8px; padding-top: 8px; border-top: 1px dashed #cbd5e1; color: #334155; font-style: italic;">
                    <strong>Catatan Petugas:</strong> &ldquo;${schedule.officer_notes}&rdquo;
                  </div>
                  ` : ''}
                </div>
              </div>
            </td>
          </tr>

          <!-- Standard Operating Procedure (SOP) Airside Guidance -->
          <tr>
            <td style="padding: 0 28px 24px 28px;">
              <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 14px 16px; border-radius: 4px;">
                <h4 style="margin: 0 0 6px 0; font-size: 12px; font-weight: 800; color: #92400e; text-transform: uppercase;">
                  Petunjuk &amp; Prosedur Masuk Area Airside:
                </h4>
                <ol style="margin: 0; padding-left: 18px; font-size: 12px; color: #78350f; line-height: 1.6;">
                  <li>Tunjukkan salinan digital e-Tiket ini kepada Petugas Marshaller / Aviation Security saat pesawat mendarat dan mendekati hanggar.</li>
                  <li>Pastikan seluruh kru dan teknisi mematuhi standar keselamatan kerja (Safety Vest &amp; ID Card Bandara).</li>
                  <li>Hubungi koordinasi radio Ground Handling / Petugas Lapangan sebelum pergerakan atau penarikan armada (<em>towing</em>).</li>
                </ol>
              </div>
            </td>
          </tr>

          <!-- Footer Information -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 24px; text-align: center;">
              <p style="font-size: 11px; color: #64748b; margin: 0 0 4px 0;">
                Email ini dikirimkan secara otomatis oleh Sistem MARS UPBU Mozes Kilangin Timika.
              </p>
              <p style="font-size: 11px; color: #94a3b8; margin: 0;">
                Jl. Bandara Mozes Kilangin, Timika, Kabupaten Mimika, Papua Tengah &bull; Layanan Informasi Operasional
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `
    };

    const info = await tp.sendMail(mailOptions);
    console.log('Hangar Entry Permit Email sent successfully: %s to %s', info.messageId, to);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending Hangar Entry Permit Email:', error);
    return { success: false, error: error.message };
  }
};



