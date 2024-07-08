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
  minAttempts?: number;
  minFailures?: number;
  minEvaluationTime?: number;
}

interface CircuitBreakerState {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  firstFailureTime: number;
  lastFailureTime: number;
  nextAttempt: number;
}

class CircuitBreakerOpenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CircuitBreakerOpenError";
  }
}

class CircuitBreaker extends EventEmitter {
  private state: CircuitState;
  private failureCount: number;
  private successCount: number;
  private firstFailureTime: number;
  private lastFailureTime: number;
  private nextAttempt: number;
  private minAttempts: number;
  private minFailures: number;
  private readonly minEvaluationTime: number;
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
    this.minAttempts = options.minAttempts || 5;
    this.minFailures = options.minFailures || 3;
    this.minEvaluationTime = options.minEvaluationTime || 0;

    this.state = initialState?.state || CircuitState.CLOSED;
    this.failureCount = initialState?.failureCount || 0;
    this.successCount = initialState?.successCount || 0;
    this.firstFailureTime = initialState?.firstFailureTime || 0;
    this.lastFailureTime = initialState?.lastFailureTime || 0;
    this.nextAttempt = initialState?.nextAttempt || 0;
  }

  private resetState(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.firstFailureTime = 0;
    this.lastFailureTime = 0;
    this.nextAttempt = 0;
  }

  async execute<T>(
    fn: (...args: any[]) => Promise<T>,
    ...args: any[]
  ): Promise<T> {
    this.checkState();

    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttempt) {
        this.emit("openCircuit");
        throw new CircuitBreakerOpenError("Circuit is OPEN");
      }
    }

    try {
      const result = await fn(...args);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private checkState(): void {
    const now = Date.now();
    if (this.state === CircuitState.OPEN && now >= this.nextAttempt) {
      this.toHalfOpen();
    } else if (
      this.state === CircuitState.CLOSED &&
      this.firstFailureTime !== 0 &&
      now - this.firstFailureTime > this.timeWindow
    ) {
      this.resetState();
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
    const now = Date.now();
    this.failureCount++;
    this.lastFailureTime = now;

    if (this.state === CircuitState.CLOSED) {
      if (this.firstFailureTime === 0) {
        this.firstFailureTime = now;
      }
      if (this.isThresholdExceeded()) {
        this.toOpen();
      }
    } else if (this.state === CircuitState.HALF_OPEN) {
      this.toOpen();
    }

    this.emit("failure");
  }

  private isThresholdExceeded(): boolean {
    const now = Date.now();
    const totalAttempts = this.failureCount + this.successCount;
    const failureRate = this.failureCount / totalAttempts;
    const timeElapsed = now - this.firstFailureTime;

    return (
      this.failureCount >= this.minFailures &&
      failureRate >= this.failureThreshold &&
      totalAttempts >= this.minAttempts &&
      timeElapsed >= this.minEvaluationTime &&
      now < this.firstFailureTime + this.timeWindow
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
    this.resetState();
    this.emit("closeCircuit");
  }

  exportState(): CircuitBreakerState {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      firstFailureTime: this.firstFailureTime,
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
  CircuitBreakerOpenError,
};
