import { API_BOUNDARIES } from "@mis/config";

export const API_ENDPOINTS = {
  external: {
    me: `${API_BOUNDARIES.EXTERNAL}/me`,
    trainings: `${API_BOUNDARIES.EXTERNAL}/trainings`,
    attendance: `${API_BOUNDARIES.EXTERNAL}/attendance`,
    evaluations: `${API_BOUNDARIES.EXTERNAL}/evaluations`,
    certificates: `${API_BOUNDARIES.EXTERNAL}/certificates`,
  },
  internal: {
    accounts: `${API_BOUNDARIES.INTERNAL}/accounts`,
    trainings: `${API_BOUNDARIES.INTERNAL}/trainings`,
    quotations: `${API_BOUNDARIES.INTERNAL}/quotations`,
    invoices: `${API_BOUNDARIES.INTERNAL}/invoices`,
    reports: `${API_BOUNDARIES.INTERNAL}/reports`,
  },
} as const;
