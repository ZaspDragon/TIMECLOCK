// ✅ CONFIG (Website)
// 1) Deploy Apps Script Web App (see README.html)
// 2) Paste the /exec URL below
// 3) Set your PIN settings (must match Apps Script CONFIG)

export const CONFIG = {
  // Paste your Apps Script Web App URL (ends with /exec)
  APPS_SCRIPT_URL:  https://script.google.com/macros/library/d/1jFpnPE9Npx1tySggL8GfgK5e4oqQX1OCv9qf4Rz-768IUYwrbDrUiyAe/1


  // --- PIN Rotation ---
  // Choose: "daily" or "weekly"
  PIN_MODE: "weekly",

  // Base secret used to generate the rotating company PIN (keep private)
  // The actual PIN employees type changes automatically.
  // Example weekly PIN: SIDEHUSTLE-2026W05
  BASE_PIN_SECRET: "1234",

  // Manager code to unlock manager dashboard + view current PIN
  MANAGER_CODE: "MANAGER2026!",

  // Force Eastern Time
  TIMEZONE: "America/New_York"
};
