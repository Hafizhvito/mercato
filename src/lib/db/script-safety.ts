/**
 * Script safety utilities to prevent accidental mutations of unintended databases.
 *
 * NOTE: Neon branch endpoints use dynamic hashes (e.g. ep-sweet-forest-123456)
 * where branch names ('main', 'production', 'test') do NOT appear in the hostname.
 * The true and only guarantee of production isolation is never storing the production
 * connection string in local .env files.
 */

export function maskHost(host: string): string {
  if (host.includes("localhost") || host.includes("127.0.0.1")) {
    return host;
  }
  if (host.length <= 10) return "***";
  const start = host.slice(0, 5);
  const end = host.slice(-4);
  return `${start}***${end}`;
}

export function getMaskedTarget(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    const host = maskHost(parsed.host);
    const dbName = parsed.pathname.replace(/^\//, "") || "postgres";
    return `${host}/${dbName}`;
  } catch {
    return "***/***";
  }
}

export interface ScriptSafetyResult {
  maskedTarget: string;
  confirmed: boolean;
}

export function assertSafeTarget(options: {
  targetUrl: string;
  scriptName: string;
  argv?: string[];
}): ScriptSafetyResult {
  const argv = options.argv ?? process.argv;

  // Strict production runtime guard
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_PRODUCTION_MUTATION !== "true") {
    throw new Error(
      `Fatal: Execution of mutating script "${options.scriptName}" is prohibited when NODE_ENV is 'production'.`,
    );
  }

  const maskedTarget = getMaskedTarget(options.targetUrl);

  // Search for --confirm-target=<val>
  const confirmArg = argv.find((arg) => arg.startsWith("--confirm-target="));
  const providedTarget = confirmArg ? confirmArg.split("=")[1] : null;

  if (providedTarget) {
    if (providedTarget !== maskedTarget) {
      throw new Error(
        `[SAFETY ERROR] Target mismatch for script "${options.scriptName}"!\n` +
          `  Provided: --confirm-target=${providedTarget}\n` +
          `  Actual:   ${maskedTarget}\n` +
          "Execution halted to prevent unintended database mutations.",
      );
    }
    return { maskedTarget, confirmed: true };
  }

  // Legacy bare --confirm flag is no longer sufficient
  if (argv.includes("--confirm")) {
    throw new Error(
      `[SAFETY ERROR] Bare --confirm is deprecated and rejected for "${options.scriptName}".\n` +
        `You must provide the exact masked target confirmation:\n` +
        `  --confirm-target=${maskedTarget}`,
    );
  }

  return { maskedTarget, confirmed: false };
}
