"use client";

import { Mail } from "lucide-react";
import { useState } from "react";

interface Template {
  id: string;
  name: string;
  trigger: string;
  idSubject: string;
  enSubject: string;
  idBody: string;
  enBody: string;
  buttonLabelId?: string;
  buttonLabelEn?: string;
}

const TEMPLATES: Template[] = [
  {
    id: "orderConfirmation",
    name: "Konfirmasi Pesanan Baru (Order Confirmation)",
    trigger: "Dikirim ke pembeli segera setelah checkout berhasil dibuat.",
    idSubject: "Konfirmasi Pesanan #{orderNumber} - Mercato",
    enSubject: "Order Confirmation #{orderNumber} - Mercato",
    idBody:
      "Terima kasih atas pesanan Anda! Kami telah menerima pesanan #{orderNumber} dan sedang menunggu pembayaran.",
    enBody:
      "Thank you for your order! We have received order #{orderNumber} and are awaiting payment.",
    buttonLabelId: "Lihat Detail Pesanan",
    buttonLabelEn: "View Order Details",
  },
  {
    id: "paymentReceived",
    name: "Pembayaran Berhasil Diterima (Payment Received)",
    trigger: "Dikirim saat webhook pembayaran sukses diterima dari gateway.",
    idSubject: "Pembayaran Diterima untuk Pesanan #{orderNumber} - Mercato",
    enSubject: "Payment Received for Order #{orderNumber} - Mercato",
    idBody:
      "Kami telah berhasil menerima pembayaran Anda. Pesanan Anda sedang dipersiapkan oleh tim gudang kami.",
    enBody:
      "We have successfully received your payment. Your order is now being processed by our warehouse team.",
    buttonLabelId: "Lihat Status Pesanan",
    buttonLabelEn: "View Order Status",
  },
  {
    id: "orderShipped",
    name: "Pesanan Dikirim & Resi (Order Shipped)",
    trigger: "Dikirim saat staf menandai pesanan sebagai 'Shipped' dengan resi.",
    idSubject: "Pesanan Mercato Anda #{orderNumber} Telah Dikirim!",
    enSubject: "Your Mercato Order #{orderNumber} Has Shipped!",
    idBody:
      "Kabar gembira! Pesanan #{orderNumber} telah diserahkan ke kurir {carrier} dengan nomor resi {trackingNumber}.",
    enBody:
      "Great news! Order #{orderNumber} has been handed over to {carrier} with tracking number {trackingNumber}.",
    buttonLabelId: "Lacak Pengiriman",
    buttonLabelEn: "Track Package",
  },
  {
    id: "latePaymentReview",
    name: "Peninjauan Pembayaran Terlambat (Late Payment Review)",
    trigger: "Dikirim netral saat pembayaran masuk setelah kedaluwarsa & stok habis.",
    idSubject: "Pemberitahuan Pesanan #{orderNumber} - Mercato",
    enSubject: "Order Notice #{orderNumber} - Mercato",
    idBody:
      "Pembayaran diterima setelah masa checkout berakhir. Tim kami sedang meninjau ketersediaan stok fisik di gudang.",
    enBody:
      "Payment was received after checkout expiration. Our team is currently reviewing physical inventory availability.",
    buttonLabelId: "Lihat Status Pesanan",
    buttonLabelEn: "View Order Status",
  },
  {
    id: "verification",
    name: "Verifikasi Alamat Email (Email Verification)",
    trigger: "Dikirim saat pendaftaran akun baru.",
    idSubject: "Verifikasi alamat email akun Mercato Anda",
    enSubject: "Verify your Mercato account email address",
    idBody:
      "Silakan klik tombol di bawah untuk memverifikasi alamat email Anda dan mengaktifkan akun Mercato Anda.",
    enBody:
      "Please click the button below to verify your email address and activate your Mercato account.",
    buttonLabelId: "Verifikasi Email Saya",
    buttonLabelEn: "Verify My Email",
  },
  {
    id: "passwordReset",
    name: "Pengaturan Ulang Kata Sandi (Password Reset)",
    trigger: "Dikirim saat pengguna meminta reset password.",
    idSubject: "Atur ulang kata sandi akun Mercato Anda",
    enSubject: "Reset your Mercato account password",
    idBody:
      "Kami menerima permintaan pengaturan ulang kata sandi. Klik tombol di bawah untuk membuat kata sandi baru.",
    enBody:
      "We received a password reset request. Click the button below to choose a new password.",
    buttonLabelId: "Atur Ulang Kata Sandi",
    buttonLabelEn: "Reset Password",
  },
];

export function EmailTemplatesPreview() {
  const [selectedId, setSelectedId] = useState(TEMPLATES[0]?.id);
  const [previewLocale, setPreviewLocale] = useState<"id" | "en">("id");

  const currentTemplate = TEMPLATES.find((t) => t.id === selectedId) || TEMPLATES[0]!;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-zinc-950 flex items-center gap-2">
            <Mail className="h-4 w-4 text-zinc-500" />
            Pratinjau Templat Email Transaksional (Read-Only)
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            Pratinjau visual template email notifikasi yang dikirim otomatis ke pelanggan.
          </p>
        </div>

        {/* Locale Selector */}
        <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-lg text-xs font-semibold">
          <button
            type="button"
            onClick={() => setPreviewLocale("id")}
            className={`px-3 py-1 rounded-md transition ${
              previewLocale === "id" ? "bg-white text-zinc-950 shadow-xs" : "text-zinc-600"
            }`}
          >
            Bahasa Indonesia
          </button>
          <button
            type="button"
            onClick={() => setPreviewLocale("en")}
            className={`px-3 py-1 rounded-md transition ${
              previewLocale === "en" ? "bg-white text-zinc-950 shadow-xs" : "text-zinc-600"
            }`}
          >
            English
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Template List Selector */}
        <div className="space-y-1">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSelectedId(t.id)}
              className={`w-full text-left p-3 rounded-lg text-xs transition border ${
                selectedId === t.id
                  ? "border-zinc-900 bg-zinc-900 text-white font-semibold"
                  : "border-transparent hover:bg-zinc-50 text-zinc-700"
              }`}
            >
              <div className="font-semibold">{t.name}</div>
              <div
                className={`text-[10px] mt-0.5 ${
                  selectedId === t.id ? "text-zinc-300" : "text-zinc-400"
                }`}
              >
                {t.trigger}
              </div>
            </button>
          ))}
        </div>

        {/* Mockup Preview Card */}
        <div className="md:col-span-2 rounded-xl border border-zinc-200 bg-zinc-50/50 p-6 space-y-4">
          <div className="space-y-1.5 border-b border-zinc-200 pb-3 text-xs">
            <div className="flex gap-2">
              <span className="font-semibold text-zinc-500 w-16">Subjek:</span>
              <span className="font-bold text-zinc-900">
                {previewLocale === "id" ? currentTemplate.idSubject : currentTemplate.enSubject}
              </span>
            </div>
            <div className="flex gap-2 text-zinc-500">
              <span className="font-semibold w-16">Pengirim:</span>
              <span>Mercato Store &lt;no-reply@mercato.local&gt;</span>
            </div>
          </div>

          {/* Email Body Rendering */}
          <div className="bg-white rounded-xl border border-zinc-200 p-6 space-y-4 max-w-md mx-auto shadow-xs text-xs text-zinc-800">
            <div className="font-bold text-lg text-zinc-950 border-b border-zinc-100 pb-3">
              Mercato
            </div>

            <p className="leading-relaxed">
              {previewLocale === "id" ? currentTemplate.idBody : currentTemplate.enBody}
            </p>

            {currentTemplate.buttonLabelId && (
              <div className="pt-2">
                <span className="inline-block rounded-lg bg-zinc-900 px-5 py-2.5 text-xs font-semibold text-white shadow-xs">
                  {previewLocale === "id"
                    ? currentTemplate.buttonLabelId
                    : currentTemplate.buttonLabelEn}
                </span>
              </div>
            )}

            <div className="pt-4 border-t border-zinc-100 text-[10px] text-zinc-400 leading-relaxed">
              Mercato E-Commerce Platform. Hak cipta dilindungi undang-undang.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
