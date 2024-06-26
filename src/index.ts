import EventEmitter from "events";

enum CircuitState {
  CLOSED,
  OPEN,
  HALF_OPEN,
}

interface CircuitBreakerOptions {
  failureThreshold: number;
  timeWindow: number;
  resetTimeout: number;
}

interface CircuitBreakerState {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime: number;
  nextAttempt: number;
}

class CircuitBreaker extends EventEmitter {
  private state: CircuitState;
  private failureCount: number;
  private successCount: number;
  private lastFailureTime: number;
  private nextAttempt: number;
  private readonly failureThreshold: number;
  private readonly timeWindow: number;
  private readonly resetTimeout: number;

  constructor(
    options: CircuitBreakerOptions,
    initialState?: CircuitBreakerState
  ) {
    super();
    this.failureThreshold = options.failureThreshold;
    this.timeWindow = options.timeWindow;
    this.resetTimeout = options.resetTimeout;

    if (initialState) {
      this.state = initialState.state;
      this.failureCount = initialState.failureCount;
      this.successCount = initialState.successCount;
      this.lastFailureTime = initialState.lastFailureTime;
      this.nextAttempt = initialState.nextAttempt;
    } else {
      this.state = CircuitState.CLOSED;
      this.failureCount = 0;
      this.successCount = 0;
      this.lastFailureTime = 0;
      this.nextAttempt = 0;
    }
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttempt) {
        this.emit("openCircuit");
        throw new Error("Circuit is OPEN");
      }
      this.toHalfOpen();
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.successCount++;
    if (this.state === CircuitState.HALF_OPEN) {
      this.toClose();
    }
    this.emit("success");
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitState.CLOSED) {
      if (this.isThresholdExceeded()) {
        this.toOpen();
      }
    } else if (this.state === CircuitState.HALF_OPEN) {
      this.toOpen();
    }

    this.emit("failure");
  }

  private isThresholdExceeded(): boolean {
    const totalAttempts = this.failureCount + this.successCount;
    const failureRate = this.failureCount / totalAttempts;
    return (
      failureRate >= this.failureThreshold &&
      totalAttempts >= 3 / this.failureThreshold &&
      Date.now() <= this.lastFailureTime + this.timeWindow
    );
  }

  private toOpen(): void {
    this.state = CircuitState.OPEN;
    this.nextAttempt = Date.now() + this.resetTimeout;
    this.emit("openCircuit");
  }

  private toHalfOpen(): void {
    this.state = CircuitState.HALF_OPEN;
    this.failureCount = 0;
    this.successCount = 0;
    this.emit("halfOpen");
  }

  private toClose(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
    this.nextAttempt = 0;
    this.emit("closeCircuit");
  }

  exportState(): CircuitBreakerState {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      nextAttempt: this.nextAttempt,
    };
  }
}

export {
  CircuitBreaker,
  CircuitBreakerOptions,
  CircuitBreakerState,
  CircuitState,
};
