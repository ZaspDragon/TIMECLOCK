const STORAGE_KEY = 'qrtimeclock2_demo_v1';
const COMPANY_ID = 'chadwell';
const ACTIONS = ['clock_in','start_lunch','end_lunch','clock_out'];
const ACTION_LABELS = {clock_in:'Clock In',start_lunch:'Start Lunch',end_lunch:'End Lunch',clock_out:'Clock Out'};
const NEXT_ACTION = {none:'clock_in',clock_in:'start_lunch',start_lunch:'end_lunch',end_lunch:'clock_out',clock_out:'clock_in'};

const state = { range:'this_week', records:loadRecords() };

function loadRecords(){
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch { return []; }
}
function saveRecords(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state.records)); }
function normalizeName(v){ return String(v||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,''); }
function titleName(v){ return String(v||'').trim().replace(/\s+/g,' ').replace(/\b\w/g,c=>c.toUpperCase()); }
function pad(v){ return String(v).padStart(2,'0'); }
function dateKey(d){ return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function mondayKey(d){ const x=new Date(d); const day=x.getDay(); x.setDate(x.getDate()+(day===0?-6:1-day)); x.setHours(0,0,0,0); return dateKey(x); }
function formatTime(ms){ return new Date(ms).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}); }
function formatDate(ms){ return new Date(ms).toLocaleDateString([],{weekday:'short',month:'short',day:'numeric'}); }
function branchFromUrl(){ const parts=location.pathname.split('/').filter(Boolean); const candidate=parts.at(-1)?.toUpperCase(); return ['OH01','OHC'].includes(candidate)?candidate:null; }
function workerKey(name,agency,branch){ return `${COMPANY_ID}|${agency}|${branch}|${normalizeName(name)}`; }
function id(){ return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`; }

function nowTick(){
  const now=new Date();
  document.querySelector('#liveTime').textContent=now.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
  document.querySelector('#liveDate').textContent=now.toLocaleDateString([],{weekday:'long',month:'short',day:'numeric'});
}
setInterval(nowTick,1000); nowTick();

const lockedBranch=branchFromUrl();
if(lockedBranch){
  const select=document.querySelector('#branchId'); select.value=lockedBranch; select.disabled=true;
  document.querySelector('#branchLabel').textContent=`Branch: ${lockedBranch} (QR locked)`;
}

document.querySelectorAll('.tab').forEach(btn=>btn.addEventListener('click',()=>{
  document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x===btn));
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.querySelector(`#${btn.dataset.view}View`).classList.add('active');
  if(btn.dataset.view==='manager') updateManagerMetrics();
}));

document.querySelectorAll('.range-btn').forEach(btn=>btn.addEventListener('click',()=>{
  state.range=btn.dataset.range;
  document.querySelectorAll('.range-btn').forEach(x=>x.classList.toggle('active',x===btn));
  renderLookup();
}));

document.querySelectorAll('.punch-btn').forEach(btn=>btn.addEventListener('click',()=>createPunch(btn.dataset.action,btn)));
document.querySelector('#workerName').addEventListener('input',renderToday);
document.querySelector('#agencyId').addEventListener('change',renderToday);
document.querySelector('#branchId').addEventListener('change',()=>{document.querySelector('#branchLabel').textContent=`Branch: ${document.querySelector('#branchId').value}`;renderToday();});
document.querySelector('#refreshTime').addEventListener('click',renderLookup);
document.querySelector('#lookupName').addEventListener('input',renderLookup);

function scopedWorkerRecords(name,agency,branch){
  const key=workerKey(name,agency,branch);
  return state.records.filter(r=>r.workerIdentityKey===key && r.active!==false && r.status!=='deleted').sort((a,b)=>a.timestampMs-b.timestampMs);
}
function todayRecords(name,agency,branch){ const dk=dateKey(new Date()); return scopedWorkerRecords(name,agency,branch).filter(r=>r.dateKey===dk); }
function latestAction(records){ return records.length?records.at(-1).action:'none'; }

function createPunch(action,button){
  const name=titleName(document.querySelector('#workerName').value);
  const agencyId=document.querySelector('#agencyId').value;
  const branchId=document.querySelector('#branchId').value;
  if(normalizeName(name).length<2){ return setStatus('Enter your full name before punching.','error'); }
  if(!ACTIONS.includes(action)) return;
  const today=todayRecords(name,agencyId,branchId);
  const last=latestAction(today);
  const expected=NEXT_ACTION[last];
  const allowed=(action===expected)||(last==='clock_in'&&action==='clock_out')||(last==='clock_out'&&action==='clock_in');
  if(!allowed){ return setStatus(`Next expected action is ${ACTION_LABELS[expected]}.`,'error'); }
  button.disabled=true;
  const now=new Date();
  const workerIdentityKey=workerKey(name,agencyId,branchId);
  const punch={
    id:id(), companyId:COMPANY_ID, agencyId, branchId,
    workerId:`pending_${btoa(workerIdentityKey).replace(/=/g,'').slice(-18)}`,
    employeeNumber:'PENDING-FIREBASE', workerDisplayName:name, normalizedName:normalizeName(name),
    workerIdentityKey, action, timestampMs:now.getTime(), timestamp:now.toISOString(),
    dateKey:dateKey(now), weekKey:mondayKey(now), timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,
    source:'public_clock', status:'active', active:true,
    idempotencyKey:`${workerIdentityKey}|${action}|${Math.floor(now.getTime()/60000)}`,
    createdBy:'public_clock_demo', createdAt:now.toISOString(), updatedAt:now.toISOString()
  };
  if(state.records.some(r=>r.idempotencyKey===punch.idempotencyKey)){
    button.disabled=false; return setStatus('That punch was already saved.','error');
  }
  state.records.push(punch); saveRecords();
  setStatus(`${name} — ${ACTION_LABELS[action]} saved at ${formatTime(punch.timestampMs)}.`,'success');
  renderToday(); updateManagerMetrics();
  setTimeout(()=>button.disabled=false,700);
}
function setStatus(message,type=''){
  const el=document.querySelector('#statusMessage'); el.textContent=message; el.className=`status-message ${type}`.trim();
}
function renderToday(){
  const name=document.querySelector('#workerName').value;
  const agency=document.querySelector('#agencyId').value;
  const branch=document.querySelector('#branchId').value;
  const rows=todayRecords(name,agency,branch);
  const wrap=document.querySelector('#todayTimeline');
  const last=latestAction(rows);
  document.querySelector('#workerState').textContent=last==='none'?'Not started':last==='start_lunch'?'On lunch':last==='clock_out'?'Clocked out':'Clocked in';
  if(!rows.length){wrap.className='timeline empty';wrap.textContent='No punches yet.';return;}
  wrap.className='timeline';
  wrap.innerHTML=rows.map(r=>`<div class="timeline-item"><strong>${ACTION_LABELS[r.action]}</strong><span>${formatTime(r.timestampMs)}</span></div>`).join('');
}

function rangeBounds(){
  const now=new Date(); let start,end;
  if(state.range==='this_week'){ start=new Date(`${mondayKey(now)}T00:00:00`); end=new Date(start); end.setDate(end.getDate()+7); }
  else if(state.range==='last_week'){ end=new Date(`${mondayKey(now)}T00:00:00`); start=new Date(end); start.setDate(start.getDate()-7); }
  else { start=new Date(now.getFullYear(),now.getMonth(),1); end=new Date(now.getFullYear(),now.getMonth()+1,1); }
  return [start.getTime(),end.getTime()];
}
function renderLookup(){
  const name=document.querySelector('#lookupName').value;
  const normalized=normalizeName(name);
  const [start,end]=rangeBounds();
  const rows=state.records.filter(r=>r.normalizedName===normalized&&r.active!==false&&r.timestampMs>=start&&r.timestampMs<end).sort((a,b)=>a.timestampMs-b.timestampMs);
  const records=document.querySelector('#timeRows');
  if(normalized.length<2){records.className='records empty';records.textContent='Enter a name to view time.';document.querySelector('#timeSummary').innerHTML='';return;}
  const days=groupDays(rows); const total=Object.values(days).reduce((s,d)=>s+d.hours,0);
  document.querySelector('#timeSummary').innerHTML=`<div class="metric"><span>Days</span><strong>${Object.keys(days).length}</strong></div><div class="metric"><span>Total hours</span><strong>${total.toFixed(2)}</strong></div><div class="metric"><span>Regular</span><strong>${Math.min(40,total).toFixed(2)}</strong></div><div class="metric"><span>Overtime</span><strong>${Math.max(0,total-40).toFixed(2)}</strong></div>`;
  if(!Object.keys(days).length){records.className='records empty';records.textContent='No punches found for this range.';return;}
  records.className='records';
  records.innerHTML=Object.values(days).map(d=>`<div class="record-row"><div><strong>${formatDate(d.firstMs)}</strong><span>${d.warning||'Complete day'}</span></div><div><strong>${d.hours.toFixed(2)} hrs</strong><span>${d.times.join(' · ')}</span></div></div>`).join('');
}
function groupDays(rows){
  const groups={};
  rows.forEach(r=>{(groups[r.dateKey]??=[]).push(r)});
  const out={};
  Object.entries(groups).forEach(([key,list])=>{
    const by=a=>list.filter(x=>x.action===a);
    const ci=by('clock_in')[0], co=by('clock_out').at(-1), lo=by('start_lunch')[0], li=by('end_lunch')[0];
    let ms=ci&&co?co.timestampMs-ci.timestampMs:0;
    if(lo&&li&&li.timestampMs>lo.timestampMs) ms-=li.timestampMs-lo.timestampMs;
    out[key]={firstMs:list[0].timestampMs,hours:Math.max(0,ms/3600000),warning:!ci||!co?'Missing clock in/out':'',times:list.map(x=>`${ACTION_LABELS[x.action]} ${formatTime(x.timestampMs)}`)};
  });
  return out;
}
function updateManagerMetrics(){
  const today=dateKey(new Date()); const workers=new Map();
  state.records.filter(r=>r.dateKey===today&&r.active!==false).forEach(r=>workers.set(r.workerIdentityKey,r));
  let inCount=0,lunch=0,out=0;
  workers.forEach(r=>{if(r.action==='start_lunch')lunch++;else if(r.action==='clock_out')out++;else inCount++;});
  document.querySelector('#metricIn').textContent=inCount;
  document.querySelector('#metricLunch').textContent=lunch;
  document.querySelector('#metricOut').textContent=out;
  document.querySelector('#metricExceptions').textContent=0;
}

renderToday(); renderLookup(); updateManagerMetrics();
