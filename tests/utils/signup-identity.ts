import { randomUUID } from 'node:crypto';

export function newSignupIdentity(base: string) {
  const match = /^([^+@\s]+)@(gmail\.com|googlemail\.com)$/i.exec(base);
  if (!match) throw new Error('GMAIL_ADDRESS must be a Gmail address without a +alias.');
  const suffix = randomUUID().replaceAll('-', '');
  return {
    email: `${match[1]}+qa${suffix}@${match[2]}`.toLowerCase(),
    nickname: `Qa${suffix.slice(0, 8)}`,
    password: `Qa!${randomUUID()}7`,
  };
}
