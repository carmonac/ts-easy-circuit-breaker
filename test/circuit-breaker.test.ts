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

  describe("Normal operation", () => {
    beforeEach(() => {
      jest.clearAllTimers();
      circuitBreaker = new CircuitBreaker({
        failureThreshold: 0.5,
        timeWindow: 10000,
        resetTimeout: 30000,
        minAttempts: 5,
        maxFailureCount: 10,
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
        await expect(
          circuitBreaker.execute(mockFailedOperation)
        ).rejects.toThrow("failure");
      }
      expect(circuitBreaker.exportState().state).toBe(CircuitState.OPEN);
    });

    test("should throw CircuitBreakerOpenError when circuit is open", async () => {
      for (let i = 0; i < 5; i++) {
        await expect(
          circuitBreaker.execute(mockFailedOperation)
        ).rejects.toThrow("failure");
      }
      await expect(
        circuitBreaker.execute(mockSuccessfulOperation)
      ).rejects.toThrow(CircuitBreakerOpenError);
    });

    test("should transition to half-open state after reset timeout", async () => {
      for (let i = 0; i < 5; i++) {
        await expect(
          circuitBreaker.execute(mockFailedOperation)
        ).rejects.toThrow("failure");
      }

      expect(circuitBreaker.exportState().state).toBe(CircuitState.OPEN);

      jest.advanceTimersByTime(30000);

      await expect(
        circuitBreaker.execute(mockSuccessfulOperation)
      ).resolves.toBe("success");

      expect(circuitBreaker.exportState().state).toBe(CircuitState.CLOSED);
    });

    test("should close circuit after successful execution in half-open state", async () => {
      for (let i = 0; i < 5; i++) {
        await expect(
          circuitBreaker.execute(mockFailedOperation)
        ).rejects.toThrow("failure");
      }

      jest.advanceTimersByTime(30000);

      await circuitBreaker.execute(mockSuccessfulOperation);
      expect(circuitBreaker.exportState().state).toBe(CircuitState.CLOSED);
    });

    test("should open circuit immediately after failure in half-open state", async () => {
      for (let i = 0; i < 5; i++) {
        await expect(
          circuitBreaker.execute(mockFailedOperation)
        ).rejects.toThrow("failure");
      }

      jest.advanceTimersByTime(30000);

      await expect(circuitBreaker.execute(mockFailedOperation)).rejects.toThrow(
        "failure"
      );
      expect(circuitBreaker.exportState().state).toBe(CircuitState.OPEN);
    });

    test("should reset failure count after time window", async () => {
      for (let i = 0; i < 4; i++) {
        await expect(
          circuitBreaker.execute(mockFailedOperation)
        ).rejects.toThrow("failure");
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
        await expect(
          circuitBreaker.execute(mockFailedOperation)
        ).rejects.toThrow("failure");
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
        await expect(
          circuitBreaker.execute(mockFailedOperation)
        ).rejects.toThrow("failure");
      }
      expect(openCircuitMock).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(30000);
      await circuitBreaker.execute(mockSuccessfulOperation);
      expect(halfOpenMock).toHaveBeenCalledTimes(1);
      expect(closeCircuitMock).toHaveBeenCalledTimes(1);
    });

    test("should respect maxFailureCount", async () => {
      let failureCount = 0;
      let openCircuitThrown = false;

      while (failureCount < 10 && !openCircuitThrown) {
        try {
          await circuitBreaker.execute(mockFailedOperation);
          failureCount++;
        } catch (error) {
          if (error instanceof CircuitBreakerOpenError) {
            openCircuitThrown = true;
          } else {
            failureCount++;
          }
        }
      }

      expect(openCircuitThrown).toBe(true);
      expect(circuitBreaker.exportState().state).toBe(CircuitState.OPEN);

      await expect(circuitBreaker.execute(mockFailedOperation)).rejects.toThrow(
        CircuitBreakerOpenError
      );
    });

    test("should return correct state with getState method", async () => {
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);

      for (let i = 0; i < 5; i++) {
        await expect(
          circuitBreaker.execute(mockFailedOperation)
        ).rejects.toThrow("failure");
      }
      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);

      jest.advanceTimersByTime(30000);

      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);

      await expect(
        circuitBreaker.execute(mockSuccessfulOperation)
      ).resolves.toBe("success");
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
    });
  });

  describe("minFailures option", () => {
    beforeEach(() => {
      jest.setSystemTime(new Date("2023-01-01T00:00:00Z"));
      circuitBreaker = new CircuitBreaker({
        failureThreshold: 0.5,
        timeWindow: 10000,
        resetTimeout: 30000,
        minAttempts: 5,
        minFailures: 3,
      });
    });

    test("should not open circuit if minFailures is not reached", async () => {
      // 2 failures and 3 successes, failure rate is 40% which is below threshold
      await expect(circuitBreaker.execute(mockFailedOperation)).rejects.toThrow(
        "failure"
      );
      await expect(circuitBreaker.execute(mockFailedOperation)).rejects.toThrow(
        "failure"
      );
      await circuitBreaker.execute(mockSuccessfulOperation);
      await circuitBreaker.execute(mockSuccessfulOperation);
      await circuitBreaker.execute(mockSuccessfulOperation);

      expect(circuitBreaker.exportState().state).toBe(CircuitState.CLOSED);
    });

    test("should open circuit when minFailures is reached", async () => {
      for (let i = 0; i < 3; i++) {
        await expect(
          circuitBreaker.execute(mockFailedOperation)
        ).rejects.toThrow("failure");
        console.log(`After failure ${i + 1}:`, circuitBreaker.exportState());
      }
      for (let i = 0; i < 2; i++) {
        await circuitBreaker.execute(mockSuccessfulOperation);
        console.log(`After success ${i + 1}:`, circuitBreaker.exportState());
      }

      await expect(circuitBreaker.execute(mockFailedOperation)).rejects.toThrow(
        "failure"
      );
      console.log("Final state:", circuitBreaker.exportState());

      expect(circuitBreaker.exportState().state).toBe(CircuitState.OPEN);
    });
  });

  describe("minEvaluationTime option", () => {
    beforeEach(() => {
      jest.setSystemTime(new Date("2023-01-01T00:00:00Z"));
      circuitBreaker = new CircuitBreaker({
        failureThreshold: 0.5,
        timeWindow: 10000,
        resetTimeout: 30000,
        minAttempts: 5,
        minFailures: 3,
        minEvaluationTime: 1,
      });
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test("should not open circuit before minEvaluationTime", async () => {
      // 3 failures and 2 successes within 4 seconds
      const startTime = Date.now();
      jest.setSystemTime(startTime);

      await expect(circuitBreaker.execute(mockFailedOperation)).rejects.toThrow(
        "failure"
      );
      jest.advanceTimersByTime(1000);
      await expect(circuitBreaker.execute(mockFailedOperation)).rejects.toThrow(
        "failure"
      );
      jest.advanceTimersByTime(1000);
      await expect(circuitBreaker.execute(mockFailedOperation)).rejects.toThrow(
        "failure"
      );
      jest.advanceTimersByTime(1000);
      await circuitBreaker.execute(mockSuccessfulOperation);
      jest.advanceTimersByTime(1000);
      await circuitBreaker.execute(mockSuccessfulOperation);

      expect(circuitBreaker.exportState().state).toBe(CircuitState.CLOSED);
    });

    test("should open circuit after minEvaluationTime", async () => {
      for (let i = 0; i < 3; i++) {
        await expect(
          circuitBreaker.execute(mockFailedOperation)
        ).rejects.toThrow("failure");
        jest.advanceTimersByTime(2000);
      }

      for (let i = 0; i < 2; i++) {
        await circuitBreaker.execute(mockSuccessfulOperation);
        jest.advanceTimersByTime(1000);
      }

      jest.advanceTimersByTime(1000);

      await expect(circuitBreaker.execute(mockFailedOperation)).rejects.toThrow(
        "failure"
      );

      const endTime = Date.now();

      expect(circuitBreaker.exportState().state).toBe(CircuitState.OPEN);
    });
  });
});
