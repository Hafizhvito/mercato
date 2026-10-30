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

interface OrderConfirmationEmailProps {
  orderNumber: string;
  totalAmountFormatted: string;
  orderUrl?: string;
}

export function OrderConfirmationEmail({
  orderNumber,
  totalAmountFormatted,
  orderUrl,
}: OrderConfirmationEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Order #{orderNumber} Confirmation - Mercato</Preview>
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
            Order Confirmation
          </Heading>
          <Text style={{ fontSize: "14px", color: "#52525b", lineHeight: "22px" }}>
            Thank you for your order! We have received your order <strong>#{orderNumber}</strong>.
          </Text>
          <Hr style={{ borderColor: "#e4e4e7", margin: "20px 0" }} />
          <Section>
            <Text style={{ fontSize: "14px", color: "#71717a", margin: "4px 0" }}>
              Total Amount: <strong style={{ color: "#18181b" }}>{totalAmountFormatted}</strong>
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
                View Order Details
              </Button>
            </Section>
          )}
          <Text style={{ fontSize: "12px", color: "#a1a1aa", marginTop: "24px" }}>
            Mercato E-Commerce Platform. All rights reserved.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
