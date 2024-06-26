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
exports.CircuitState = exports.CircuitBreaker = void 0;
const events_1 = __importDefault(require("events"));
var CircuitState;
(function (CircuitState) {
    CircuitState[CircuitState["CLOSED"] = 0] = "CLOSED";
    CircuitState[CircuitState["OPEN"] = 1] = "OPEN";
    CircuitState[CircuitState["HALF_OPEN"] = 2] = "HALF_OPEN";
})(CircuitState || (exports.CircuitState = CircuitState = {}));
class CircuitBreaker extends events_1.default {
    constructor(options, initialState) {
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
        }
        else {
            this.state = CircuitState.CLOSED;
            this.failureCount = 0;
            this.successCount = 0;
            this.lastFailureTime = 0;
            this.nextAttempt = 0;
        }
    }
    execute(fn) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.state === CircuitState.OPEN) {
                if (Date.now() < this.nextAttempt) {
                    this.emit("openCircuit");
                    throw new Error("Circuit is OPEN");
                }
                this.toHalfOpen();
            }
            try {
                const result = yield fn();
                this.onSuccess();
                return result;
            }
            catch (error) {
                this.onFailure();
                throw error;
            }
        });
    }
    onSuccess() {
        this.successCount++;
        if (this.state === CircuitState.HALF_OPEN) {
            this.toClose();
        }
        this.emit("success");
    }
    onFailure() {
        this.failureCount++;
        this.lastFailureTime = Date.now();
        if (this.state === CircuitState.CLOSED) {
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
        const totalAttempts = this.failureCount + this.successCount;
        const failureRate = this.failureCount / totalAttempts;
        return (failureRate >= this.failureThreshold &&
            totalAttempts >= 3 / this.failureThreshold &&
            Date.now() <= this.lastFailureTime + this.timeWindow);
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
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
        this.successCount = 0;
        this.lastFailureTime = 0;
        this.nextAttempt = 0;
        this.emit("closeCircuit");
    }
    exportState() {
        return {
            state: this.state,
            failureCount: this.failureCount,
            successCount: this.successCount,
            lastFailureTime: this.lastFailureTime,
            nextAttempt: this.nextAttempt,
        };
    }
}
exports.CircuitBreaker = CircuitBreaker;
//# sourceMappingURL=index.js.map