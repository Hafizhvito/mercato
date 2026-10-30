import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import { getEmailTranslations } from "../messages";

interface VerificationEmailProps {
  userName?: string;
  verificationUrl: string;
  locale?: string;
}

export function VerificationEmail({
  userName,
  verificationUrl,
  locale = "id",
}: VerificationEmailProps) {
  const t = getEmailTranslations(locale);
  const greeting = t.verification.greeting.replace("{name}", userName ?? t.common.customerFallback);

  return (
    <Html>
      <Head />
      <Preview>{t.verification.preview}</Preview>
      <Body style={{ backgroundColor: "#f9fafb", fontFamily: "sans-serif", padding: "20px 0" }}>
        <Container
          style={{
            backgroundColor: "#ffffff",
            padding: "32px",
            borderRadius: "12px",
            maxWidth: "480px",
          }}
        >
          <Heading
            style={{ fontSize: "20px", fontWeight: "bold", color: "#18181b", marginBottom: "16px" }}
          >
            {t.verification.heading}
          </Heading>
          <Text style={{ fontSize: "14px", color: "#52525b", lineHeight: "22px" }}>{greeting}</Text>
          <Text style={{ fontSize: "14px", color: "#52525b", lineHeight: "22px" }}>
            {t.verification.description}
          </Text>
          <Section style={{ textAlign: "center", margin: "24px 0" }}>
            <Button
              href={verificationUrl}
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
              {t.verification.button}
            </Button>
          </Section>
          <Text style={{ fontSize: "12px", color: "#a1a1aa", marginTop: "24px" }}>
            {t.verification.expiryNotice}
          </Text>
          <Text style={{ fontSize: "12px", color: "#a1a1aa", marginTop: "16px" }}>
            {t.common.rights}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
