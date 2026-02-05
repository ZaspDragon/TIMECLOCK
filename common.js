import { CONFIG } from "./config.js";

export const TZ = CONFIG.TIMEZONE || "America/New_York";

export function nowPartsTZ(){
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
  return parts;
}
export function tzDateISO(){
  const p = nowPartsTZ();
  return `${p.year}-${p.month}-${p.day}`;
}
export function tzTimeHHMMSS(){
  const p = nowPartsTZ();
  return `${p.hour}:${p.minute}:${p.second}`;
}
export function tzPrettyDate(){
  return new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday:"short", year:"numeric", month:"short", day:"2-digit" }).format(new Date());
}
export function tzPrettyTime(){
  return new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour:"2-digit", minute:"2-digit", second:"2-digit", hour12:false }).format(new Date());
}
export function dayNameFromISO(iso){
  const [y,m,d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m-1, d, 12, 0, 0));
  return new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" }).format(dt);
}
export function hhmmssToSeconds(t){
  if(!t) return null;
  const [h,m,s] = t.split(":").map(Number);
  if([h,m,s].some(n => Number.isNaN(n))) return null;
  return h*3600 + m*60 + s;
}
export function calcLunchMins(row){
  const a = hhmmssToSeconds(row.lunchOut);
  const b = hhmmssToSeconds(row.endLunch);
  if(a == null || b == null) return "";
  return Math.round(Math.max(0, b-a)/60);
}
export function calcTotalHours(row){
  const inS = hhmmssToSeconds(row.clockIn);
  const outS = hhmmssToSeconds(row.clockOut);
  if(inS == null || outS == null) return "";
  let worked = Math.max(0, outS - inS);
  const lunch = (hhmmssToSeconds(row.endLunch)!=null && hhmmssToSeconds(row.lunchOut)!=null)
    ? Math.max(0, hhmmssToSeconds(row.endLunch)-hhmmssToSeconds(row.lunchOut))
    : 0;
  worked = Math.max(0, worked - lunch);
  const hours = Math.round((worked/3600)*100)/100;
  return hours;
}
export function startOfWeekISO(dateISO){
  const [y,m,d] = dateISO.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m-1, d, 12, 0, 0));
  const day = dt.getUTCDay(); // 0 Sun - 6 Sat
  const diffToMon = (day === 0 ? -6 : 1 - day);
  dt.setUTCDate(dt.getUTCDate() + diffToMon);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth()+1).padStart(2,"0");
  const dd = String(dt.getUTCDate()).padStart(2,"0");
  return `${yy}-${mm}-${dd}`;
}
export function addDaysISO(dateISO, days){
  const [y,m,d] = dateISO.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m-1, d, 12, 0, 0));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth()+1).padStart(2,"0");
  const dd = String(dt.getUTCDate()).padStart(2,"0");
  return `${yy}-${mm}-${dd}`;
}
