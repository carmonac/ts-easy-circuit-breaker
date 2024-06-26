# TS Easy Circuit Breaker

A Circuit Breaker implementation in TypeScript that helps manage service resilience by handling failures and avoiding system overload.

## Features

- **Circuit Breaker States**: `CLOSED`, `OPEN`, `HALF_OPEN`
- **Configuration**: Allows adjusting the failure threshold, time window, and reset timeout.
- **Events**: Emits events on state changes and when recording successes or failures.
- **Stateless Environment Support**: Can initialize with the state from another Circuit Breaker instance.

## Logic

- **State Initialization**: The Circuit Breaker can be initialized with the state from a previous Circuit Breaker. This is crucial for AWS Lambda environments where the state needs to be shared across multiple instances simultaneously. (This implementation omits the Redis part for state sharing.)
- **State Export**: The Circuit Breaker has a method called exportState that exports all necessary parameters to recreate the Circuit Breaker in another instance.
- **Time Window Management**: Upon receiving the first error, the Circuit Breaker starts a time window (defined by timeWindow).
- **Counting Attempts and Failures**: While the time window is open, the Circuit Breaker counts the number of attempts and failures.
- **Failure Threshold Calculation**: After the time window expires, the Circuit Breaker calculates the percentage of errors. If this percentage exceeds the predefined threshold (failureThreshold), the circuit opens.
- **Open State and Reset Timeout**: When the circuit is open, it remains in this state for a specified period (resetTimeout). During this time, the function to be executed is not run.
- **Transition to Half-Open State**: After the resetTimeout period, the circuit transitions to a half-open state. In this state:
  - If the next function execution succeeds without errors, the circuit closes, resetting the process and waiting for a new error to reopen the time window.
  - If the next function execution fails, the circuit reopens and waits for the resetTimeout period again.
- **Event Emission**: The Circuit Breaker emits events for each state change or action, including failure, half open, success, open circuit, close circuit, etc. This allows for monitoring and reacting to state changes.

## Installation

First, make sure you have Node.js installed. Then, install the dependencies:

```bash
npm install ts-easy-circuit-breaker
```

## Usage

### Import and Configure

```typescript
import {
  CircuitBreaker,
  CircuitBreakerOptions,
  CircuitBreakerState,
  CircuitState,
} from "./CircuitBreaker";

const options: CircuitBreakerOptions = {
  failureThreshold: 0.5, // Failure threshold
  timeWindow: 60000, // Time window in milliseconds (60 seconds)
  resetTimeout: 30000, // Reset timeout in milliseconds (30 seconds)
};

const cb = new CircuitBreaker(options);
```

### Execute Functions with the Circuit Breaker

```typescript
const testFunction = async () => {
  // Simulate a function that might fail
  if (Math.random() > 0.5) {
    throw new Error("Test error");
  }
  return "Success";
};

cb.execute(testFunction)
  .then((result) => console.log(result))
  .catch((error) => console.error(error.message));
```

### Handle Events

```typescript
cb.on("success", () => console.log("Successful execution"));
cb.on("failure", () => console.log("Failed execution"));
cb.on("openCircuit", () => console.log("Circuit is open"));
cb.on("halfOpen", () => console.log("Circuit is half-open"));
cb.on("closeCircuit", () => console.log("Circuit is closed"));
```

### Export the Circuit Breaker State

```typescript
const state = cb.exportState();
console.log(state);
```

### Using in Stateless Environment

You can initialize the Circuit Breaker with the state from another instance, which is useful in stateless environments:

```typescript
const initialState: CircuitBreakerState = {
  state: CircuitState.CLOSED,
  failureCount: 0,
  successCount: 0,
  lastFailureTime: 0,
  nextAttempt: 0,
};

const cbWithState = new CircuitBreaker(options, initialState);
```

## Tests

The project uses Jest for testing. You can run the tests with the following command:

```bash
npm test
```

## Contributing

1. Fork the project.
2. Create a new branch (`git checkout -b feature-xyz`).
3. Make your changes and commit them (`git commit -am 'Add new feature'`).
4. Push your branch (`git push origin feature-xyz`).
5. Open a Pull Request.
