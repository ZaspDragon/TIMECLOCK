// ============================================
// TIME CLOCK BACKEND (ONE SHEET) — COMPAT MODE
// Works with v3 frontend that sends:
//  - action:"stamp", field:"clockIn|lunchOut|endLunch|clockOut", estDate, estTime
//  - action:"query", pin, name, company, from, to
// Also supports newer style:
//  - type:"stamp" + action:"clockIn|..."
//  - type:"employeeQuery" / type:"managerQuery"
// ============================================

const TIMEZONE = "America/New_York";

// OPTIONAL: If you want to REQUIRE a company PIN, set it here.
// If you want NO pin requirement, leave it as empty string "".
const COMPANY_PIN = ""; // e.g. "SIDEHUSTLE123" OR "" (no pin check)

// OPTIONAL: Manager code (used for managerQuery)
const MANAGER_CODE = "MANAGER2026!"; // change this

const SHEET_LOGS = "TimeLogs";
const SHEET_APPROVED = "ApprovedEmployees";

function doGet() {
  return output({ ok: true, message: "TimeClock backend running" });
}

function doPost(e) {
  try {
    const data = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    const logs = ss.getSheetByName(SHEET_LOGS);
    const approved = ss.getSheetByName(SHEET_APPROVED);

    if (!logs || !approved) {
      return output({
        ok: false,
        error: `Required sheets not found. Need tabs: ${SHEET_LOGS} and ${SHEET_APPROVED}`,
      });
    }

    // ---- Accept BOTH API styles ----
    // v3 style: data.action = "stamp" | "query" | "getPin"
    // newer:    data.type  = "stamp" | "employeeQuery" | "managerQuery"
    const kind = String(data.action || data.type || "").trim();

    if (kind === "getPin") return output(handleGetPin(data));
    if (kind === "stamp") return output(handleStampCompat(data, logs, approved));
    if (kind === "query") return output(handleQueryCompat(data, logs, approved));

    if (kind === "employeeQuery") return output(handleEmployeeQuery(data, logs, approved));
    if (kind === "managerQuery") return output(handleManagerQuery(data, logs));

    return output({ ok: false, error: "Unknown action/type" });
  } catch (err) {
    return output({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

// -------------------- PIN CHECK (optional) --------------------
function checkCompanyPin(pin) {
  // No requirement if COMPANY_PIN is empty
  if (!COMPANY_PIN) return { ok: true };
  if (String(pin || "").trim() !== COMPANY_PIN) return { ok: false, error: "Invalid company PIN" };
  return { ok: true };
}

// -------------------- STAMP (v3 compat) --------------------
function handleStampCompat(data, logs, approved) {
  const name = String(data.name || "").trim();
  const company = String(data.company || "").trim();

  // v3 frontend sends field; newer sends action="clockIn" etc.
  const field = String(data.field || data.action || "").trim(); // "clockIn" etc.
  const pin = String(data.pin || "").trim();

  if (!name || !company) return { ok: false, error: "Missing name or company" };

  const pinCheck = checkCompanyPin(pin);
  if (!pinCheck.ok) return pinCheck;

  if (!isApproved(approved, name, company)) {
    return { ok: false, error: "Employee not approved" };
  }

  // v3 sends estDate/estTime; we’ll trust those, but also compute safely if missing
  const now = new Date();
  const estDate = String(data.estDate || Utilities.formatDate(now, TIMEZONE, "yyyy-MM-dd")).trim();
  const estTime = String(data.estTime || Utilities.formatDate(now, TIMEZONE, "HH:mm:ss")).trim();
  const dayStr = dayNameFromISO(estDate);
  const updatedStr = Utilities.formatDate(now, TIMEZONE, "yyyy-MM-dd HH:mm:ss");

  const colMap = { clockIn: 5, lunchOut: 6, endLunch: 7, clockOut: 8 };
  if (!colMap[field]) return { ok: false, error: "Invalid field/action" };

  let row = findRow(logs, name, company, estDate);

  if (!row) {
    logs.appendRow([estDate, dayStr, name, company, "", "", "", "", updatedStr]);
    row = logs.getLastRow();
  }

  const cell = logs.getRange(row, colMap[field]);
  if (cell.getValue()) {
    return { ok: true, note: "Already stamped", field, time: cell.getValue() };
  }

  cell.setValue(estTime);
  logs.getRange(row, 9).setValue(updatedStr);

  return { ok: true, note: "Saved", field, time: estTime };
}

// -------------------- QUERY (v3 compat) --------------------
function handleQueryCompat(data, logs, approved) {
  const pin = String(data.pin || "").trim();

  // Manager query if managerCode present
  const managerCode = String(data.managerCode || "").trim();
  if (managerCode) {
    if (managerCode !== MANAGER_CODE) return { ok: false, error: "Invalid manager code" };
    const from = String(data.from || "").trim();
    const to = String(data.to || "").trim();
    if (!from || !to) return { ok: false, error: "Missing date range (from/to)" };

    const rows = getLogRows(logs, (r) => r.estDate >= from && r.estDate <= to);
    return { ok: true, rows };
  }

  // Employee query
  const name = String(data.name || "").trim();
  const company = String(data.company || "").trim();
  const from = String(data.from || "").trim();
  const to = String(data.to || "").trim();

  if (!name || !company) return { ok: false, error: "Missing name or company" };

  const pinCheck = checkCompanyPin(pin);
  if (!pinCheck.ok) return pinCheck;

  if (!isApproved(approved, name, company)) {
    return { ok: false, error: "Employee not approved" };
  }

  if (!from || !to) return { ok: false, error: "Missing date range (from/to)" };

  const rows = getLogRows(logs, (r) =>
    r.estDate >= from && r.estDate <= to &&
    r.name === name &&
    r.company === company
  );

  return { ok: true, rows };
}

// -------------------- NEWER STYLE (optional) --------------------
function handleEmployeeQuery(data, logs, approved) {
  // identical to queryCompat employee branch
  return handleQueryCompat(
    { action: "query", pin: data.pin, name: data.name, company: data.company, from: data.from, to: data.to },
    logs,
    approved
  );
}

function handleManagerQuery(data, logs) {
  const managerCode = String(data.managerCode || "").trim();
  if (managerCode !== MANAGER_CODE) return { ok: false, error: "Invalid manager code" };

  const from = String(data.from || "").trim();
  const to = String(data.to || "").trim();
  if (!from || !to) return { ok: false, error: "Missing date range (from/to)" };

  const companyFilter = String(data.company || "").trim();

  const rows = getLogRows(logs, (r) => {
    const inRange = r.estDate >= from && r.estDate <= to;
    const companyOk = !companyFilter || r.company === companyFilter;
    return inRange && companyOk;
  });

  return { ok: true, rows };
}

function handleGetPin(data) {
  // If you’re not requiring PINs, just return empty
  if (!COMPANY_PIN) return { ok: true, pin: "" };

  const managerCode = String(data.managerCode || "").trim();
  if (managerCode !== MANAGER_CODE) return { ok: false, error: "Invalid manager code" };
  return { ok: true, pin: COMPANY_PIN };
}

// -------------------- HELPERS --------------------
function isApproved(sheet, name, company) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const n = String(data[i][0] || "").trim();
    const c = String(data[i][1] || "").trim();
    const s = String(data[i][2] || "").trim().toLowerCase();
    if (n === name && c === company && (s === "approved" || s === "active" || s === "yes")) return true;
  }
  return false;
}

function findRow(sheet, name, company, date) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (
      String(data[i][0]).trim() === date &&
      String(data[i][2]).trim() === name &&
      String(data[i][3]).trim() === company
    ) {
      return i + 1;
    }
  }
  return null;
}

function getLogRows(sheet, filterFn) {
  const data = sheet.getDataRange().getValues();
  const out = [];
  for (let i = 1; i < data.length; i++) {
    const r = {
      estDate: String(data[i][0] || "").trim(),
      day: String(data[i][1] || "").trim(),
      name: String(data[i][2] || "").trim(),
      company: String(data[i][3] || "").trim(),
      clockIn: String(data[i][4] || "").trim(),
      lunchOut: String(data[i][5] || "").trim(),
      endLunch: String(data[i][6] || "").trim(),
      clockOut: String(data[i][7] || "").trim(),
      updated: String(data[i][8] || "").trim(),
    };
    if (filterFn(r)) out.push(r);
  }
  return out;
}

function dayNameFromISO(isoDate) {
  // isoDate = yyyy-mm-dd
  const d = new Date(isoDate + "T12:00:00");
  return Utilities.formatDate(d, TIMEZONE, "EEE");
}

function output(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
