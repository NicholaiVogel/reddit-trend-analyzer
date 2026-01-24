export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export class RateLimiter {
  private lastRequest = 0
  private minDelay: number
  private backoffMultiplier = 1

  constructor(minDelayMs: number = 5000) {
    this.minDelay = minDelayMs
  }

  async wait(): Promise<void> {
    const now = Date.now()
    const effectiveDelay = this.minDelay * this.backoffMultiplier
    const elapsed = now - this.lastRequest
    if (elapsed < effectiveDelay) {
      await delay(effectiveDelay - elapsed)
    }
    this.lastRequest = Date.now()
  }

  backoff(): void {
    this.backoffMultiplier = Math.min(this.backoffMultiplier * 2, 10)
    console.log(`  rate limited, backing off to ${this.minDelay * this.backoffMultiplier}ms`)
  }

  reset(): void {
    this.backoffMultiplier = 1
  }

  setDelay(ms: number): void {
    this.minDelay = ms
  }
}

export async function fetchWithRetry<T>(
  url: string,
  options: RequestInit,
  rateLimiter: RateLimiter,
  maxRetries: number = 3
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    await rateLimiter.wait()

    const response = await fetch(url, options)

    if (response.status === 429) {
      rateLimiter.backoff()
      if (attempt < maxRetries) {
        continue
      }
      throw new Error('Rate limited after max retries')
    }

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status} ${response.statusText}`)
    }

    rateLimiter.reset()
    return response.json() as Promise<T>
  }

  throw new Error('Max retries exceeded')
}
