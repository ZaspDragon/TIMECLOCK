/* Time Clock (GitHub Pages friendly)
   - Stores per-device logs in localStorage
   - One-click timestamps in America/New_York time zone
   - Export CSV or XLSX
*/
(function(){
  const TZ = "America/New_York";

  const $ = (id) => document.getElementById(id);

  const els = {
    estNow: $("estNow"),
    estDate: $("estDate"),
    name: $("name"),
    company: $("company"),
    date: $("date"),
    identityForm: $("identityForm"),
    clearIdentity: $("clearIdentity"),
    statusText: $("statusText"),

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

    logBody: $("logBody"),
    exportCsv: $("exportCsv"),
    exportXlsx: $("exportXlsx"),
    downloadTemplate: $("downloadTemplate"),
    wipeData: $("wipeData")
  };

  const STORAGE_KEY = "timeclock_logs_v1";
  const IDENTITY_KEY = "timeclock_identity_v1";

  function pad(n){ return String(n).padStart(2,"0"); }

  function nowPartsEST(){
    // Use Intl to format into parts in a specific timezone
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: TZ,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hour12: false
    });
    const parts = dtf.formatToParts(new Date()).reduce((acc,p)=>{
      if(p.type !== "literal") acc[p.type] = p.value;
      return acc;
    }, {});
    // parts: month, day, year, hour, minute, second
    return parts;
  }

  function estDateISO(){
    const p = nowPartsEST();
    return `${p.year}-${p.month}-${p.day}`;
  }

  function estTimeHHMMSS(){
    const p = nowPartsEST();
    return `${p.hour}:${p.minute}:${p.second}`;
  }

  function estPrettyDate(){
    const fmt = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday:"short", year:"numeric", month:"short", day:"2-digit" });
    return fmt.format(new Date());
  }

  function estPrettyTime(){
    // 24-hour
    const fmt = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour:"2-digit", minute:"2-digit", second:"2-digit", hour12:false });
    return fmt.format(new Date());
  }

  function loadIdentity(){
    try{
      return JSON.parse(localStorage.getItem(IDENTITY_KEY) || "null");
    }catch(e){ return null; }
  }

  function saveIdentity(identity){
    localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
  }

  function loadLogs(){
    try{
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    }catch(e){ return []; }
  }

  function saveLogs(logs){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
  }

  function dayNameFromISO(iso){
    const [y,m,d] = iso.split("-").map(Number);
    // Build a Date in UTC and then format in EST to get weekday for that date
    const dt = new Date(Date.UTC(y, m-1, d, 12, 0, 0)); // midday avoids DST edge weirdness
    const fmt = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" });
    return fmt.format(dt);
  }

  function getOrCreateRow(logs, identity){
    const key = `${identity.date}__${identity.name}__${identity.company}`;
    let row = logs.find(r => r._key === key);
    if(!row){
      row = {
        _key: key,
        date: identity.date,
        day: dayNameFromISO(identity.date),
        name: identity.name,
        company: identity.company,
        clockIn: "",
        lunchOut: "",
        endLunch: "",
        clockOut: "",
        notes: ""
      };
      logs.unshift(row); // most recent on top
    }
    return row;
  }

  function hhmmssToSeconds(t){
    if(!t) return null;
    const [h, m, s] = t.split(":").map(Number);
    if([h,m,s].some(n => Number.isNaN(n))) return null;
    return h*3600 + m*60 + s;
  }

  function secondsToHours(sec){
    return sec / 3600;
  }

  function calcLunchMins(row){
    const a = hhmmssToSeconds(row.lunchOut);
    const b = hhmmssToSeconds(row.endLunch);
    if(a == null || b == null) return "";
    const diff = Math.max(0, b - a);
    return Math.round(diff/60);
  }

  function calcTotalHours(row){
    const inS = hhmmssToSeconds(row.clockIn);
    const outS = hhmmssToSeconds(row.clockOut);
    if(inS == null || outS == null) return "";
    let worked = Math.max(0, outS - inS);
    const lunch = hhmmssToSeconds(row.endLunch) != null && hhmmssToSeconds(row.lunchOut) != null
      ? Math.max(0, hhmmssToSeconds(row.endLunch) - hhmmssToSeconds(row.lunchOut))
      : 0;
    worked = Math.max(0, worked - lunch);
    const hours = secondsToHours(worked);
    return Math.round(hours * 100) / 100; // 2 decimals
  }

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

    const lunchMins = calcLunchMins(row);
    const totalHours = calcTotalHours(row);

    els.vHours.textContent = totalHours === "" ? "—" : `${totalHours} hrs`;
    const pieces = [];
    if(row.clockIn && row.clockOut) pieces.push(`Shift: ${row.clockIn} → ${row.clockOut}`);
    if(lunchMins !== "") pieces.push(`Lunch: ${lunchMins} mins`);
    els.vBreakdown.textContent = pieces.join(" • ");
    els.statusText.textContent = statusFor(row);

    // button rules: enforce order
    els.clockIn.disabled = !!row.clockIn;
    els.lunchOut.disabled = !row.clockIn || !!row.lunchOut || !!row.clockOut;
    els.endLunch.disabled = !row.lunchOut || !!row.endLunch || !!row.clockOut;
    els.clockOut.disabled = !row.clockIn || !!row.clockOut; // allow clock out even if no lunch used
  }

  function renderTable(logs){
    els.logBody.innerHTML = "";
    logs.forEach((row, idx) => {
      const tr = document.createElement("tr");

      const lunchMins = calcLunchMins(row);
      const totalHours = calcTotalHours(row);

      const cells = [
        row.date,
        row.day,
        row.name,
        row.company,
        row.clockIn || "",
        row.lunchOut || "",
        row.endLunch || "",
        row.clockOut || "",
        lunchMins === "" ? "" : String(lunchMins),
        totalHours === "" ? "" : String(totalHours),
        row.notes || ""
      ];

      cells.forEach((val, i) => {
        const td = document.createElement("td");
        td.textContent = val;
        if(i === 10){
          td.contentEditable = "true";
          td.addEventListener("input", () => {
            row.notes = td.textContent.trim();
            saveLogs(logs);
          });
        }
        tr.appendChild(td);
      });

      els.logBody.appendChild(tr);
    });
  }

  function requireIdentity(){
    const identity = loadIdentity();
    if(!identity || !identity.name || !identity.company || !identity.date) return null;
    return identity;
  }

  function setIdentityForm(identity){
    els.name.value = identity?.name || "";
    els.company.value = identity?.company || "";
    els.date.value = identity?.date || estDateISO();
  }

  function initClock(){
    // live EST badge
    function tick(){
      els.estNow.textContent = estPrettyTime();
      els.estDate.textContent = estPrettyDate();
    }
    tick();
    setInterval(tick, 500);
  }

  function downloadBlob(filename, blob){
    const a = document.createElement("a");
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function logsToAOA(logs){
    const header = ["Date","Day","Name","Company","Clock In","Lunch Out","End Lunch","Clock Out","Lunch (mins)","Total Hours","Notes"];
    const rows = logs.map(r => [
      r.date,
      r.day,
      r.name,
      r.company,
      r.clockIn || "",
      r.lunchOut || "",
      r.endLunch || "",
      r.clockOut || "",
      calcLunchMins(r) === "" ? "" : calcLunchMins(r),
      calcTotalHours(r) === "" ? "" : calcTotalHours(r),
      r.notes || ""
    ]);
    return [header, ...rows];
  }

  function exportCSV(logs){
    const aoa = logsToAOA(logs);
    const lines = aoa.map(row => row.map(v => {
      const s = String(v ?? "");
      if(s.includes(",") || s.includes('"') || s.includes("\n")){
        return '"' + s.replaceAll('"','""') + '"';
      }
      return s;
    }).join(",")).join("\n");
    const blob = new Blob([lines], {type:"text/csv;charset=utf-8"});
    downloadBlob(`timeclock_log_${estDateISO()}.csv`, blob);
  }

  function exportXLSX(logs){
    if(typeof XLSX === "undefined"){
      alert("XLSX library not loaded yet. Try again in a second.");
      return;
    }
    const aoa = logsToAOA(logs);
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!freeze"] = {xSplit:0, ySplit:1};
    XLSX.utils.book_append_sheet(wb, ws, "Log");

    // Add a simple "Template" sheet too
    const t = [
      ["Time Clock Template (fill or paste exports here)"],
      [],
      ["Date","Day","Name","Company","Clock In","Lunch Out","End Lunch","Clock Out","Lunch (mins)","Total Hours","Notes"]
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(t);
    XLSX.utils.book_append_sheet(wb, ws2, "Template");

    XLSX.writeFile(wb, `timeclock_log_${estDateISO()}.xlsx`);
  }

  function downloadBlankTemplate(){
    if(typeof XLSX === "undefined"){
      alert("XLSX library not loaded yet. Try again in a second.");
      return;
    }
    const wb = XLSX.utils.book_new();
    const aoa = [
      ["MASTER TIME LOG (Template)"],
      ["Use this to combine exports from employees."],
      [],
      ["Date","Day","Name","Company","Clock In","Lunch Out","End Lunch","Clock Out","Lunch (mins)","Total Hours","Notes"]
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    XLSX.utils.book_append_sheet(wb, ws, "Master Log");
    XLSX.writeFile(wb, "master_time_log_template.xlsx");
  }

  function main(){
    initClock();

    // default date to today's EST
    els.date.value = estDateISO();

    const logs = loadLogs();
    const identity = loadIdentity();
    setIdentityForm(identity);

    // Render table and today's panel if possible
    renderTable(logs);

    const todayIdentity = requireIdentity();
    if(todayIdentity){
      const row = getOrCreateRow(logs, todayIdentity);
      saveLogs(logs);
      renderToday(row);
      renderTable(logs);
    }else{
      // Disable buttons until identity saved
      [els.clockIn, els.lunchOut, els.endLunch, els.clockOut].forEach(b => b.disabled = true);
    }

    els.identityForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = els.name.value.trim();
      const company = els.company.value.trim();
      const date = els.date.value;
      if(!name || !company || !date){
        alert("Please fill Name, Company, and Date.");
        return;
      }
      const id = {name, company, date};
      saveIdentity(id);

      const row = getOrCreateRow(logs, id);
      saveLogs(logs);
      renderToday(row);
      renderTable(logs);
    });

    els.clearIdentity.addEventListener("click", () => {
      localStorage.removeItem(IDENTITY_KEY);
      setIdentityForm(null);
      els.statusText.textContent = "Not started";
      [els.clockIn, els.lunchOut, els.endLunch, els.clockOut].forEach(b => b.disabled = true);
      alert("Cleared identity. Fill the form to start again.");
    });

    function stamp(field){
      const id = requireIdentity();
      if(!id){
        alert("Fill in Name, Company, and Date first.");
        return;
      }
      const row = getOrCreateRow(logs, id);
      if(row[field]) return; // already stamped
      row[field] = estTimeHHMMSS();
      saveLogs(logs);
      renderToday(row);
      renderTable(logs);
    }

    els.clockIn.addEventListener("click", () => stamp("clockIn"));
    els.lunchOut.addEventListener("click", () => stamp("lunchOut"));
    els.endLunch.addEventListener("click", () => stamp("endLunch"));
    els.clockOut.addEventListener("click", () => stamp("clockOut"));

    els.exportCsv.addEventListener("click", () => exportCSV(loadLogs()));
    els.exportXlsx.addEventListener("click", () => exportXLSX(loadLogs()));
    els.downloadTemplate.addEventListener("click", () => downloadBlankTemplate());

    els.wipeData.addEventListener("click", () => {
      const ok = confirm("This will erase ALL saved logs on this device/browser. Continue?");
      if(!ok) return;
      localStorage.removeItem(STORAGE_KEY);
      renderTable([]);
      els.vClockIn.textContent = "—";
      els.vLunchOut.textContent = "—";
      els.vEndLunch.textContent = "—";
      els.vClockOut.textContent = "—";
      els.vHours.textContent = "—";
      els.vBreakdown.textContent = "";
      els.statusText.textContent = "Not started";
      alert("Cleared.");
    });
  }

  window.addEventListener("DOMContentLoaded", main);
})();