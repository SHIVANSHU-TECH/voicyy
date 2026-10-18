const DEFAULT_API_URL = 'http://localhost:4100';

export function getPublicApiUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || DEFAULT_API_URL;
}

export interface ApiMetaResponse {
  name: string;
  version: string;
  phase: number;
  config: {
    liveCallingAllowed: boolean;
    queueDriver: string;
    providers: {
      telephony: string;
      stt: string;
      tts: string;
      conversation: string;
    };
  };
}

export async function fetchApiMeta(signal?: AbortSignal): Promise<ApiMetaResponse> {
  const response = await fetch(`${getPublicApiUrl()}/api/v1/meta`, {
    signal,
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`API meta request failed (${response.status})`);
  }

  return (await response.json()) as ApiMetaResponse;
}
