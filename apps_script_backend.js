/**
 * Time Clock Backend — Google Apps Script (Web App)
 *
 * ✅ Adds:
 * 1) Approved Employee List (only approved can submit)
 * 2) Rotating Company PIN (daily or weekly)
 * 3) Manager code required to view current PIN + export/run reports
 *
 * Setup:
 * - Create Google Sheet
 * - Extensions → Apps Script → paste this file
 * - Update CONFIG below
 * - Deploy as Web App (Execute as Me, Access: Anyone)
 */

const CONFIG = {
  TIMEZONE: "America/New_York",

  // PIN rotation: "daily" or "weekly"
  PIN_MODE: "weekly",

  // Base secret used to generate rotating PIN (keep private)
  BASE_PIN_SECRET: "SIDEHUSTLE",

  // Manager code to unlock manager dashboard + see current PIN
  MANAGER_CODE: "MANAGER123",

  // Sheet names
  SHEET_LOGS: "TimeLogs",
  SHEET_APPROVED: "ApprovedEmployees", // name, company, status (approved/active)
};

// --------- Helpers ----------
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function ensureSheetLogs_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(CONFIG.SHEET_LOGS);
  if (!sh) {
    sh = ss.insertSheet(CONFIG.SHEET_LOGS);
    sh.appendRow(["estDate","day","name","company","clockIn","lunchOut","endLunch","clockOut","notes","updatedAt"]);
    sh.getRange(1,1,1,10).setFontWeight("bold");
  }
  return sh;
}

function ensureSheetApproved_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(CONFIG.SHEET_APPROVED);
  if (!sh) {
    sh = ss.insertSheet(CONFIG.SHEET_APPROVED);
    sh.appendRow(["name","company","status"]); // status: approved
    sh.getRange(1,1,1,3).setFontWeight("bold");
    sh.appendRow(["Example Employee","SideHustle","approved"]);
  }
  return sh;
}

function normalize_(s){ return String(s||"").trim().toLowerCase(); }

function isApprovedEmployee_(name, company){
  const sh = ensureSheetApproved_();
  const data = sh.getDataRange().getValues();
  const n = normalize_(name);
  const c = normalize_(company);
  for(let i=1;i<data.length;i++){
    const rowName = normalize_(data[i][0]);
    const rowCompany = normalize_(data[i][1]);
    const status = normalize_(data[i][2]);
    if(rowName === n && rowCompany === c && (status === "approved" || status === "active" || status === "yes")){
      return true;
    }
  }
  return false;
}

function isoWeekToken_(dateObj){
  // ISO week-year + week number, formatted YYYYwWW (e.g., 2026W05)
  const d = new Date(Date.UTC(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate()));
  // Thursday in current week decides the year
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  const yyyy = d.getUTCFullYear();
  const ww = String(weekNo).padStart(2,"0");
  return `${yyyy}W${ww}`;
}

function currentPin_(){
  const now = new Date();
  if(CONFIG.PIN_MODE === "daily"){
    const day = Utilities.formatDate(now, CONFIG.TIMEZONE, "yyyy-MM-dd");
    return `${CONFIG.BASE_PIN_SECRET}-${day}`;
  }
  // weekly default
  const wk = isoWeekToken_(new Date(Utilities.formatDate(now, CONFIG.TIMEZONE, "yyyy/MM/dd")));
  return `${CONFIG.BASE_PIN_SECRET}-${wk}`;
}

function validateCompanyPin_(pin){
  return normalize_(pin) === normalize_(currentPin_());
}

// --------- Web App ----------
function doGet(e){
  ensureSheetLogs_();
  ensureSheetApproved_();
  return json_({ ok:true, msg:"TimeClock web app is running.", pinMode: CONFIG.PIN_MODE });
}

function doPost(e){
  try{
    const body = JSON.parse(e.postData.contents || "{}");
    const action = body.action;

    if(action === "stamp"){
      return json_(handleStamp_(body));
    } else if(action === "query"){
      return json_(handleQuery_(body));
    } else if(action === "getPin"){
      return json_(handleGetPin_(body));
    } else {
      return json_({ ok:false, error:"Unknown action" });
    }
  }catch(err){
    return json_({ ok:false, error: String(err) });
  }
}

function handleGetPin_(b){
  if(normalize_(b.managerCode) !== normalize_(CONFIG.MANAGER_CODE)){
    return { ok:false, error:"Bad manager code" };
  }
  return { ok:true, pin: currentPin_(), pinMode: CONFIG.PIN_MODE };
}

function handleStamp_(b){
  // validate rotating company pin
  if(!validateCompanyPin_(b.pin || "")){
    return { ok:false, error:"Bad company PIN (rotating). Ask manager for the current PIN." };
  }

  const name = String(b.name || "").trim();
  const company = String(b.company || "").trim();
  const estDate = String(b.estDate || "").trim(); // YYYY-MM-DD from client (EST-based)
  const estTime = String(b.estTime || "").trim(); // HH:MM:SS from client
  const field = String(b.field || "").trim();

  if(!name || !company || !estDate || !estTime){
    return { ok:false, error:"Missing fields" };
  }

  if(!isApprovedEmployee_(name, company)){
    return { ok:false, error:"Not approved. Ask manager to add you to ApprovedEmployees sheet." };
  }

  const allowed = ["clockIn","lunchOut","endLunch","clockOut"];
  if(allowed.indexOf(field) === -1){
    return { ok:false, error:"Invalid field" };
  }

  const sh = ensureSheetLogs_();
  const data = sh.getDataRange().getValues();
  const header = data[0];
  const col = (key) => header.indexOf(key) + 1;

  // find row by (estDate, name, company)
  let rowIndex = -1;
  for(let i=1;i<data.length;i++){
    if(String(data[i][0])===estDate && String(data[i][2])===name && String(data[i][3])===company){
      rowIndex = i+1;
      break;
    }
  }

  const day = Utilities.formatDate(new Date(estDate+"T12:00:00Z"), CONFIG.TIMEZONE, "EEE");

  if(rowIndex === -1){
    sh.appendRow([estDate, day, name, company, "", "", "", "", "", new Date()]);
    rowIndex = sh.getLastRow();
  }

  // do not overwrite existing stamp
  const targetCol = col(field);
  const current = sh.getRange(rowIndex, targetCol).getValue();
  if(current){
    return { ok:true, note: field + " already set." };
  }

  sh.getRange(rowIndex, targetCol).setValue(estTime);
  sh.getRange(rowIndex, col("updatedAt")).setValue(new Date());
  return { ok:true, note: "Saved " + field + " = " + estTime };
}

function handleQuery_(b){
  const sh = ensureSheetLogs_();
  const data = sh.getDataRange().getValues();

  const from = String(b.from || "").trim();
  const to = String(b.to || "").trim();
  if(!from || !to){
    return { ok:false, error:"Missing from/to" };
  }

  // Manager query
  if(b.managerCode){
    if(normalize_(b.managerCode) !== normalize_(CONFIG.MANAGER_CODE)){
      return { ok:false, error:"Bad manager code" };
    }
    const companyFilter = String(b.company || "").trim().toLowerCase();
    const nameContains = String(b.nameContains || "").trim().toLowerCase();

    const rows = [];
    for(let i=1;i<data.length;i++){
      const r = data[i];
      const estDate = String(r[0] || "");
      if(estDate < from || estDate > to) continue;
      const name = String(r[2] || "");
      const company = String(r[3] || "");
      if(companyFilter && company.toLowerCase().indexOf(companyFilter) === -1) continue;
      if(nameContains && name.toLowerCase().indexOf(nameContains) === -1) continue;

      rows.push({
        estDate,
        day: String(r[1]||""),
        name,
        company,
        clockIn: String(r[4]||""),
        lunchOut: String(r[5]||""),
        endLunch: String(r[6]||""),
        clockOut: String(r[7]||""),
        notes: String(r[8]||"")
      });
    }
    return { ok:true, rows, note:`Manager report: ${rows.length} rows` };
  }

  // Employee query: validate PIN + approved
  if(!validateCompanyPin_(b.pin || "")){
    return { ok:false, error:"Bad company PIN (rotating). Ask manager for the current PIN." };
  }

  const name = String(b.name || "").trim();
  const company = String(b.company || "").trim();
  if(!name || !company){
    return { ok:false, error:"Missing name/company" };
  }

  if(!isApprovedEmployee_(name, company)){
    return { ok:false, error:"Not approved. Ask manager to add you to ApprovedEmployees sheet." };
  }

  const rows = [];
  for(let i=1;i<data.length;i++){
    const r = data[i];
    const estDate = String(r[0] || "");
    if(estDate < from || estDate > to) continue;
    if(String(r[2]||"") !== name) continue;
    if(String(r[3]||"") !== company) continue;

    rows.push({
      estDate,
      day: String(r[1]||""),
      clockIn: String(r[4]||""),
      lunchOut: String(r[5]||""),
      endLunch: String(r[6]||""),
      clockOut: String(r[7]||""),
      notes: String(r[8]||"")
    });
  }

  return { ok:true, rows, note:`Loaded ${rows.length} rows` };
}
