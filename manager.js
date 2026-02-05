import { CONFIG } from "./config.js";
import { queryRange, getCurrentPin } from "./api.js";
import { tzDateISO, startOfWeekISO, addDaysISO, calcLunchMins, calcTotalHours } from "./common.js";

const $ = (id) => document.getElementById(id);

const els = {
  mgrForm: $("mgrForm"),
  mgrCode: $("mgrCode"),
  company: $("company"),
  lock: $("lock"),
  msg: $("msg"),
  dash: $("dash"),
  nameContains: $("nameContains"),
  from: $("from"),
  to: $("to"),
  lastWeek: $("lastWeek"),
  thisWeek: $("thisWeek"),
  run: $("run"),
  exportXlsx: $("exportXlsx"),
  summaryBody: $("summaryBody"),
  detailBody: $("detailBody"),
  grandTotal: $("grandTotal"),
  currentPin: $("currentPin"),
};

const KEY = "tc_mgr_unlocked_v2";
let lastRows = [];

function setMsg(t){ els.msg.textContent = t || ""; }

function weekRange(which){
  const today = tzDateISO();
  const thisMon = startOfWeekISO(today);
  const from = which === "last" ? addDaysISO(thisMon, -7) : thisMon;
  const to = which === "last" ? addDaysISO(thisMon, -1) : addDaysISO(thisMon, 6);
  return {from,to};
}

function setUnlocked(on){
  localStorage.setItem(KEY, on ? "1" : "0");
  els.dash.style.display = on ? "block" : "none";
}

function isUnlocked(){
  return localStorage.getItem(KEY) === "1";
}

function render(rows){
  els.summaryBody.innerHTML = "";
  els.detailBody.innerHTML = "";

  const map = new Map();
  rows.forEach(r=>{
    const k = `${r.name}__${r.company}`;
    const h = calcTotalHours(r);
    if(h === "") return;
    const e = map.get(k) || {name:r.name, company:r.company, hours:0, days:0};
    e.hours += Number(h);
    e.days += 1;
    map.set(k,e);
  });

  let grand = 0;
  for(const e of map.values()){
    grand += e.hours;
    const tr = document.createElement("tr");
    [e.name, e.company, (Math.round(e.hours*100)/100)+"", e.days+""].forEach(v=>{
      const td = document.createElement("td"); td.textContent = v; tr.appendChild(td);
    });
    els.summaryBody.appendChild(tr);
  }
  els.grandTotal.textContent = rows.length ? (Math.round(grand*100)/100 + " hrs") : "—";

  rows
    .slice()
    .sort((a,b)=> a.estDate < b.estDate ? 1 : -1)
    .forEach(r=>{
      const tr = document.createElement("tr");
      const lunchM = calcLunchMins(r);
      const totalH = calcTotalHours(r);
      const cells = [r.estDate, r.day, r.name, r.company, r.clockIn||"", r.lunchOut||"", r.endLunch||"", r.clockOut||"", lunchM===""?"":String(lunchM), totalH===""?"":String(totalH)];
      cells.forEach(v=>{ const td=document.createElement("td"); td.textContent=v; tr.appendChild(td); });
      els.detailBody.appendChild(tr);
    });
}

function exportXLSX(){
  // Extra gate: require unlocked AND correct manager code present
  if(!isUnlocked() || els.mgrCode.value.trim() !== CONFIG.MANAGER_CODE){
    setMsg("Enter the correct manager code, unlock, then export.");
    return;
  }
  if(typeof XLSX === "undefined"){ alert("XLSX library not loaded."); return; }
  const aoa = [["Date","Day","Name","Company","Clock In","Lunch Out","End Lunch","Clock Out","Lunch (mins)","Total Hours"]];
  lastRows.forEach(r=>{
    aoa.push([r.estDate, r.day, r.name, r.company, r.clockIn||"", r.lunchOut||"", r.endLunch||"", r.clockOut||"", calcLunchMins(r)===""?"":calcLunchMins(r), calcTotalHours(r)===""?"":calcTotalHours(r)]);
  });
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!freeze"] = {xSplit:0, ySplit:1};
  XLSX.utils.book_append_sheet(wb, ws, "Master Log");

  const summary = new Map();
  lastRows.forEach(r=>{
    const k = `${r.name}__${r.company}`;
    const h = calcTotalHours(r);
    if(h==="") return;
    summary.set(k, (summary.get(k)||0) + Number(h));
  });
  const sAoa = [["Employee","Company","Range Hours"]];
  for(const [k,v] of summary.entries()){
    const [n,c]=k.split("__");
    sAoa.push([n,c, Math.round(v*100)/100]);
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sAoa), "Summary");

  XLSX.writeFile(wb, `master_time_log_${els.from.value}_to_${els.to.value}.xlsx`);
}

async function updateCurrentPin(){
  if(els.mgrCode.value.trim() !== CONFIG.MANAGER_CODE){
    els.currentPin.textContent = "—";
    return;
  }
  const res = await getCurrentPin(els.mgrCode.value.trim());
  if(res.ok && res.pin){
    els.currentPin.textContent = res.pin;
  }else{
    els.currentPin.textContent = "—";
  }
}

async function runReport(){
  if(!isUnlocked() || els.mgrCode.value.trim() !== CONFIG.MANAGER_CODE){
    setMsg("Enter the correct manager code first.");
    return;
  }
  setMsg("Running…");
  const res = await queryRange({
    managerCode: els.mgrCode.value.trim(),
    company: els.company.value.trim(),
    nameContains: els.nameContains.value.trim(),
    from: els.from.value,
    to: els.to.value
  });
  if(!res.ok){ setMsg("Error: " + (res.error || "Report failed")); return; }
  lastRows = res.rows || [];
  render(lastRows);
  setMsg(res.note || `Loaded ${lastRows.length} rows.`);
}

function init(){
  const r = weekRange("this");
  els.from.value = r.from;
  els.to.value = r.to;

  if(localStorage.getItem(KEY) === "1"){
    els.dash.style.display = "block";
  }

  els.mgrForm.addEventListener("submit", async (e)=>{
    e.preventDefault();
    const code = els.mgrCode.value.trim();
    if(code !== CONFIG.MANAGER_CODE){
      setMsg("Wrong manager code.");
      setUnlocked(false);
      return;
    }
    setUnlocked(true);
    setMsg("Unlocked.");
    await updateCurrentPin();
  });

  els.mgrCode.addEventListener("input", updateCurrentPin);

  els.lock.addEventListener("click", ()=>{
    setUnlocked(false);
    localStorage.setItem(KEY, "0");
    setMsg("Locked.");
    els.currentPin.textContent = "—";
  });

  els.lastWeek.addEventListener("click", ()=>{
    const rr=weekRange("last"); els.from.value=rr.from; els.to.value=rr.to;
  });
  els.thisWeek.addEventListener("click", ()=>{
    const rr=weekRange("this"); els.from.value=rr.from; els.to.value=rr.to;
  });

  els.run.addEventListener("click", runReport);
  els.exportXlsx.addEventListener("click", exportXLSX);

  // If already unlocked and code is typed, show PIN
  updateCurrentPin();
}
init();
