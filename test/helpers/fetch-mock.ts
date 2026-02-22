import { mock } from "bun:test";

export type FetchMockState = {
  capturedInput?: RequestInfo | URL;
  capturedInit?: RequestInit;
};

export function createFetchMock() {
  let capturedInput: RequestInfo | URL | undefined;
  let capturedInit: RequestInit | undefined;
  const originalFetch = globalThis.fetch;

  function useMockFetch(
    responseFn: (
      input: RequestInfo | URL,
      init?: RequestInit
    ) => Response | Promise<Response>
  ) {
    globalThis.fetch = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
      capturedInput = input;
      capturedInit = init;
      return responseFn(input, init);
    }) as unknown as typeof globalThis.fetch;
  }

  function getCaptured(): FetchMockState {
    return { capturedInput, capturedInit };
  }

  function reset() {
    capturedInput = undefined;
    capturedInit = undefined;
  }

  function restore() {
    globalThis.fetch = originalFetch;
  }

  return { useMockFetch, getCaptured, reset, restore };
}
