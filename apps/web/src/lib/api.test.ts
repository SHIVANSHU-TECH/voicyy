import { afterEach, describe, expect, it, vi } from 'vitest';
import { getPublicApiUrl } from './api';

describe('getPublicApiUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('defaults to local API port', () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', '');
    expect(getPublicApiUrl()).toBe('http://localhost:4100');
  });

  it('strips trailing slashes', () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://example.com:4100/');
    expect(getPublicApiUrl()).toBe('http://example.com:4100');
  });
});
