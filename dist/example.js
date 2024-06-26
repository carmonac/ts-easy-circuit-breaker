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
const http_1 = __importDefault(require("http"));
const index_1 = require("./index");
const axios_1 = __importDefault(require("axios"));
const circuitBreakerOptions = {
    failureThreshold: 0.5,
    timeWindow: 10000,
    resetTimeout: 30000,
};
const circuitBreaker = new index_1.CircuitBreaker(circuitBreakerOptions);
const server = http_1.default.createServer((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (req.method === "POST" && req.url === "/call") {
        let body = "";
        req.on("data", (chunk) => {
            body += chunk.toString();
        });
        req.on("end", () => __awaiter(void 0, void 0, void 0, function* () {
            try {
                const { url } = JSON.parse(body);
                const result = yield circuitBreaker.execute(() => __awaiter(void 0, void 0, void 0, function* () {
                    const response = yield axios_1.default.get(url);
                    return response.data;
                }));
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify(result));
            }
            catch (error) {
                if (error.message === "Circuit is OPEN") {
                    res.writeHead(503, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ error: "Service Unavailable" }));
                }
                else {
                    res.writeHead(500, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ error: error.message }));
                }
            }
        }));
    }
    else {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Not Found" }));
    }
}));
const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
//# sourceMappingURL=example.js.map