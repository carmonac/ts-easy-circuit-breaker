import http from "http";
import { CircuitBreaker, CircuitBreakerOptions } from "./src/index";
import axios from "axios";

const circuitBreakerOptions: CircuitBreakerOptions = {
  failureThreshold: 0.5,
  timeWindow: 10000,
  resetTimeout: 30000,
};

const circuitBreaker = new CircuitBreaker(circuitBreakerOptions);

const server = http.createServer(async (req, res) => {
  if (req.method === "POST" && req.url === "/call") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });

    req.on("end", async () => {
      try {
        const { url } = JSON.parse(body);
        const result = await circuitBreaker.execute(async () => {
          const response = await axios.get(url);
          return response.data;
        });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
      } catch (error: any) {
        if (error.message === "Circuit is OPEN") {
          res.writeHead(503, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Service Unavailable" }));
        } else {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: error.message }));
        }
      } finally {
        console.log(circuitBreaker.exportState());
      }
    });
  } else {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not Found" }));
  }
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
