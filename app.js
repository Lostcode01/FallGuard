const $ = (id) => document.getElementById(id);
const STORAGE_KEY = "fallguard_demo_v1";
const defaults = {
  profile: {name:"", age:"", deviceId:"FG-ESP32-001", medicalInfo:""},
  contact: {name:"", phone:"", relation:""},
  events: [],
  location: null
};
let data = loadData();
let alarmTimer = null;
let countdown = 15;
let map = null, marker = null, miniMap = null, miniMarker = null;
let toastTimer = null;

function loadData(){
  try { return {...defaults, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}")}; }
  catch { return structuredClone(defaults); }
}
function saveData(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); updateDashboard(); }
function showToast(message){
  const t=$("toast"); t.textContent=message; t.classList.add("show");
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>t.classList.remove("show"),2600);
}
function nowText(){ return new Date().toLocaleString([], {dateStyle:"medium",timeStyle:"short"}); }
function logEvent(type, description, status="Recorded"){
  data.events.unshift({type,description,time:new Date().toISOString(),status});
  data.events=data.events.slice(0,100); saveData(); renderEvents();
}
function eventTone(type){ return /SOS|Fall|Alarm/i.test(type) ? "danger" : /Warning|Countdown/i.test(type) ? "warn" : "ok"; }
function eventIcon(type){ return /SOS/i.test(type)?"!":/Fall|Alarm/i.test(type)?"⚠":"✓"; }
function renderEvents(){
  const recent=$("recentEvents"), rows=data.events.slice(0,4);
  recent.innerHTML=rows.length?rows.map(e=>`<div class="activity-item"><div class="activity-icon ${eventTone(e.type)}">${eventIcon(e.type)}</div><div><b>${escapeHtml(e.type)}</b><small>${escapeHtml(e.description)}</small></div><span class="activity-time">${new Date(e.time).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</span></div>`).join(""):'<div class="empty-state">No events recorded yet.</div>';
  $("eventTable").innerHTML=data.events.length?data.events.map(e=>`<tr><td>${escapeHtml(e.type)}</td><td>${escapeHtml(e.description)}</td><td>${new Date(e.time).toLocaleString()}</td><td><span class="event-badge ${eventTone(e.type)}">${escapeHtml(e.status)}</span></td></tr>`).join(""):'<tr><td colspan="4" class="empty-cell">No events recorded yet.</td></tr>';
}
function escapeHtml(value){return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function updateDashboard(){
  const name=data.profile.name.trim() || "User";
  $("welcomeName").textContent=name.split(" ")[0]; $("avatar").textContent=name[0].toUpperCase();
  $("eventCount").textContent=data.events.length;
  $("contactPreviewName").textContent=data.contact.name || "No contact configured";
  $("contactPreviewPhone").textContent=data.contact.phone || "Add an emergency contact in settings";
  $("todayDate").textContent=new Date().toLocaleDateString([], {weekday:"short",month:"short",day:"numeric",year:"numeric"});
  if(data.location){
    $("gpsStatus").textContent="Available"; $("gpsSmall").textContent="Accuracy ±"+Math.round(data.location.accuracy)+" m";
    $("miniCoordinates").textContent=`Latitude: ${data.location.lat.toFixed(5)}   Longitude: ${data.location.lng.toFixed(5)}`;
  } else {$("gpsStatus").textContent="Not acquired";$("gpsSmall").textContent="Waiting for permission";}
}
function navigate(page){
  document.querySelectorAll(".page").forEach(p=>p.classList.toggle("active",p.id==="page-"+page));
  document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.page===page));
  const titles={dashboard:"Dashboard",profile:"User profile",contacts:"Emergency contacts",location:"Live location",events:"Event history",sounds:"Sound center"};
  $("pageTitle").textContent=titles[page]; $("crumb").textContent=page.toUpperCase();
  $("sidebar").classList.remove("open");
  if(page==="location" && data.location) setTimeout(()=>{initMap(); map?.invalidateSize();},100);
}
document.querySelectorAll(".nav-item").forEach(b=>b.addEventListener("click",()=>navigate(b.dataset.page)));
document.querySelectorAll("[data-goto]").forEach(b=>b.addEventListener("click",()=>navigate(b.dataset.goto)));
$("menuBtn").addEventListener("click",()=>$("sidebar").classList.toggle("open"));

function setStatus(kind, heading, description, tag){
  const banner=$("statusBanner"); banner.className="status-banner "+kind;
  $("statusHeading").textContent=heading; $("statusDescription").textContent=description; $("statusTag").textContent=tag;
  $("monitorRing").className="monitor-ring"+(kind==="alert"?" alert-ring":kind==="warning"?" warning-ring":"");
  $("monitorBig").textContent=kind==="alert"?"ALARM":kind==="warning"?"WARNING":"READY";
  $("monitorSub").textContent=kind==="alert"?"Fall event active":kind==="warning"?"Awaiting response":"No active alarm";
}
function startFall(){
  if(alarmTimer) return;
  countdown=15;
  setStatus("alert","Possible fall detected","A simulated fall event is active. Cancel it if this is a false alarm.","FALL ALERT");
  $("monitorMessage").textContent="Fall detected. Press Cancel alarm to stop the countdown.";
  $("cancelAlarm").disabled=false; $("simulateFall").disabled=true;
  $("countdown").hidden=false; $("countdownValue").textContent=countdown;
  $("monitorStatus").textContent="Fall alert";
  logEvent("Fall detected","Demonstration fall event started","Active");
  playSound("fall");
  alarmTimer=setInterval(()=>{
    countdown--; $("countdownValue").textContent=countdown;
    if(countdown<=0){
      clearInterval(alarmTimer); alarmTimer=null;
      $("countdown").hidden=true; $("cancelAlarm").disabled=true; $("simulateFall").disabled=false;
      setStatus("warning","Fall escalation simulated","No response was received. SOS workflow is ready for demonstration.","ESCALATED");
      $("monitorMessage").textContent="Countdown finished. Demonstration escalation recorded.";
      logEvent("Fall escalation","No cancellation during the 15-second demonstration countdown","Simulated");
      playSound("sos");
    }
  },1000);
}
function cancelFall(){
  if(!alarmTimer) {showToast("There is no active fall countdown.");return;}
  clearInterval(alarmTimer); alarmTimer=null;
  $("countdown").hidden=true; $("cancelAlarm").disabled=true; $("simulateFall").disabled=false;
  $("monitorStatus").textContent="Standby"; $("monitorMessage").textContent="Alarm cancelled. Monitoring is ready again.";
  setStatus("normal","Alarm cancelled","The simulated fall alarm was cancelled by the user.","CANCELLED");
  logEvent("Alarm cancelled","User cancelled the fall alarm before escalation","Cancelled");
  playSound("normal"); showToast("Fall alarm cancelled.");
}
$("simulateFall").addEventListener("click",startFall);
$("cancelAlarm").addEventListener("click",cancelFall);

function activateSOS(source="Manual SOS button"){
  if(alarmTimer){clearInterval(alarmTimer);alarmTimer=null;$("countdown").hidden=true;$("cancelAlarm").disabled=true;$("simulateFall").disabled=false;}
  setStatus("alert","SOS demonstration active","SOS sequence was activated. Review the contact and location details.","SOS ACTIVE");
  $("monitorStatus").textContent="SOS active";
  $("monitorMessage").textContent="SOS sequence activated. This is a demonstration only.";
  logEvent("SOS activated",source+" · demonstration only","Simulated");
  playSound("sos");
  $("modalContactName").textContent=data.contact.name || "No contact configured";
  $("modalContactPhone").textContent=data.contact.phone || "No demonstration number saved";
  $("sosSummary").textContent=`${data.profile.name || "User"} · Device ${data.profile.deviceId || "FG-ESP32-001"}. ${data.location ? "A phone location is available." : "No GPS location has been acquired yet."}`;
  const safeNumber=data.contact.phone.replace(/[^\d+*#,;]/g,"");
  $("openDialer").disabled=!safeNumber;
  $("openDialer").dataset.number=safeNumber;
  $("sosModal").hidden=false;
}
$("sosButton").addEventListener("click",()=>activateSOS());
$("closeSos").addEventListener("click",()=>$("sosModal").hidden=true);
$("sosModal").addEventListener("click",e=>{if(e.target===$("sosModal"))$("sosModal").hidden=true;});
$("openDialer").addEventListener("click",()=>{
  const number=$("openDialer").dataset.number;
  if(!number)return;
  logEvent("Dialer opened","User chose to open the phone dialer for the saved demonstration contact","User action");
  window.location.href="tel:"+number;
});

$("profileForm").addEventListener("submit",e=>{
  e.preventDefault();
  data.profile={name:$("fullName").value.trim(),age:$("age").value,deviceId:$("deviceId").value.trim(),medicalInfo:$("medicalInfo").value.trim()};
  saveData(); $("profileFeedback").textContent="Profile saved."; logEvent("Profile updated","User profile information was saved"); showToast("Profile saved.");
});
$("contactForm").addEventListener("submit",e=>{
  e.preventDefault();
  data.contact={name:$("contactName").value.trim(),phone:$("contactPhone").value.trim(),relation:$("contactRelation").value.trim()};
  saveData(); $("contactFeedback").textContent="Emergency contact saved."; logEvent("Contact updated","Demonstration emergency contact was saved"); showToast("Emergency contact saved.");
});

function initMap(){
  if(!window.L)return;
  const defaultPoint=[56.9496,24.1052];
  if(!$("fullMap")._leaflet_id){
    $("fullMap").innerHTML="";
    map=L.map("fullMap").setView(data.location?[data.location.lat,data.location.lng]:defaultPoint,data.location?16:5);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:'&copy; OpenStreetMap'}).addTo(map);
  }
  if(data.location){
    const p=[data.location.lat,data.location.lng];
    if(marker)marker.setLatLng(p);else marker=L.marker(p).addTo(map).bindPopup("Current phone location");
    map.setView(p,16);
  }
}
function initMiniMap(){
  if(!window.L||miniMap)return;
  $("miniMap").innerHTML="";
  miniMap=L.map("miniMap",{zoomControl:false,attributionControl:false}).setView([56.9496,24.1052],3);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19}).addTo(miniMap);
  if(data.location){const p=[data.location.lat,data.location.lng];miniMarker=L.marker(p).addTo(miniMap);miniMap.setView(p,13);}
}
function getLocation(){
  if(!navigator.geolocation){showToast("This browser does not support location access.");return;}
  if(!window.isSecureContext){showToast("GPS requires HTTPS or localhost. Open the hosted HTTPS website.");}
  $("locationStatus").textContent="Requesting permission…";
  navigator.geolocation.getCurrentPosition(pos=>{
    const c=pos.coords;
    data.location={lat:c.latitude,lng:c.longitude,accuracy:c.accuracy,time:new Date().toISOString()};
    saveData();
    $("locationStatus").textContent="Location acquired";$("latitude").textContent=c.latitude.toFixed(6);$("longitude").textContent=c.longitude.toFixed(6);
    $("accuracy").textContent="±"+Math.round(c.accuracy)+" m";$("locationTime").textContent=nowText();$("openMapLink").disabled=false;
    initMap(); if(map){map.setView([c.latitude,c.longitude],16);if(marker)marker.setLatLng([c.latitude,c.longitude]);else marker=L.marker([c.latitude,c.longitude]).addTo(map).bindPopup("Current phone location");}
    initMiniMap();if(miniMap){if(miniMarker)miniMarker.setLatLng([c.latitude,c.longitude]);else miniMarker=L.marker([c.latitude,c.longitude]).addTo(miniMap);miniMap.setView([c.latitude,c.longitude],13);}
    showToast("Phone location acquired.");logEvent("GPS location updated","Phone browser location was acquired");
  },err=>{
    $("locationStatus").textContent="Unavailable";
    const messages={1:"Location permission was denied.",2:"Location information is unavailable.",3:"Location request timed out."};
    showToast(messages[err.code]||"Could not obtain location.");
  },{enableHighAccuracy:true,timeout:15000,maximumAge:10000});
}
$("getLocation").addEventListener("click",getLocation);
$("getLocationMini").addEventListener("click",()=>{navigate("location");setTimeout(getLocation,150);});
$("openMapLink").addEventListener("click",()=>{if(data.location)window.open(`https://www.google.com/maps?q=${data.location.lat},${data.location.lng}`,"_blank","noopener");});
$("clearEvents").addEventListener("click",()=>{if(confirm("Clear all saved demonstration events?")){data.events=[];saveData();renderEvents();showToast("Event history cleared.");}});

let audioCtx=null;
function tone(freq,duration,delay=0,type="sine",volume=.12){
  if(!audioCtx)audioCtx=new (window.AudioContext||window.webkitAudioContext)();
  const osc=audioCtx.createOscillator(),gain=audioCtx.createGain();
  osc.type=type;osc.frequency.value=freq;gain.gain.setValueAtTime(0,audioCtx.currentTime+delay);
  gain.gain.linearRampToValueAtTime(volume,audioCtx.currentTime+delay+.015);
  gain.gain.setValueAtTime(volume,audioCtx.currentTime+delay+duration-.03);
  gain.gain.linearRampToValueAtTime(0,audioCtx.currentTime+delay+duration);
  osc.connect(gain);gain.connect(audioCtx.destination);osc.start(audioCtx.currentTime+delay);osc.stop(audioCtx.currentTime+delay+duration);
}
function playSound(kind){
  try{
    if(kind==="normal"){tone(660,.12);tone(880,.16,.18);}
    if(kind==="warning"){tone(740,.16);tone(740,.16,.32);tone(740,.16,.64);}
    if(kind==="fall"){for(let i=0;i<5;i++){tone(i%2?620:920,.18,i*.27,"square",.08);}}
    if(kind==="sos"){[880,880,880,0,660,660,660,0,880,880,880].forEach((f,i)=>{if(f)tone(f,.13,i*.2,"sawtooth",.07);});}
  }catch(e){showToast("Tap again to enable browser audio.");}
}
document.querySelectorAll(".sound-test").forEach(b=>b.addEventListener("click",()=>{playSound(b.dataset.sound);showToast("Playing "+b.dataset.sound+" preview.");}));

function populateForms(){
  $("fullName").value=data.profile.name||"";$("age").value=data.profile.age||"";
  $("deviceId").value=data.profile.deviceId||"FG-ESP32-001";$("medicalInfo").value=data.profile.medicalInfo||"";
  $("contactName").value=data.contact.name||"";$("contactPhone").value=data.contact.phone||"";$("contactRelation").value=data.contact.relation||"";
  if(data.location){
    $("locationStatus").textContent="Location saved";$("latitude").textContent=data.location.lat.toFixed(6);$("longitude").textContent=data.location.lng.toFixed(6);
    $("accuracy").textContent="±"+Math.round(data.location.accuracy)+" m";$("locationTime").textContent=new Date(data.location.time).toLocaleString();$("openMapLink").disabled=false;
  }
}
populateForms();updateDashboard();renderEvents();initMiniMap();
if(data.location){setTimeout(()=>{const p=[data.location.lat,data.location.lng];if(miniMap){miniMap.setView(p,13);miniMarker=L.marker(p).addTo(miniMap);}},200);}
