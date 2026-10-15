export const application = {
  baseURL: 'https://app.canary.talkspace.com',
  apiHostname: 'clientapi.canary.talkspace.com',
  signupPath: '/signup/autoswitchpt',
  testIdAttribute: 'data-qa',
} as const;

export const timeouts = {
  signupReadyMs: 20_000,
  verificationPromptMs: 20_000,
  authResponseMs: 20_000,
  otpErrorMs: 10_000,
  authenticatedShellMs: 30_000,
  emailScenarioMs: 180_000,
  twoDeliveryScenarioMs: 300_000,
} as const;

