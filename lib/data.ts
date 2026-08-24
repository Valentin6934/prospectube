/** Product capabilities retained here for API compatibility. No demo prospects live in this module. */
export const PLAN_LIMITS = {
  Gratuit: { searches: 3, results: 20, emailAI: false, exportCSV: false },
  Pro: { searches: 5, results: 20, emailAI: true, exportCSV: true },
} as const
