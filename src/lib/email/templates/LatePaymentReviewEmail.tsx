import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

interface LatePaymentReviewEmailProps {
  orderNumber: string;
  totalAmountFormatted: string;
  orderUrl?: string;
  locale?: string;
}

export function LatePaymentReviewEmail({
  orderNumber,
  totalAmountFormatted,
  orderUrl,
  locale = "id",
}: LatePaymentReviewEmailProps) {
  const isId = locale === "id";

  return (
    <Html>
      <Head />
      <Preview>
        {isId
          ? `Pemberitahuan Pesanan #${orderNumber} - Mercato`
          : `Order Notice #${orderNumber} - Mercato`}
      </Preview>
      <Body style={{ backgroundColor: "#f9fafb", fontFamily: "sans-serif", padding: "20px 0" }}>
        <Container
          style={{
            backgroundColor: "#ffffff",
            padding: "32px",
            borderRadius: "12px",
            maxWidth: "520px",
          }}
        >
          <Heading
            style={{ fontSize: "20px", fontWeight: "bold", color: "#18181b", marginBottom: "8px" }}
          >
            {isId ? "Status Pembayaran Pesanan Anda" : "Payment Status Notice"}
          </Heading>
          <Text style={{ fontSize: "14px", color: "#52525b", lineHeight: "22px" }}>
            {isId ? (
              <>
                Kami telah menerima pembayaran sebesar{" "}
                <strong style={{ color: "#18181b" }}>{totalAmountFormatted}</strong> untuk pesanan{" "}
                <strong>#{orderNumber}</strong>. Namun, karena pembayaran selesai setelah batas
                waktu reservasi berakhir, pesanan Anda saat ini sedang dalam peninjauan oleh tim
                kami.
              </>
            ) : (
              <>
                We have received your payment of{" "}
                <strong style={{ color: "#18181b" }}>{totalAmountFormatted}</strong> for order{" "}
                <strong>#{orderNumber}</strong>. However, because payment was completed after the
                reservation window expired, your order has been placed on hold for manual review.
              </>
            )}
          </Text>
          <Text style={{ fontSize: "14px", color: "#52525b", lineHeight: "22px" }}>
            {isId
              ? "Tim kami akan memeriksa ketersediaan inventaris dan segera menghubungi Anda atau memproses pengembalian dana jika stok tidak tersedia."
              : "Our team will verify stock availability and contact you shortly with an update or issue a refund if stock cannot be fulfilled."}
          </Text>
          <Hr style={{ borderColor: "#e4e4e7", margin: "20px 0" }} />
          {orderUrl && (
            <Section style={{ textAlign: "center", margin: "24px 0" }}>
              <Button
                href={orderUrl}
                style={{
                  backgroundColor: "#18181b",
                  color: "#ffffff",
                  padding: "12px 24px",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: "600",
                  textDecoration: "none",
                }}
              >
                {isId ? "Lihat Detail Pesanan" : "View Order Details"}
              </Button>
            </Section>
          )}
        </Container>
      </Body>
    </Html>
  );
}
