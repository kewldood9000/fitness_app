export interface TimedRequest {
  signal: AbortSignal
  didTimeout(): boolean
  cleanup(): void
}

export function createTimedRequest(externalSignal?: AbortSignal, timeoutMs = 10_000): TimedRequest {
  const controller = new AbortController()
  let timedOut = false
  const abortFromCaller = () => controller.abort()
  if (externalSignal?.aborted) abortFromCaller()
  else externalSignal?.addEventListener('abort', abortFromCaller, { once: true })
  const timeout = globalThis.setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)

  return {
    signal: controller.signal,
    didTimeout: () => timedOut,
    cleanup: () => {
      globalThis.clearTimeout(timeout)
      externalSignal?.removeEventListener('abort', abortFromCaller)
    }
  }
}
