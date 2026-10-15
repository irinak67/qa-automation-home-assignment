import { timeouts } from '../../config/test.config';
import type { Page, Request, Response } from '@playwright/test';
import { AuthEndpoint } from '../../constants/auth-endpoints';

// Register before the action to retain early responses; the timeout starts in wait().
export function observeAuthResponse(page: Page, endpoint: AuthEndpoint) {
  let result: { response: Response } | { error: Error } | undefined;
  let wake: (() => void) | undefined;
  const matches = (request: Request) =>
    request.method() === 'POST' && new URL(request.url()).pathname === endpoint;
  const onResponse = (response: Response) => {
    if (matches(response.request()) && !result) {
      result = { response }; wake?.();
    }
  };
  const onFailure = (request: Request) => {
    if (matches(request) && !result) {
      result = { error: new Error(`Request ${endpoint} failed: ${request.failure()?.errorText ?? 'network failure'}. Inspect network/CORS errors in the trace.`) };
      wake?.();
    }
  };
  page.on('response', onResponse);
  page.on('requestfailed', onFailure);
  return {
    async wait(timeoutMs: number = timeouts.authResponseMs): Promise<Response> {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        if (!result) await new Promise<void>((resolve, reject) => {
          wake = resolve;
          timer = setTimeout(() => reject(new Error(`No response for ${endpoint} within ${timeoutMs}ms.`)), timeoutMs);
        });
        if (!result) throw new Error(`No result for ${endpoint}.`);
        if ('error' in result) throw result.error;
        return result.response;
      } finally {
        clearTimeout(timer); wake = undefined;
      }
    },
    dispose() {
      page.off('response', onResponse);
      page.off('requestfailed', onFailure);
    },
  };
}
