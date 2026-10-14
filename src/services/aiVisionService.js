const fs = require('fs');
const path = require('path');

/**
 * Service untuk menganalisis gambar bukti transfer / STS menggunakan OpenAI Vision (gpt-4o-mini).
 * Mengembalikan data terstruktur JSON untuk membantu bendahara dinas memverifikasi setoran kasda.
 */
exports.analyzePaymentReceipt = async (filePath) => {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return {
      status: 'Skipped',
      message: 'OPENAI_API_KEY tidak dikonfigurasi di backend',
      data: null
    };
  }

  if (!filePath) {
    return {
      status: 'Skipped',
      message: 'Path file bukti pembayaran tidak valid',
      data: null
    };
  }

  try {
    let dataUrl = '';
    const isRemoteUrl = typeof filePath === 'string' && (filePath.startsWith('http://') || filePath.startsWith('https://'));

    if (isRemoteUrl) {
      // File tersimpan di Cloudinary / Remote Storage
      try {
        const fetchResp = await fetch(filePath);
        if (!fetchResp.ok) {
          return {
            status: 'Failed',
            message: `Gagal memuat gambar bukti dari Cloudinary (HTTP ${fetchResp.status})`,
            data: null
          };
        }

        const arrayBuf = await fetchResp.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);
        const contentType = fetchResp.headers.get('content-type') || 'image/jpeg';

        // Jika dokumen adalah PDF
        if (contentType.includes('pdf') || filePath.toLowerCase().split('?')[0].endsWith('.pdf')) {
          return {
            status: 'Skipped',
            message: 'Dokumen berformat PDF. Silakan tinjau berkas secara manual melalui lampiran dokumen.',
            data: null
          };
        }

        const base64Str = buffer.toString('base64');
        dataUrl = `data:${contentType};base64,${base64Str}`;
      } catch (dlErr) {
        return {
          status: 'Failed',
          message: `Gagal memproses gambar dari cloud storage: ${dlErr.message}`,
          data: null
        };
      }
    } else {
      // File tersimpan secara lokal di disk server
      const resolvedPath = path.isAbsolute(filePath)
        ? filePath
        : path.join(process.cwd(), filePath);

      if (!fs.existsSync(resolvedPath)) {
        return {
          status: 'Skipped',
          message: 'File bukti fisik tidak ditemukan pada disk',
          data: null
        };
      }

      const ext = path.extname(resolvedPath).toLowerCase();
      const validImageExtensions = ['.jpg', '.jpeg', '.png', '.webp'];

      if (!validImageExtensions.includes(ext)) {
        return {
          status: 'Skipped',
          message: `Format ${ext} merupakan dokumen non-gambar. Silakan tinjau lampiran secara manual.`,
          data: null
        };
      }

      const fileBuffer = await fs.promises.readFile(resolvedPath);
      const mimeType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
      const base64Data = fileBuffer.toString('base64');
      dataUrl = `data:${mimeType};base64,${base64Data}`;
    }

    // Prompt terstruktur untuk ekstraksi perbankan Indonesia
    const systemPrompt = `Anda adalah asisten cerdas audit dan akuntansi keuangan daerah untuk Dinas Perhubungan Kabupaten Mimika (MARS - Mozes Kilangin Airport Revenue System).
Tugas Anda adalah membaca gambar struk bukti transfer bank, resi ATM, tangkapan layar mobile banking, atau bukti Surat Tanda Setoran (STS) Kas Daerah.
Pahami konteks perbankan Indonesia:
- Bedakan antara Nomor Referensi / No. Transaksi (misal: 2026100799812) dengan Nominal Transfer (misal: Rp 3.570.000).
- Abaikan biaya administrasi transfer (misal BI-Fast Rp2.500 atau online Rp6.500) dan ambil nominal pokok/murni yang ditransfer ke rekening tujuan.
- Rekening Kas Umum Daerah (Kasda) Kab. Mimika adalah Bank Papua No. Rekening: 100-01-02-00045-8 atas nama "Kas Umum Daerah Kab. Mimika".
- Hasil HARUS berupa JSON murni dengan format schema berikut.`;

    const userPrompt = `Analisis bukti transfer ini dan ekstrak informasinya dalam format JSON dengan field berikut:
{
  "amount_detected": <number atau null jika tidak terbaca>,
  "sender_name": <string nama pengirim atau null>,
  "sender_bank": <string bank pengirim (contoh: BCA, Mandiri, BRI, Bank Papua) atau null>,
  "destination_bank": <string bank tujuan atau null>,
  "destination_account": <string nomor rekening tujuan atau null>,
  "account_match": <boolean true jika rekening/nama tujuan mengarah ke Kasda Pemkab Mimika / Bank Papua>,
  "reference_number": <string nomor referensi / kode transaksi atau null>,
  "transaction_date": <string tanggal dan jam transaksi atau null>,
  "transfer_status": <"BERHASIL" | "PENDING" | "GAGAL" | "TIDAK_JELAS">,
  "confidence_score": <"HIGH" | "MEDIUM" | "LOW">,
  "notes": <string penjelasan singkat bahasa Indonesia mengenai hasil pembacaan bukti bayar ini>
}`;

    // Request ke OpenAI GPT-4o-mini Vision
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: userPrompt },
              {
                type: 'image_url',
                image_url: {
                  url: dataUrl,
                  detail: 'high'
                }
              }
            ]
          }
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' },
        max_tokens: 600
      })
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.warn('OpenAI Vision API response error:', response.status, errBody);
      return {
        status: 'Failed',
        message: `OpenAI API Error: status ${response.status}`,
        data: null
      };
    }

    const resJson = await response.json();
    const content = resJson.choices?.[0]?.message?.content;
    if (!content) {
      return {
        status: 'Failed',
        message: 'Respon OpenAI tidak memuat konten analisis',
        data: null
      };
    }

    const parsedData = JSON.parse(content);

    return {
      status: 'Success',
      message: 'Analisis bukti transfer berhasil diselesaikan oleh AI Vision',
      data: parsedData
    };
  } catch (error) {
    console.error('aiVisionService error:', error);
    return {
      status: 'Failed',
      message: error.message || 'Terjadi kesalahan saat memproses gambar dengan AI',
      data: null
    };
  }
};
