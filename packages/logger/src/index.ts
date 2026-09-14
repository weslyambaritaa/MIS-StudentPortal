import pino from "pino";
export function createLogger(service: string) { return pino({ base: { service }, level: process.env.LOG_LEVEL ?? "info" }); }
