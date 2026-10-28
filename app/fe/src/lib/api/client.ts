import { createApiClient } from "@mis/api-client";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://api.localhost:4000";

export const apiRequest = createApiClient(API_BASE_URL);