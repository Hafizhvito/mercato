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

interface PasswordResetEmailProps {
  userName?: string;
  resetUrl: string;
}

export function PasswordResetEmail({ userName, resetUrl }: PasswordResetEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Reset your Mercato account password</Preview>
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
            Password Reset Request
          </Heading>
          <Text style={{ fontSize: "14px", color: "#52525b", lineHeight: "22px" }}>
            Hello {userName ?? "Customer"},
          </Text>
          <Text style={{ fontSize: "14px", color: "#52525b", lineHeight: "22px" }}>
            We received a request to reset your Mercato account password. Click the button below to
            choose a new password:
          </Text>
          <Section style={{ textAlign: "center", margin: "24px 0" }}>
            <Button
              href={resetUrl}
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
              Reset Password
            </Button>
          </Section>
          <Text style={{ fontSize: "12px", color: "#a1a1aa", marginTop: "24px" }}>
            If you did not request this password reset, please ignore this email or contact support
            if you have concerns.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
