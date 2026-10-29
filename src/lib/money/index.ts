export type CurrencyCode = "IDR" | "USD" | "EUR" | "SGD" | string;

export interface Money {
  amount: number; // Integer minor units (e.g. 150000 IDR = 150000, 15.50 USD = 1550)
  currency: CurrencyCode;
}

const ZERO_DECIMAL_CURRENCIES = new Set(["IDR", "JPY", "KRW", "VND"]);

export function getCurrencyDecimals(currency: CurrencyCode): number {
  return ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase()) ? 0 : 2;
}

export function createMoney(amount: number, currency: CurrencyCode): Money {
  if (!Number.isInteger(amount)) {
    throw new TypeError(`Money amount must be an integer in minor units. Received: ${amount}`);
  }
  return { amount, currency: currency.toUpperCase() };
}

function assertMatchingCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new Error(
      `Cannot perform operations on different currencies: ${a.currency} and ${b.currency}`,
    );
  }
}

export function addMoney(a: Money, b: Money): Money {
  assertMatchingCurrency(a, b);
  return {
    amount: a.amount + b.amount,
    currency: a.currency,
  };
}

export function subtractMoney(a: Money, b: Money): Money {
  assertMatchingCurrency(a, b);
  return {
    amount: a.amount - b.amount,
    currency: a.currency,
  };
}

export function multiplyMoney(money: Money, factor: number): Money {
  if (factor < 0) {
    throw new RangeError(`Factor must be non-negative. Received: ${factor}`);
  }
  return {
    amount: Math.round(money.amount * factor),
    currency: money.currency,
  };
}

/**
 * Distributes a monetary amount across proportions without losing rounding remainders.
 * Standard Hare-Niemeyer / Largest Remainder Method.
 */
export function allocateMoney(money: Money, ratios: number[]): Money[] {
  if (ratios.length === 0) {
    return [];
  }
  const totalRatio = ratios.reduce((sum, r) => sum + r, 0);
  if (totalRatio <= 0) {
    throw new Error("Sum of ratios must be greater than zero");
  }

  let remainder = money.amount;
  const shares: number[] = [];

  for (const ratio of ratios) {
    const share = Math.floor((money.amount * ratio) / totalRatio);
    shares.push(share);
    remainder -= share;
  }

  // Distribute 1 minor unit to the largest fractional parts until remainder is 0
  for (let i = 0; i < remainder; i++) {
    const targetIndex = i % shares.length;
    const current = shares[targetIndex];
    if (current !== undefined) {
      shares[targetIndex] = current + 1;
    }
  }

  return shares.map((share) => ({
    amount: share,
    currency: money.currency,
  }));
}

export function formatMoney(money: Money, locale = "id-ID"): string {
  const decimals = getCurrencyDecimals(money.currency);
  const majorValue = decimals === 0 ? money.amount : money.amount / 10 ** decimals;

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: money.currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(majorValue);
}
