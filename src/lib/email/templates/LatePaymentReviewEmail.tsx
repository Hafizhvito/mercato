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
import { getEmailTranslations } from "../messages";

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
  const t = getEmailTranslations(locale);
  const preview = t.latePaymentReview.preview.replace("{orderNumber}", orderNumber);
  const desc = t.latePaymentReview.description
    .replace("{amount}", totalAmountFormatted)
    .replace("{orderNumber}", `#${orderNumber}`);

  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
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
            {t.latePaymentReview.heading}
          </Heading>
          <Text style={{ fontSize: "14px", color: "#52525b", lineHeight: "22px" }}>{desc}</Text>
          <Text style={{ fontSize: "14px", color: "#52525b", lineHeight: "22px" }}>
            {t.latePaymentReview.resolution}
          </Text>
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
                {t.latePaymentReview.viewOrder}
              </Button>
            </Section>
          )}
          <Hr style={{ borderColor: "#e4e4e7", margin: "20px 0" }} />
          <Text style={{ fontSize: "12px", color: "#a1a1aa", marginTop: "16px" }}>
            {t.common.rights}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
