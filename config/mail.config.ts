export type MailConfig = Readonly<{
  address: string;
  appPassword: string;
  mailbox: string;
  host: string;
  port: number;
  secure: boolean;
  connectionTimeoutMs: number;
  greetingTimeoutMs: number;
  socketTimeoutMs: number;
  deliveryTimeoutMs: number;
  pollIntervalMs: number;
  shutdownTimeoutMs: number;
}>;

const mailDefaults = {
  mailbox: 'INBOX',
  host: 'imap.gmail.com',
  port: 993,
  secure: true,
  connectionTimeoutMs: 15_000,
  greetingTimeoutMs: 15_000,
  // Keep the connection alive during registration and verification UI steps.
  socketTimeoutMs: 300_000,
  deliveryTimeoutMs: 90_000,
  pollIntervalMs: 2_000,
  shutdownTimeoutMs: 5_000,
} as const;

function requiredValue(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`Missing required email configuration: ${name}.`);
  return value;
}

// Load lazily so registration-only tests do not require Gmail credentials.
export function loadMailConfig(env: NodeJS.ProcessEnv = process.env): MailConfig {
  const address = requiredValue(env, 'GMAIL_ADDRESS');
  if (!/^[^+@\s]+@(gmail\.com|googlemail\.com)$/i.test(address)) {
    throw new Error('GMAIL_ADDRESS must be a Gmail address without a +alias.');
  }
  const appPassword = requiredValue(env, 'GMAIL_APP_PASSWORD').replace(/\s/g, '');
  if (!appPassword) throw new Error('Missing required email configuration: GMAIL_APP_PASSWORD.');

  return Object.freeze({
    ...mailDefaults,
    address,
    appPassword,
    mailbox: env.GMAIL_MAILBOX?.trim() || mailDefaults.mailbox,
  });
}
