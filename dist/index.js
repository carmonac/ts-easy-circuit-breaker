"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CircuitBreakerOpenError = exports.CircuitState = exports.CircuitBreaker = void 0;
const events_1 = __importDefault(require("events"));
var CircuitState;
(function (CircuitState) {
    CircuitState[CircuitState["CLOSED"] = 0] = "CLOSED";
    CircuitState[CircuitState["OPEN"] = 1] = "OPEN";
    CircuitState[CircuitState["HALF_OPEN"] = 2] = "HALF_OPEN";
})(CircuitState || (exports.CircuitState = CircuitState = {}));
class CircuitBreakerOpenError extends Error {
    constructor(message) {
        super(message);
        this.name = "CircuitBreakerOpenError";
    }
}
exports.CircuitBreakerOpenError = CircuitBreakerOpenError;
class CircuitBreaker extends events_1.default {
    constructor(options, initialState) {
        super();
        this.failureThreshold = options.failureThreshold;
        this.timeWindow = options.timeWindow;
        this.resetTimeout = options.resetTimeout;
        this.minAttempts = options.minAttempts || 5;
        this.minFailures = options.minFailures || 3;
        this.minEvaluationTime = options.minEvaluationTime || 0;
        this.state = (initialState === null || initialState === void 0 ? void 0 : initialState.state) || CircuitState.CLOSED;
        this.failureCount = (initialState === null || initialState === void 0 ? void 0 : initialState.failureCount) || 0;
        this.successCount = (initialState === null || initialState === void 0 ? void 0 : initialState.successCount) || 0;
        this.firstFailureTime = (initialState === null || initialState === void 0 ? void 0 : initialState.firstFailureTime) || 0;
        this.lastFailureTime = (initialState === null || initialState === void 0 ? void 0 : initialState.lastFailureTime) || 0;
        this.nextAttempt = (initialState === null || initialState === void 0 ? void 0 : initialState.nextAttempt) || 0;
    }
    resetState() {
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
        this.successCount = 0;
        this.firstFailureTime = 0;
        this.lastFailureTime = 0;
        this.nextAttempt = 0;
    }
    execute(fn, ...args) {
        return __awaiter(this, void 0, void 0, function* () {
            this.checkState();
            if (this.state === CircuitState.OPEN) {
                if (Date.now() < this.nextAttempt) {
                    this.emit("openCircuit");
                    throw new CircuitBreakerOpenError("Circuit is OPEN");
                }
            }
            try {
                const result = yield fn(...args);
                this.onSuccess();
                return result;
            }
            catch (error) {
                this.onFailure();
                throw error;
            }
        });
    }
    checkState() {
        const now = Date.now();
        if (this.state === CircuitState.OPEN && now >= this.nextAttempt) {
            this.toHalfOpen();
        }
        else if (this.state === CircuitState.CLOSED &&
            this.firstFailureTime !== 0 &&
            now - this.firstFailureTime > this.timeWindow) {
            this.resetState();
        }
        if (this.successCount === Number.MAX_SAFE_INTEGER ||
            this.failureCount === Number.MAX_SAFE_INTEGER) {
            this.resetState();
        }
    }
    onSuccess() {
        this.successCount++;
        if (this.state === CircuitState.HALF_OPEN) {
            this.toClose();
        }
        this.emit("success");
    }
    onFailure() {
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
        }
        else if (this.state === CircuitState.HALF_OPEN) {
            this.toOpen();
        }
        this.emit("failure");
    }
    isThresholdExceeded() {
        const now = Date.now();
        const totalAttempts = this.failureCount + this.successCount;
        const failureRate = this.failureCount / totalAttempts;
        const timeElapsed = now - this.firstFailureTime;
        return (this.failureCount >= this.minFailures &&
            failureRate >= this.failureThreshold &&
            totalAttempts >= this.minAttempts &&
            timeElapsed >= this.minEvaluationTime &&
            now < this.firstFailureTime + this.timeWindow);
    }
    toOpen() {
        this.state = CircuitState.OPEN;
        this.nextAttempt = Date.now() + this.resetTimeout;
        this.emit("openCircuit");
    }
    toHalfOpen() {
        this.state = CircuitState.HALF_OPEN;
        this.failureCount = 0;
        this.successCount = 0;
        this.emit("halfOpen");
    }
    toClose() {
        this.resetState();
        this.emit("closeCircuit");
    }
    exportState() {
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
exports.CircuitBreaker = CircuitBreaker;
//# sourceMappingURL=index.js.map