import { LIMITS } from 'shared';

export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private capacity: number;
  private refillRate: number; // tokens per ms

  constructor(ratePerSec: number = LIMITS.WS_RATE_LIMIT_PER_SEC) {
    this.capacity = ratePerSec;
    this.tokens = ratePerSec;
    this.refillRate = ratePerSec / 1000;
    this.lastRefill = Date.now();
  }

  public allow(): boolean {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    return false;
  }
}

