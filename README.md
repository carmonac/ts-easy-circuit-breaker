# ts-easy-circuit-breaker

A lightweight and easy-to-use Circuit Breaker implementation in TypeScript.

## Table of Contents

- [Installation](#installation)
- [Usage](#usage)
- [API](#api)
- [Configuration](#configuration)
- [Initial State and Serverless Environments](#initial-state-and-serverless-environments)
- [Events](#events)
- [Examples](#examples)
- [Contributing](#contributing)
- [License](#license)

## Installation

You can install the package using npm:

```bash
npm install ts-easy-circuit-breaker
```

Or using yarn:

```bash
yarn add ts-easy-circuit-breaker
```

## Usage

Here's a basic example of how to use the Circuit Breaker:

```typescript
import { CircuitBreaker } from "ts-easy-circuit-breaker";

const breaker = new CircuitBreaker({
  failureThreshold: 0.5,
  timeWindow: 10000,
  resetTimeout: 30000,
  minAttempts: 5,
  minFailures: 3,
});

async function makeHttpRequest() {
  // Your HTTP request logic here
}

try {
  const result = await breaker.execute(makeHttpRequest);
  console.log("Request successful:", result);
} catch (error) {
  if (error instanceof CircuitBreakerOpenError) {
    console.log("Circuit is open, request not made");
  } else {
    console.error("Request failed:", error);
  }
}
```

## API

### `CircuitBreaker`

The main class that implements the Circuit Breaker pattern.

#### Constructor

```typescript
new CircuitBreaker(options: CircuitBreakerOptions)
```

#### Methods

- `execute<T>(fn: (...args: any[]) => Promise<T>, ...args: any[]): Promise<T>`
  Executes the given function through the circuit breaker.

- `exportState(): CircuitBreakerState`
  Returns the current state of the circuit breaker.

### `CircuitBreakerOpenError`

An error class that is thrown when an execution is attempted while the circuit is open.

## Configuration

The `CircuitBreaker` constructor accepts an options object with the following properties:

- `failureThreshold`: The failure rate threshold above which the circuit should open. (0 to 1)
- `timeWindow`: The time window in milliseconds over which the failure threshold is calculated.
- `resetTimeout`: The time in milliseconds after which to attempt closing the circuit.
- `minAttempts`: (Optional) The minimum number of attempts before the failure threshold is considered. Default is 5.
- `minFailures`: (Optional) The minimum number of failures required to open the circuit, regardless of the failure rate. Default is 3.

## Initial State and Serverless Environments

The `CircuitBreaker` constructor also accepts an optional `initialState` parameter, which is particularly useful in serverless environments where the state needs to be persisted externally (e.g., in Redis) between function invocations.

Here's an example of how to use the `initialState`:

```typescript
import { CircuitBreaker, CircuitState } from "ts-easy-circuit-breaker";

// Assume this function retrieves the state from an external store (e.g., Redis)
async function getStateFromExternalStore() {
  // Implementation to fetch state from external store
}

// Assume this function saves the state to an external store
async function saveStateToExternalStore(state: CircuitBreakerState) {
  // Implementation to save state to external store
}

async function initializeCircuitBreaker() {
  const options = {
    failureThreshold: 0.5,
    timeWindow: 10000,
    resetTimeout: 30000,
    minAttempts: 5,
    minFailures: 3,
  };

  const savedState = await getStateFromExternalStore();

  const circuitBreaker = new CircuitBreaker(options, savedState);

  // Optionally, you can listen for state changes and save the new state
  circuitBreaker.on("stateChanged", async (newState) => {
    await saveStateToExternalStore(newState);
  });

  return circuitBreaker;
}

// Usage in a serverless function
export async function handler(event, context) {
  const circuitBreaker = await initializeCircuitBreaker();

  try {
    const result = await circuitBreaker.execute(async () => {
      // Your protected operation here
    });
    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (error) {
    if (error instanceof CircuitBreakerOpenError) {
      return { statusCode: 503, body: "Service temporarily unavailable" };
    }
    return { statusCode: 500, body: "Internal server error" };
  }
}
```

In this example, the Circuit Breaker's state is retrieved from an external store (like Redis) at the beginning of each serverless function invocation. This allows the Circuit Breaker to maintain its state across multiple invocations, which is crucial in serverless environments where the execution context is not preserved between invocations.

The `initialState` object should have the following structure:

```typescript
interface CircuitBreakerState {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  firstFailureTime: number;
  lastFailureTime: number;
  nextAttempt: number;
}
```

By using this approach, you can ensure that your Circuit Breaker behaves consistently in serverless environments, properly tracking failures and successes across multiple function invocations.

## Events

The Circuit Breaker emits the following events:

- `'openCircuit'`: Emitted when the circuit opens.
- `'closeCircuit'`: Emitted when the circuit closes.
- `'halfOpen'`: Emitted when the circuit transitions to the half-open state.
- `'success'`: Emitted on successful execution.
- `'failure'`: Emitted on failed execution.

You can listen to these events like this:

```typescript
breaker.on("openCircuit", () => {
  console.log("Circuit opened");
});
```

## Examples

### HTTP Request Wrapper with Minimum Failures

```typescript
import { CircuitBreaker } from "ts-easy-circuit-breaker";
import axios from "axios";

const breaker = new CircuitBreaker({
  failureThreshold: 0.5,
  timeWindow: 10000,
  resetTimeout: 30000,
  minAttempts: 10,
  minFailures: 5,
});

async function makeRequest(url: string) {
  return breaker.execute(async () => {
    const response = await axios.get(url);
    return response.data;
  });
}

// Usage
try {
  const data = await makeRequest("https://api.example.com/data");
  console.log(data);
} catch (error) {
  console.error("Request failed:", error);
}
```

In this example, the circuit will only open if there have been at least 5 failures, the failure rate is 50% or higher, and there have been at least 10 attempts within the 10-second time window.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License.
