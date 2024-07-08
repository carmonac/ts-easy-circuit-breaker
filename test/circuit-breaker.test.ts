import {
  CircuitBreaker,
  CircuitState,
  CircuitBreakerOpenError,
} from "../src/index";

jest.useFakeTimers();

describe("CircuitBreaker", () => {
  let circuitBreaker: CircuitBreaker;
  const mockSuccessfulOperation = jest.fn().mockResolvedValue("success");
  const mockFailedOperation = jest.fn().mockRejectedValue(new Error("failure"));

  beforeEach(() => {
    jest.clearAllTimers();
    circuitBreaker = new CircuitBreaker({
      failureThreshold: 0.5,
      timeWindow: 10000,
      resetTimeout: 30000,
      minAttempts: 5,
    });
  });

  test("should execute successful operation", async () => {
    const result = await circuitBreaker.execute(mockSuccessfulOperation);
    expect(result).toBe("success");
    expect(circuitBreaker.exportState().state).toBe(CircuitState.CLOSED);
  });

  test("should handle failed operation", async () => {
    await expect(circuitBreaker.execute(mockFailedOperation)).rejects.toThrow(
      "failure"
    );
    expect(circuitBreaker.exportState().state).toBe(CircuitState.CLOSED);
  });

  test("should open circuit after threshold is exceeded", async () => {
    for (let i = 0; i < 5; i++) {
      await expect(circuitBreaker.execute(mockFailedOperation)).rejects.toThrow(
        "failure"
      );
    }
    expect(circuitBreaker.exportState().state).toBe(CircuitState.OPEN);
  });

  test("should throw CircuitBreakerOpenError when circuit is open", async () => {
    for (let i = 0; i < 5; i++) {
      await expect(circuitBreaker.execute(mockFailedOperation)).rejects.toThrow(
        "failure"
      );
    }
    await expect(
      circuitBreaker.execute(mockSuccessfulOperation)
    ).rejects.toThrow(CircuitBreakerOpenError);
  });

  test("should transition to half-open state after reset timeout", async () => {
    for (let i = 0; i < 5; i++) {
      await expect(circuitBreaker.execute(mockFailedOperation)).rejects.toThrow(
        "failure"
      );
    }

    expect(circuitBreaker.exportState().state).toBe(CircuitState.OPEN);

    jest.advanceTimersByTime(30000);

    await expect(circuitBreaker.execute(mockSuccessfulOperation)).resolves.toBe(
      "success"
    );

    expect(circuitBreaker.exportState().state).toBe(CircuitState.CLOSED);
  });

  test("should close circuit after successful execution in half-open state", async () => {
    for (let i = 0; i < 5; i++) {
      await expect(circuitBreaker.execute(mockFailedOperation)).rejects.toThrow(
        "failure"
      );
    }

    jest.advanceTimersByTime(30000);

    await circuitBreaker.execute(mockSuccessfulOperation);
    expect(circuitBreaker.exportState().state).toBe(CircuitState.CLOSED);
  });

  test("should open circuit immediately after failure in half-open state", async () => {
    for (let i = 0; i < 5; i++) {
      await expect(circuitBreaker.execute(mockFailedOperation)).rejects.toThrow(
        "failure"
      );
    }

    jest.advanceTimersByTime(30000);

    // Ahora está en estado HALF_OPEN
    await expect(circuitBreaker.execute(mockFailedOperation)).rejects.toThrow(
      "failure"
    );
    expect(circuitBreaker.exportState().state).toBe(CircuitState.OPEN);
  });

  test("should reset failure count after time window", async () => {
    for (let i = 0; i < 4; i++) {
      await expect(circuitBreaker.execute(mockFailedOperation)).rejects.toThrow(
        "failure"
      );
    }

    expect(circuitBreaker.exportState().failureCount).toBe(4);

    jest.advanceTimersByTime(10001); // Avanzamos un poco más que el timeWindow

    await expect(circuitBreaker.execute(mockFailedOperation)).rejects.toThrow(
      "failure"
    );

    expect(circuitBreaker.exportState().state).toBe(CircuitState.CLOSED);
    expect(circuitBreaker.exportState().failureCount).toBe(1);
  });

  test("should respect minAttempts before opening circuit", async () => {
    for (let i = 0; i < 4; i++) {
      await expect(circuitBreaker.execute(mockFailedOperation)).rejects.toThrow(
        "failure"
      );
    }
    expect(circuitBreaker.exportState().state).toBe(CircuitState.CLOSED);

    await expect(circuitBreaker.execute(mockFailedOperation)).rejects.toThrow(
      "failure"
    );
    expect(circuitBreaker.exportState().state).toBe(CircuitState.OPEN);
  });

  test("should emit events on state changes", async () => {
    const openCircuitMock = jest.fn();
    const halfOpenMock = jest.fn();
    const closeCircuitMock = jest.fn();

    circuitBreaker.on("openCircuit", openCircuitMock);
    circuitBreaker.on("halfOpen", halfOpenMock);
    circuitBreaker.on("closeCircuit", closeCircuitMock);

    for (let i = 0; i < 5; i++) {
      await expect(circuitBreaker.execute(mockFailedOperation)).rejects.toThrow(
        "failure"
      );
    }
    expect(openCircuitMock).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(30000);
    await circuitBreaker.execute(mockSuccessfulOperation);
    expect(halfOpenMock).toHaveBeenCalledTimes(1);
    expect(closeCircuitMock).toHaveBeenCalledTimes(1);
  });
});
