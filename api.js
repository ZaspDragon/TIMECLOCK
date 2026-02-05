import { CONFIG } from "./config.js";

async function postJSON(url, data){
  const res = await fetch(url, {
    method: "POST",
    mode: "cors",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(data)
  });
  const txt = await res.text();
  let json;
  try{ json = JSON.parse(txt); }catch(e){ json = { ok:false, error:"Bad response", raw: txt }; }
  return json;
}

function checkURL(){
  if(!CONFIG.APPS_SCRIPT_URL || CONFIG.APPS_SCRIPT_URL.includes("PASTE_")){
    return false;
  }
  return true;
}

export async function stamp(payload){
  if(!checkURL()) return { ok:false, error:"Apps Script URL not set. Update config.js" };
  return await postJSON(CONFIG.APPS_SCRIPT_URL, { action:"stamp", ...payload });
}

export async function queryRange(payload){
  if(!checkURL()) return { ok:false, error:"Apps Script URL not set. Update config.js" };
  return await postJSON(CONFIG.APPS_SCRIPT_URL, { action:"query", ...payload });
}

export async function getCurrentPin(managerCode){
  if(!checkURL()) return { ok:false, error:"Apps Script URL not set. Update config.js" };
  return await postJSON(CONFIG.APPS_SCRIPT_URL, { action:"getPin", managerCode });
}
