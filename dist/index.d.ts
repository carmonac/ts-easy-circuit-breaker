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
}
interface CircuitBreakerState {
    state: CircuitState;
    failureCount: number;
    successCount: number;
    lastFailureTime: number;
    nextAttempt: number;
}
declare class CircuitBreaker extends EventEmitter {
    private state;
    private failureCount;
    private successCount;
    private lastFailureTime;
    private nextAttempt;
    private readonly failureThreshold;
    private readonly timeWindow;
    private readonly resetTimeout;
    constructor(options: CircuitBreakerOptions, initialState?: CircuitBreakerState);
    execute<T>(fn: () => Promise<T>): Promise<T>;
    private onSuccess;
    private onFailure;
    private isThresholdExceeded;
    private toOpen;
    private toHalfOpen;
    private toClose;
    exportState(): CircuitBreakerState;
}
export { CircuitBreaker, CircuitBreakerOptions, CircuitBreakerState, CircuitState, };
