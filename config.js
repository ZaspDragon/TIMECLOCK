// ✅ CONFIG (Website)
// 1) Deploy Apps Script Web App (see README.html)
// 2) Paste the /exec URL below
// 3) Set your PIN settings (must match Apps Script CONFIG)

export const CONFIG = {
  // Paste your Apps Script Web App URL (ends with /exec)
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbxfCGA7y44H0mrJlmuGRhJACsbrjomtnFcwf17OX1U95cb-a8BQ5_jttDXCCpaRwCKCXQ/exec",

  // --- PIN Rotation ---
  // Choose: "daily" or "weekly"
  PIN_MODE: "weekly",

  // Base secret used to generate the rotating company PIN (keep private)
  BASE_PIN_SECRET: "SIDEHUSTLE123",

  // Manager code to unlock manager dashboard + view current PIN
  MANAGER_CODE: "MANAGER2026!",

  // Force Eastern Time
  TIMEZONE: "America/New_York"
};
