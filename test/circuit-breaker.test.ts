import { CircuitBreaker, CircuitBreakerOptions, CircuitState } from "../src";

describe("CircuitBreaker", () => {
  let circuitBreaker: CircuitBreaker;
  const options: CircuitBreakerOptions = {
    failureThreshold: 0.5,
    timeWindow: 10000,
    resetTimeout: 30000,
  };

  beforeEach(() => {
    circuitBreaker = new CircuitBreaker(options);
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("should execute successfully when circuit is closed", async () => {
    const mockFn = jest.fn().mockResolvedValue("success");
    const result = await circuitBreaker.execute(mockFn);
    expect(result).toBe("success");
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  test("should handle failure when circuit is closed", async () => {
    const mockFn = jest.fn().mockRejectedValue(new Error("fail"));
    await expect(circuitBreaker.execute(mockFn)).rejects.toThrow("fail");
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  test("should open circuit after failure threshold is exceeded", async () => {
    const mockFn = jest.fn().mockRejectedValue(new Error("fail"));
    const eventSpy = jest.spyOn(circuitBreaker, "emit");

    for (let i = 0; i < 6; i++) {
      await expect(circuitBreaker.execute(mockFn)).rejects.toThrow("fail");
    }

    expect(eventSpy).toHaveBeenCalledWith("openCircuit");
    expect(mockFn).toHaveBeenCalledTimes(6);
  });

  test("should reject calls when circuit is open", async () => {
    const mockFn = jest.fn().mockRejectedValue(new Error("fail"));

    // Open the circuit
    for (let i = 0; i < 6; i++) {
      await expect(circuitBreaker.execute(mockFn)).rejects.toThrow("fail");
    }

    expect(circuitBreaker.exportState().state).toBe(CircuitState.OPEN);

    await expect(circuitBreaker.execute(mockFn)).rejects.toThrow(
      "Circuit is OPEN"
    );
    expect(mockFn).toHaveBeenCalledTimes(6); // No additional call
  });

  test("should transition to half-open after reset timeout", async () => {
    const mockFn = jest.fn().mockRejectedValue(new Error("fail"));
    const eventSpy = jest.spyOn(circuitBreaker, "emit");

    // Open the circuit
    for (let i = 0; i < 6; i++) {
      await expect(circuitBreaker.execute(mockFn)).rejects.toThrow("fail");
    }

    // Fast-forward time
    jest.advanceTimersByTime(options.resetTimeout);

    // Circuit should now be half-open
    await expect(circuitBreaker.execute(mockFn)).rejects.toThrow("fail");
    expect(eventSpy).toHaveBeenCalledWith("halfOpen");
  });

  test("should close circuit after successful execution in half-open state", async () => {
    let mockFn = jest.fn().mockRejectedValue(new Error("fail"));

    const eventSpy = jest.spyOn(circuitBreaker, "emit");

    // Open the circuit
    for (let i = 0; i < 6; i++) {
      await expect(circuitBreaker.execute(mockFn)).rejects.toThrow("fail");
    }

    // Fast-forward time
    jest.advanceTimersByTime(options.resetTimeout);
    mockFn = jest.fn().mockResolvedValue("success");

    // Successful execution in half-open state
    const result = await circuitBreaker.execute(mockFn);
    expect(result).toBe("success");
    expect(eventSpy).toHaveBeenCalledWith("closeCircuit");
  });

  test("should re-open circuit after failure in half-open state", async () => {
    const mockFn = jest.fn().mockRejectedValue(new Error("fail"));
    const eventSpy = jest.spyOn(circuitBreaker, "emit");

    // Open the circuit
    for (let i = 0; i < 6; i++) {
      await expect(circuitBreaker.execute(mockFn)).rejects.toThrow("fail");
    }

    // Fast-forward time
    jest.advanceTimersByTime(options.resetTimeout);

    // Fail in half-open state
    await expect(circuitBreaker.execute(mockFn)).rejects.toThrow("fail");
    expect(eventSpy).toHaveBeenCalledWith("openCircuit");
  });

  test("should export and import state correctly", () => {
    const mockFn = jest.fn().mockRejectedValue(new Error("fail"));

    // Simulate some activity
    circuitBreaker.execute(mockFn).catch(() => {});
    circuitBreaker.execute(mockFn).catch(() => {});

    const exportedState = circuitBreaker.exportState();
    const newCircuitBreaker = new CircuitBreaker(options, exportedState);

    expect(newCircuitBreaker.exportState()).toEqual(exportedState);
  });

  test("should emit events correctly", async () => {
    const mockFn = jest
      .fn()
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValueOnce("success");
    const eventSpy = jest.spyOn(circuitBreaker, "emit");

    await expect(circuitBreaker.execute(mockFn)).rejects.toThrow("fail");
    expect(eventSpy).toHaveBeenCalledWith("failure");

    const result = await circuitBreaker.execute(mockFn);
    expect(result).toBe("success");
    expect(eventSpy).toHaveBeenCalledWith("success");
  });
});
