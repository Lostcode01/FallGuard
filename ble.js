(() => {
  const SERVICE = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
  const RX = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";
  const TX = "6e400003-b5a3-f393-e0a9-e50e24dcca9e";
  const $ = id => document.getElementById(id);
  let device=null, tx=null, rx=null, connected=false, buffer="", lastState="";
  function status(label, help){$("bleState").textContent=label;$("bleHelp").textContent=help;}
  function disconnect(message){
    connected=false;device=null;tx=null;rx=null;
    $("deviceConnectBtn").textContent="Подключить ESP32";\n    if($("hardwareBuzzerTest"))$("hardwareBuzzerTest").disabled=true;\n    if($("hardwareMpuTest"))$("hardwareMpuTest").disabled=true;
    $("deviceStatus").textContent="Не подключено";
    $("bleDeviceName").textContent="Устройство не подключено";
    status("НЕ ПОДКЛЮЧЕНО",message||"Включите ESP32 и расположите его рядом.");
  }
  function stateChange(s){
    if(!s||s===lastState)return;lastState=s;
    $("bleDeviceState").textContent=s.replaceAll("_"," ");
    if(s==="FALL_ALARM"){startFall();showToast("Fall alarm received from ESP32.");}
    if(s==="SOS_ACTIVE")activateSOS("ESP32 wearable device");
    if(s==="CANCELLED"||s==="NORMAL"){
      if(!$("countdown").hidden)cancelFall();
      if(s==="NORMAL"){setStatus("normal","System operating normally","ESP32 is connected and monitoring movement.","NORMAL");$("monitorStatus").textContent="Monitoring";}
    }
  }
  function packet(p){
    if(p.type==="status"){
      $("bleAccel").textContent=[p.ax,p.ay,p.az].map(v=>Number(v).toFixed(2)).join(" / ")+" g";
      $("bleMagnitude").textContent=Number(p.g||0).toFixed(2)+" g";\n      $("bleButtonState").textContent=p.button?"Нажата":"Не нажата";\n      if(p.mpu===false){$("bleAccel").textContent="Нет данных";$("bleMagnitude").textContent="—";$("bleDeviceState").textContent="MPU6050 не найден";}
      stateChange(p.state);
      $("deviceLastSeen").textContent="Last data: "+new Date().toLocaleTimeString();
    } else if(p.type==="event"){
      stateChange(p.event);
      logEvent("Device "+(p.event||"event"),"Received from ESP32 wearable","Hardware");
    }
  }
  function notify(e){
    buffer+=new TextDecoder().decode(new Uint8Array(e.target.value.buffer,e.target.value.byteOffset,e.target.value.byteLength));
    let n;while((n=buffer.indexOf("\n"))>=0){const line=buffer.slice(0,n).trim();buffer=buffer.slice(n+1);if(line){try{packet(JSON.parse(line));}catch(err){console.warn("Bad ESP32 JSON",line);}}}
    if(buffer.length>4096)buffer="";
  }
  async function connect(){
    if(!window.isSecureContext){showToast("Bluetooth needs the local HTTPS address.");return;}
    if(!navigator.bluetooth){status("НЕ ПОДДЕРЖИВАЕТСЯ","Используйте Chrome или Edge на Windows либо Chrome на Android.");showToast("Этот браузер не поддерживает Bluetooth.");return;}
    try{
      $("deviceConnectBtn").disabled=true;status("ПОИСК","Выберите FallGuard-ESP32 в списке Bluetooth.");
      device=await navigator.bluetooth.requestDevice({filters:[{namePrefix:"FallGuard"}],optionalServices:[SERVICE]});
      device.addEventListener("gattserverdisconnected",()=>disconnect("Bluetooth disconnected. You can reconnect."));
      const server=await device.gatt.connect();
      const service=await server.getPrimaryService(SERVICE);
      tx=await service.getCharacteristic(TX);rx=await service.getCharacteristic(RX);
      await tx.startNotifications();tx.addEventListener("characteristicvaluechanged",notify);
      connected=true;$("deviceConnectBtn").textContent="Отключить";
      $("deviceStatus").textContent="Connected";$("bleDeviceName").textContent=device.name||"FallGuard ESP32";
      $("deviceStatus").nextElementSibling.innerHTML='<i class="mini-dot green"></i> ESP32 connected by BLE';
      status("ПОДКЛЮЧЕНО","Получаем данные MPU6050 в реальном времени.");showToast("ESP32 подключён.");
    }catch(e){console.error(e);if(device&&device.gatt&&device.gatt.connected)device.gatt.disconnect();disconnect(e.message||"Connection failed.");if(e.name!=="NotFoundError")showToast("Bluetooth error: "+(e.message||e.name));}
    finally{$("deviceConnectBtn").disabled=false;\n      $("hardwareBuzzerTest").disabled=!connected;\n      $("hardwareMpuTest").disabled=!connected;}
  }
  async function command(cmd){
    if(!connected||!rx)return;
    try{const bytes=new TextEncoder().encode(JSON.stringify({cmd})+"\n");await rx.writeValueWithResponse(bytes);}
    catch(e){console.error(e);showToast("Could not send command to ESP32.");}
  }
  window.fallguardSendCommand=command;\n  $("hardwareBuzzerTest").addEventListener("click",()=>command("BUZZER_TEST"));\n  $("hardwareMpuTest").addEventListener("click",()=>command("MPU_TEST"));\n  $("deviceConnectBtn").addEventListener("click",()=>{if(connected&&device&&device.gatt.connected){device.gatt.disconnect();disconnect("Отключено пользователем.");$("hardwareBuzzerTest").disabled=true;$("hardwareMpuTest").disabled=true;}else connect();});
  $("cancelAlarm").addEventListener("click",()=>command("CANCEL"));
  $("sosButton").addEventListener("click",()=>command("SOS"));
  window.addEventListener("beforeunload",()=>{if(device&&device.gatt&&device.gatt.connected)device.gatt.disconnect();});
  if(!navigator.bluetooth)status("НЕ ПОДДЕРЖИВАЕТСЯ","Откройте сайт в Chrome или Edge на Windows либо Chrome на Android.");
})();