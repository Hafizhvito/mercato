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

interface VerificationEmailProps {
  userName?: string;
  verificationUrl: string;
}

export function VerificationEmail({ userName, verificationUrl }: VerificationEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Verify your Mercato account email address</Preview>
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
            Welcome to Mercato
          </Heading>
          <Text style={{ fontSize: "14px", color: "#52525b", lineHeight: "22px" }}>
            Hello {userName ?? "Customer"},
          </Text>
          <Text style={{ fontSize: "14px", color: "#52525b", lineHeight: "22px" }}>
            Please click the button below to verify your email address and activate your Mercato
            account.
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
              Verify My Email
            </Button>
          </Section>
          <Text style={{ fontSize: "12px", color: "#a1a1aa", marginTop: "24px" }}>
            If you did not request this account creation, you can safely ignore this email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
