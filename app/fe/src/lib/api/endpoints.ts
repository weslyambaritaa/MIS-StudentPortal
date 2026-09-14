export const API_ENDPOINTS = {
  external: {
    me: "/api/v1/external/me",
    trainings: "/api/v1/external/trainings",
    attendance: "/api/v1/external/attendance",
    evaluations: "/api/v1/external/evaluations",
    certificates: "/api/v1/external/certificates",
  },
  internal: {
    accounts: "/api/v1/internal/accounts",
    trainings: "/api/v1/internal/trainings",
    quotations: "/api/v1/internal/quotations",
    invoices: "/api/v1/internal/invoices",
    reports: "/api/v1/internal/reports",
  },
} as const;
