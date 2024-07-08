import EventEmitter from "events";
declare enum CircuitState {
    CLOSED = 0,
    OPEN = 1,
    HALF_OPEN = 2
}
interface CircuitBreakerOptions {
    failureThreshold: number;
    timeWindow: number;
    resetTimeout: number;
    minAttempts?: number;
    minFailures?: number;
}
interface CircuitBreakerState {
    state: CircuitState;
    failureCount: number;
    successCount: number;
    firstFailureTime: number;
    lastFailureTime: number;
    nextAttempt: number;
}
declare class CircuitBreakerOpenError extends Error {
    constructor(message: string);
}
declare class CircuitBreaker extends EventEmitter {
    private state;
    private failureCount;
    private successCount;
    private firstFailureTime;
    private lastFailureTime;
    private nextAttempt;
    private minAttempts;
    private minFailures;
    private readonly failureThreshold;
    private readonly timeWindow;
    private readonly resetTimeout;
    constructor(options: CircuitBreakerOptions, initialState?: CircuitBreakerState);
    private resetState;
    execute<T>(fn: (...args: any[]) => Promise<T>, ...args: any[]): Promise<T>;
    private checkState;
    private onSuccess;
    private onFailure;
    private isThresholdExceeded;
    private toOpen;
    private toHalfOpen;
    private toClose;
    exportState(): CircuitBreakerState;
}
export { CircuitBreaker, CircuitBreakerOptions, CircuitBreakerState, CircuitState, CircuitBreakerOpenError, };
