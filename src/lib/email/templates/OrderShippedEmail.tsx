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

interface OrderShippedEmailProps {
  orderNumber: string;
  trackingNumber: string;
  carrier: string;
  trackingUrl?: string;
}

export function OrderShippedEmail({
  orderNumber,
  trackingNumber,
  carrier,
  trackingUrl,
}: OrderShippedEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Your Mercato Order #{orderNumber} has shipped!</Preview>
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
            Your Order is On Its Way!
          </Heading>
          <Text style={{ fontSize: "14px", color: "#52525b", lineHeight: "22px" }}>
            Great news! Your order <strong>#{orderNumber}</strong> has been shipped and is on its
            way to your delivery address.
          </Text>
          <Hr style={{ borderColor: "#e4e4e7", margin: "20px 0" }} />
          <Section>
            <Text style={{ fontSize: "14px", color: "#71717a", margin: "4px 0" }}>
              Carrier: <strong style={{ color: "#18181b" }}>{carrier}</strong>
            </Text>
            <Text style={{ fontSize: "14px", color: "#71717a", margin: "4px 0" }}>
              Tracking Number: <strong style={{ color: "#18181b" }}>{trackingNumber}</strong>
            </Text>
          </Section>
          {trackingUrl && (
            <Section style={{ textAlign: "center", margin: "24px 0" }}>
              <Button
                href={trackingUrl}
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
                Track Shipment
              </Button>
            </Section>
          )}
          <Text style={{ fontSize: "12px", color: "#a1a1aa", marginTop: "24px" }}>
            Mercato E-Commerce Platform. Need assistance? Reply directly to this email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
