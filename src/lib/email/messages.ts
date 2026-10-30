import enMessages from "../../../messages/en.json";
import idMessages from "../../../messages/id.json";

export type EmailLocale = "id" | "en";

export function getEmailTranslations(locale: string = "id") {
  const normalizedLocale: EmailLocale = locale === "en" ? "en" : "id";
  const messages = normalizedLocale === "en" ? enMessages : idMessages;
  return messages.emails;
}
