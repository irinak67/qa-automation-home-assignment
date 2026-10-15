import { EventEmitter } from 'node:events';
import { test, expect, type Page } from '@playwright/test';
import { observeAuthResponse } from '../clients/auth-response';
import { AuthEndpoint } from '../../constants/auth-endpoints';

const request = {
  method: () => 'POST', url: () => `https://example.test${AuthEndpoint.CreateSession}`,
  failure: () => ({ errorText: 'net::ERR_FAILED' }),
};

test('session response arriving before wait is retained', async () => {
  const page = new EventEmitter();
  const observer = observeAuthResponse(page as unknown as Page, AuthEndpoint.CreateSession);
  const response = { request: () => request, status: () => 200 };
  page.emit('response', response);
  expect(await observer.wait(40)).toBe(response);
  observer.dispose();
  expect(page.listenerCount('response')).toBe(0);
  expect(page.listenerCount('requestfailed')).toBe(0);
});

test('session network failure is retained and reported explicitly', async () => {
  const page = new EventEmitter();
  const observer = observeAuthResponse(page as unknown as Page, AuthEndpoint.CreateSession);
  page.emit('requestfailed', request);
  await expect(observer.wait(40)).rejects.toThrow('net::ERR_FAILED');
  observer.dispose();
});

test('absent session response has a bounded wait', async () => {
  const page = new EventEmitter();
  const observer = observeAuthResponse(page as unknown as Page, AuthEndpoint.CreateSession);
  await expect(observer.wait(40)).rejects.toThrow('No response');
  observer.dispose();
});
