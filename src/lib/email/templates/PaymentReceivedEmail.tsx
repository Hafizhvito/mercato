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

interface PaymentReceivedEmailProps {
  orderNumber: string;
  totalAmountFormatted: string;
  paymentMethod: string;
  orderUrl?: string;
}

export function PaymentReceivedEmail({
  orderNumber,
  totalAmountFormatted,
  paymentMethod,
  orderUrl,
}: PaymentReceivedEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Payment Received for Order #{orderNumber} - Mercato</Preview>
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
            style={{ fontSize: "22px", fontWeight: "bold", color: "#18181b", marginBottom: "8px" }}
          >
            Payment Confirmed
          </Heading>
          <Text style={{ fontSize: "14px", color: "#52525b", lineHeight: "22px" }}>
            We have successfully received your payment for order <strong>#{orderNumber}</strong>.
            Your order is now being processed by our warehouse team.
          </Text>
          <Hr style={{ borderColor: "#e4e4e7", margin: "20px 0" }} />
          <Section>
            <Text style={{ fontSize: "14px", color: "#71717a", margin: "4px 0" }}>
              Amount Paid: <strong style={{ color: "#18181b" }}>{totalAmountFormatted}</strong>
            </Text>
            <Text style={{ fontSize: "14px", color: "#71717a", margin: "4px 0" }}>
              Payment Method: <strong style={{ color: "#18181b" }}>{paymentMethod}</strong>
            </Text>
          </Section>
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
                Track Order
              </Button>
            </Section>
          )}
          <Text style={{ fontSize: "12px", color: "#a1a1aa", marginTop: "24px" }}>
            Mercato E-Commerce Platform. Thank you for your business!
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
