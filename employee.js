import { CONFIG } from "./config.js";
import { stamp, queryRange } from "./api.js";
import {
  tzPrettyTime,
  tzPrettyDate,
  tzDateISO,
  tzTimeHHMMSS,
  dayNameFromISO,
  calcLunchMins,
  calcTotalHours,
  startOfWeekISO,
  addDaysISO
} from "./common.js";

const $ = (id) => document.getElementById(id);

const els = {
  now: $("now"),
  datePretty: $("datePretty"),
  name: $("name"),
  company: $("company"),
  date: $("date"),
  // pin removed
  msg: $("msg"),
  identityForm: $("identityForm"),
  clear: $("clear"),

  status: $("status"),
  clockIn: $("clockIn"),
  lunchOut: $("lunchOut"),
  endLunch: $("endLunch"),
  clockOut: $("clockOut"),

  vClockIn: $("vClockIn"),
  vLunchOut: $("vLunchOut"),
  vEndLunch: $("vEndLunch"),
  vClockOut: $("vClockOut"),
  vHours: $("vHours"),
  vBreakdown: $("vBreakdown"),

  from: $("from"),
  to: $("to"),
  rangeTotal: $("rangeTotal"),
  tbody: $("tbody"),
  lastWeek: $("lastWeek"),
  thisWeek: $("thisWeek"),
  refresh: $("refresh"),
  exportXlsx: $("exportXlsx"),
  exportCsv: $("exportCsv"),
};

const ID_KEY = "tc_identity_v3"; // keep key; stored object just won’t include pin
let identity = null;
let myRows = [];

function setMsg(t){ els.msg.textContent = t || ""; }

function tick(){
  els.now.textContent = tzPrettyTime();
  els.datePretty.textContent = tzPrettyDate();
}
tick(); setInterval(tick, 500);

function statusFor(row){
  if(row.clockOut) return "Clocked Out";
  if(row.endLunch) return "Working";
  if(row.lunchOut) return "At Lunch";
  if(row.clockIn) return "Clocked In";
  return "Not started";
}

function renderToday(row){
  els.vClockIn.textContent = row.clockIn || "—";
  els.vLunchOut.textContent = row.lunchOut || "—";
  els.vEndLunch.textContent = row.endLunch || "—";
  els.vClockOut.textContent = row.clockOut || "—";
  const lunchM = calcLunchMins(row);
  const totalH = calcTotalHours(row);
  els.vHours.textContent = totalH === "" ? "—" : `${totalH} hrs`;
  const pieces = [];
  if(row.clockIn && row.clockOut) pieces.push(`Shift: ${row.clockIn} → ${row.clockOut}`);
  if(lunchM !== "") pieces.push(`Lunch: ${lunchM} mins`);
  els.vBreakdown.textContent = pieces.join(" • ");
  els.status.textContent = statusFor(row);

  els.clockIn.disabled = !!row.clockIn;
  els.lunchOut.disabled = !row.clockIn || !!row.lunchOut || !!row.clockOut;
  els.endLunch.disabled = !row.lunchOut || !!row.endLunch || !!row.clockOut;
  els.clockOut.disabled = !row.clockIn || !!row.clockOut;
}

function renderTable(rows){
  els.tbody.innerHTML = "";
  let sum = 0;
  rows.forEach(r=>{
    const tr = document.createElement("tr");
    const lunchM = calcLunchMins(r);
    const totalH = calcTotalHours(r);
    if(totalH !== "") sum += Number(totalH);
    const cells = [r.estDate, r.day, r.clockIn||"", r.lunchOut||"", r.endLunch||"", r.clockOut||"", lunchM===""?"":String(lunchM), totalH===""?"":String(totalH)];
    cells.forEach(v=>{
      const td = document.createElement("td");
      td.textContent = v;
      tr.appendChild(td);
    });
    els.tbody.appendChild(tr);
  });
  els.rangeTotal.value = rows.length ? (Math.round(sum*100)/100 + " hrs") : "";
}

function loadIdentity(){
  try{ return JSON.parse(localStorage.getItem(ID_KEY) || "null"); }catch(e){ return null; }
}
function saveIdentity(id){ localStorage.setItem(ID_KEY, JSON.stringify(id)); }
function clearIdentity(){ localStorage.removeItem(ID_KEY); }

function enableButtons(on){
  // Keep “today stamp” buttons enabled/disabled as a group
  [els.clockIn, els.lunchOut, els.endLunch, els.clockOut].forEach(b => b.disabled = !on);
}

function weekRange(which){
  const today = tzDateISO();
  const thisMon = startOfWeekISO(today);
  const from = which === "last" ? addDaysISO(thisMon, -7) : thisMon;
  const to = which === "last" ? addDaysISO(thisMon, -1) : addDaysISO(thisMon, 6);
  return {from,to};
}

function ensureDefaultRange(){
  const r = weekRange("this");
  els.from.value = r.from;
  els.to.value = r.to;
}

function todayRowFrom(rows){
  const today = tzDateISO();
  return rows.find(r => r.estDate === today) || { estDate: today, day: dayNameFromISO(today), clockIn:"", lunchOut:"", endLunch:"", clockOut:"" };
}

async function refreshMyRows(){
  if(!identity) return;
  setMsg("Loading your history…");
  const res = await queryRange({
    name: identity.name,
    company: identity.company,
    from: els.from.value,
    to: els.to.value
  });
  if(!res.ok){
    setMsg("Error: " + (res.error || "Unable to load"));
    return;
  }
  myRows = res.rows || [];
  renderTable(myRows);
  renderToday(todayRowFrom(myRows));
  setMsg(res.note || "Loaded.");
}

function exportCSV(){
  const header = ["Date","Day","Name","Company","Clock In","Lunch Out","End Lunch","Clock Out","Lunch (mins)","Total Hours"];
  const lines = [header, ...(myRows.map(r=>{
    const lunchM = calcLunchMins(r);
    const totalH = calcTotalHours(r);
    return [r.estDate, r.day, identity.name, identity.company, r.clockIn||"", r.lunchOut||"", r.endLunch||"", r.clockOut||"", lunchM===""?"":lunchM, totalH===""?"":totalH];
  }))].map(row => row.map(v=>{
    const s = String(v ?? "");
    if(s.includes(",") || s.includes('"') || s.includes("\n")){
      return '"' + s.replaceAll('"','""') + '"';
    }
    return s;
  }).join(",")).join("\n");
  const blob = new Blob([lines], {type:"text/csv;charset=utf-8"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `timeclock_${identity.name.replaceAll(" ","_")}_${els.from.value}_to_${els.to.value}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function exportXLSX(){
  if(typeof XLSX === "undefined"){ alert("XLSX library not loaded yet."); return; }
  const aoa = [["Date","Day","Name","Company","Clock In","Lunch Out","End Lunch","Clock Out","Lunch (mins)","Total Hours"]];
  myRows.forEach(r=>{
    aoa.push([
      r.estDate,
      r.day,
      identity.name,
      identity.company,
      r.clockIn||"",
      r.lunchOut||"",
      r.endLunch||"",
      r.clockOut||"",
      calcLunchMins(r)===""?"":calcLunchMins(r),
      calcTotalHours(r)===""?"":calcTotalHours(r)
    ]);
  });
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!freeze"] = {xSplit:0, ySplit:1};
  XLSX.utils.book_append_sheet(wb, ws, "My Log");
  XLSX.writeFile(wb, `timeclock_${identity.name.replaceAll(" ","_")}_${els.from.value}_to_${els.to.value}.xlsx`);
}

async function stampField(field){
  if(!identity){ setMsg("Fill sign-in first."); return; }
  setMsg("Saving…");
  const res = await stamp({
    name: identity.name,
    company: identity.company,
    estDate: tzDateISO(),
    estTime: tzTimeHHMMSS(),
    field
  });
  if(!res.ok){
    setMsg("Error: " + (res.error || "Stamp failed"));
    return;
  }
  setMsg(res.note || "Saved.");
  await refreshMyRows();
}

function init(){
  els.date.value = tzDateISO();
  ensureDefaultRange();
  enableButtons(false);

  identity = loadIdentity();
  if(identity){
    els.name.value = identity.name || "";
    els.company.value = identity.company || "";
  }

  async function validateAndEnable(){
    if(!identity) return;
    setMsg("Validating…");
    const res = await queryRange({
      name: identity.name,
      company: identity.company,
      from: els.from.value,
      to: els.to.value
    });
    if(!res.ok){
      enableButtons(false);
      setMsg("Not enabled: " + (res.error || "Validation failed"));
      return;
    }
    enableButtons(true);
    myRows = res.rows || [];
    renderTable(myRows);
    renderToday(todayRowFrom(myRows));
    setMsg(res.note || "Enabled.");
  }

  els.identityForm.addEventListener("submit", async (e)=>{
    e.preventDefault();
    const name = els.name.value.trim();
    const company = els.company.value.trim();
    if(!name || !company){ setMsg("Fill Name and Company."); return; }
    identity = { name, company };
    saveIdentity(identity);
    await validateAndEnable();
  });

  els.clear.addEventListener("click", ()=>{
    clearIdentity();
    identity = null;
    els.name.value = "";
    els.company.value = "";
    enableButtons(false);
    setMsg("Cleared.");
  });

  els.clockIn.addEventListener("click", ()=>stampField("clockIn"));
  els.lunchOut.addEventListener("click", ()=>stampField("lunchOut"));
  els.endLunch.addEventListener("click", ()=>stampField("endLunch"));
  els.clockOut.addEventListener("click", ()=>stampField("clockOut"));

  els.refresh.addEventListener("click", refreshMyRows);
  els.lastWeek.addEventListener("click", ()=>{
    const r = weekRange("last"); els.from.value = r.from; els.to.value = r.to; refreshMyRows();
  });
  els.thisWeek.addEventListener("click", ()=>{
    const r = weekRange("this"); els.from.value = r.from; els.to.value = r.to; refreshMyRows();
  });

  els.from.addEventListener("change", refreshMyRows);
  els.to.addEventListener("change", refreshMyRows);
  els.exportCsv.addEventListener("click", exportCSV);
  els.exportXlsx.addEventListener("click", exportXLSX);

  if(identity) validateAndEnable();
}
init();

