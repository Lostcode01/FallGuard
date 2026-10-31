const $ = (id) => document.getElementById(id);
const STORAGE_KEY = "fallguard_v1";
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
function nowText(){ return new Date().toLocaleString("ru-RU", {dateStyle:"medium",timeStyle:"short"}); }
function logEvent(type, description, status="Записано"){
  data.events.unshift({type,description,time:new Date().toISOString(),status});
  data.events=data.events.slice(0,100); saveData(); renderEvents();
}
function eventTone(type){ return /SOS|Fall|Alarm/i.test(type) ? "danger" : /Warning|Countdown/i.test(type) ? "warn" : "ok"; }
function eventIcon(type){ return /SOS/i.test(type)?"!":/Fall|Alarm/i.test(type)?"⚠":"✓"; }
function renderEvents(){
  const recent=$("recentEvents"), rows=data.events.slice(0,4);
  recent.innerHTML=rows.length?rows.map(e=>`<div class="activity-item"><div class="activity-icon ${eventTone(e.type)}">${eventIcon(e.type)}</div><div><b>${escapeHtml(e.type)}</b><small>${escapeHtml(e.description)}</small></div><span class="activity-time">${new Date(e.time).toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"})}</span></div>`).join(""):'<div class="empty-state">Событий пока нет.</div>';
  $("eventTable").innerHTML=data.events.length?data.events.map(e=>`<tr><td>${escapeHtml(e.type)}</td><td>${escapeHtml(e.description)}</td><td>${new Date(e.time).toLocaleString("ru-RU")}</td><td><span class="event-badge ${eventTone(e.type)}">${escapeHtml(e.status)}</span></td></tr>`).join(""):'<tr><td colspan="4" class="empty-cell">Событий пока нет.</td></tr>';
}
function escapeHtml(value){return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function updateDashboard(){
  const name=data.profile.name.trim() || "Пользователь";
  $("welcomeName").textContent=name.split(" ")[0]; $("avatar").textContent=name[0].toUpperCase();
  $("eventCount").textContent=data.events.length;
  $("contactPreviewName").textContent=data.contact.name || "Контакт не указан";
  $("contactPreviewPhone").textContent=data.contact.phone || "Добавьте контакт в настройках";
  $("todayDate").textContent=new Date().toLocaleDateString("ru-RU", {weekday:"short",month:"short",day:"numeric",year:"numeric"});
  if(data.location){
    $("gpsStatus").textContent="Доступна"; $("gpsSmall").textContent="Точность ±"+Math.round(data.location.accuracy)+" м";
    $("miniCoordinates").textContent=`Широта: ${data.location.lat.toFixed(5)}   Долгота: ${data.location.lng.toFixed(5)}`;
  } else {$("gpsStatus").textContent="Не получена";$("gpsSmall").textContent="Ожидание разрешения";}
}
function navigate(page){
  document.querySelectorAll(".page").forEach(p=>p.classList.toggle("active",p.id==="page-"+page));
  document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.page===page));
  const titles={dashboard:"Главная",profile:"Профиль",contacts:"Контакты",location:"Геолокация",events:"История событий",sounds:"Проверка устройств"};
  $("pageTitle").textContent=titles[page]; $("crumb").textContent=titles[page].toUpperCase();
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
  $("monitorSub").textContent=kind==="alert"?"Требуется проверка":kind==="warning"?"Ожидание помощи":"Тревога не активна";
}
function startFall(){
  if(alarmTimer) return;
  countdown=15;
  setStatus("alert","Обнаружено возможное падение","Датчик ESP32 обнаружил резкое изменение движения. Отмените тревогу, если падения не было.","ТРЕВОГА");
  $("monitorMessage").textContent="Проверьте состояние пользователя. Для отмены нажмите физическую кнопку или кнопку на сайте.";
  $("cancelAlarm").disabled=false;
  $("countdown").hidden=false; $("countdownValue").textContent=countdown;
  $("monitorStatus").textContent="Тревога";
  logEvent("Обнаружено падение","Событие получено от датчиков ESP32","Активно");
  playSound("fall");
  alarmTimer=setInterval(()=>{
    countdown--; $("countdownValue").textContent=countdown;
    if(countdown<=0){
      clearInterval(alarmTimer); alarmTimer=null;
      $("countdown").hidden=true; $("cancelAlarm").disabled=true;
      setStatus("warning","Требуется помощь","Время ожидания завершено. Устройство перешло в режим SOS.","SOS");
      $("monitorMessage").textContent="Активирован сигнал SOS.";
      logEvent("Активирован SOS","Тревога не была отменена в течение 15 секунд","Активно");
      playSound("sos");
    }
  },1000);
}
function cancelFall(){
  if(!alarmTimer) return;
  clearInterval(alarmTimer); alarmTimer=null;
  $("countdown").hidden=true; $("cancelAlarm").disabled=true;
  $("monitorStatus").textContent="Мониторинг";
  $("monitorMessage").textContent="Тревога отменена. Мониторинг продолжается.";
  setStatus("normal","Тревога отменена","Пользователь подтвердил, что помощь не требуется.","ОТМЕНЕНО");
  logEvent("Тревога отменена","Тревога отменена пользователем","Отменено");
  playSound("normal"); showToast("Тревога отменена.");
}
$("cancelAlarm").addEventListener("click",()=>{if(window.fallguardSendCommand)window.fallguardSendCommand("CANCEL");});
function activateSOS(source="Кнопка SOS"){
  if(alarmTimer){clearInterval(alarmTimer);alarmTimer=null;$("countdown").hidden=true;$("cancelAlarm").disabled=true;}
  setStatus("alert","Активирован сигнал SOS","Устройство отправило сигнал SOS. Проверьте контакт и местоположение.","SOS АКТИВЕН");
  $("monitorStatus").textContent="SOS";
  $("monitorMessage").textContent="Сигнал SOS активирован устройством.";
  logEvent("Активирован SOS",source,"Активно");
  playSound("sos");
  $("modalContactName").textContent=data.contact.name || "Контакт не указан";
  $("modalContactPhone").textContent=data.contact.phone || "Номер не указан";
  $("sosSummary").textContent=`${data.profile.name || "Пользователь"} · Device ${data.profile.deviceId || "FG-ESP32-001"}. ${data.location ? "Геолокация получена." : "Геолокация ещё не получена."}`;
  const safeNumber=data.contact.phone.replace(/[^\d+*#,;]/g,"");
  $("openDialer").disabled=!safeNumber;
  $("openDialer").dataset.number=safeNumber;
  $("sosModal").hidden=false;
}
$("sosButton").addEventListener("click",()=>{if(window.fallguardSendCommand)window.fallguardSendCommand("SOS");else showToast("Сначала подключите ESP32.");});
$("closeSos").addEventListener("click",()=>$("sosModal").hidden=true);
$("sosModal").addEventListener("click",e=>{if(e.target===$("sosModal"))$("sosModal").hidden=true;});
$("openDialer").addEventListener("click",()=>{
  const number=$("openDialer").dataset.number;
  if(!number)return;
  logEvent("Открыт набор номера","Пользователь открыл набор номера контакта","Действие пользователя");
  window.location.href="tel:"+number;
});

$("profileForm").addEventListener("submit",e=>{
  e.preventDefault();
  data.profile={name:$("fullName").value.trim(),age:$("age").value,deviceId:$("deviceId").value.trim(),medicalInfo:$("medicalInfo").value.trim()};
  saveData(); $("profileFeedback").textContent="Профиль сохранён."; logEvent("Профиль обновлён","Сохранены данные пользователя"); showToast("Профиль сохранён.");
});
$("contactForm").addEventListener("submit",e=>{
  e.preventDefault();
  data.contact={name:$("contactName").value.trim(),phone:$("contactPhone").value.trim(),relation:$("contactRelation").value.trim()};
  saveData(); $("contactFeedback").textContent="Контакт сохранён."; logEvent("Контакт обновлён","Сохранён контакт для связи"); showToast("Контакт сохранён.");
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
    if(marker)marker.setLatLng(p);else marker=L.marker(p).addTo(map).bindPopup("Текущее местоположение");
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
  if(!navigator.geolocation){showToast("Браузер не поддерживает геолокацию.");return;}
  if(!window.isSecureContext){showToast("Для GPS требуется защищённое соединение HTTPS.");}
  $("locationStatus").textContent="Запрос разрешения…";
  navigator.geolocation.getCurrentPosition(pos=>{
    const c=pos.coords;
    data.location={lat:c.latitude,lng:c.longitude,accuracy:c.accuracy,time:new Date().toISOString()};
    saveData();
    $("locationStatus").textContent="Получено";$("latitude").textContent=c.latitude.toFixed(6);$("longitude").textContent=c.longitude.toFixed(6);
    $("accuracy").textContent="±"+Math.round(c.accuracy)+" м";$("locationTime").textContent=nowText();$("openMapLink").disabled=false;
    initMap(); if(map){map.setView([c.latitude,c.longitude],16);if(marker)marker.setLatLng([c.latitude,c.longitude]);else marker=L.marker([c.latitude,c.longitude]).addTo(map).bindPopup("Текущее местоположение");}
    initMiniMap();if(miniMap){if(miniMarker)miniMarker.setLatLng([c.latitude,c.longitude]);else miniMarker=L.marker([c.latitude,c.longitude]).addTo(miniMap);miniMap.setView([c.latitude,c.longitude],13);}
    showToast("Местоположение получено.");logEvent("Обновлена геолокация","Координаты получены из браузера телефона");
  },err=>{
    $("locationStatus").textContent="Недоступно";
    const messages={1:"Доступ к геолокации запрещён.",2:"Не удалось определить координаты.",3:"Время ожидания геолокации истекло."};
    showToast(messages[err.code]||"Не удалось получить местоположение.");
  },{enableHighAccuracy:true,timeout:15000,maximumAge:10000});
}
$("getLocation").addEventListener("click",getLocation);
$("getLocationMini").addEventListener("click",()=>{navigate("location");setTimeout(getLocation,150);});
$("openMapLink").addEventListener("click",()=>{if(data.location)window.open(`https://www.google.com/maps?q=${data.location.lat},${data.location.lng}`,"_blank","noopener");});
$("clearEvents").addEventListener("click",()=>{if(confirm("Очистить всю историю событий?")){data.events=[];saveData();renderEvents();showToast("История очищена.");}});

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
  }catch(e){showToast("Нажмите ещё раз, чтобы включить звук браузера.");}
}
document.querySelectorAll(".sound-test").forEach(b=>b.addEventListener("click",()=>{playSound(b.dataset.sound);showToast("Воспроизводится: +b.dataset.sound+");}));

function populateForms(){
  $("fullName").value=data.profile.name||"";$("age").value=data.profile.age||"";
  $("deviceId").value=data.profile.deviceId||"FG-ESP32-001";$("medicalInfo").value=data.profile.medicalInfo||"";
  $("contactName").value=data.contact.name||"";$("contactPhone").value=data.contact.phone||"";$("contactRelation").value=data.contact.relation||"";
  if(data.location){
    $("locationStatus").textContent="Сохранена";$("latitude").textContent=data.location.lat.toFixed(6);$("longitude").textContent=data.location.lng.toFixed(6);
    $("accuracy").textContent="±"+Math.round(data.location.accuracy)+" м";$("locationTime").textContent=new Date(data.location.time).toLocaleString("ru-RU");$("openMapLink").disabled=false;
  }
}
populateForms();updateDashboard();renderEvents();initMiniMap();
if(data.location){setTimeout(()=>{const p=[data.location.lat,data.location.lng];if(miniMap){miniMap.setView(p,13);miniMarker=L.marker(p).addTo(miniMap);}},200);}
