(() => {
  const SERVICE="6e400001-b5a3-f393-e0a9-e50e24dcca9e";
  const RX="6e400002-b5a3-f393-e0a9-e50e24dcca9e";
  const TX="6e400003-b5a3-f393-e0a9-e50e24dcca9e";
  const $=id=>document.getElementById(id);
  let device=null,tx=null,rx=null,connected=false,buffer="",lastState="";
  function status(label,help){$("bleState").textContent=label;$("bleHelp").textContent=help;}
  function setTestButtons(enabled){$("hardwareBuzzerTest").disabled=!enabled;$("hardwareMpuTest").disabled=!enabled;}
  function disconnect(message){
    connected=false;device=null;tx=null;rx=null;
    $("deviceConnectBtn").textContent="Подключить ESP32";
    $("deviceStatus").textContent="Не подключено";
    $("deviceStatus").nextElementSibling.innerHTML='<i class="mini-dot amber"></i> ESP32 не подключён';
    $("bleDeviceName").textContent="Устройство не подключено";
    $("deviceLastSeen").textContent="Нет данных";
    setTestButtons(false);
    status("НЕ ПОДКЛЮЧЕНО",message||"Включите ESP32 и расположите его рядом.");
  }
  function stateChange(s){
    if(!s||s===lastState)return;lastState=s;
    $("bleDeviceState").textContent=s.replaceAll("_"," ");
    if(s==="FALL_ALARM"){startFall();showToast("Обнаружено падение.");}
    if(s==="SOS_ACTIVE")activateSOS("ESP32");
    if(s==="CANCELLED"){
      if(!$("countdown").hidden)cancelFall();
      else{
        setStatus("normal","Тревога отменена","Устройство вернулось в режим мониторинга.","ОТМЕНЕНО");
        $("monitorStatus").textContent="Мониторинг";
      }
    }
    if(s==="NORMAL"){
      if(!$("countdown").hidden)cancelFall();
      setStatus("normal","Система работает нормально","ESP32 подключён и передаёт данные датчиков.","НОРМА");
      $("monitorStatus").textContent="Мониторинг";
    }
  }
  function packet(p){
    if(p.type==="status"){
      if(p.mpu){$("bleAccel").textContent=[p.ax,p.ay,p.az].map(v=>Number(v).toFixed(2)).join(" / ")+" g";$("bleMagnitude").textContent=Number(p.g||0).toFixed(2)+" g";}
      else{$("bleAccel").textContent="Нет данных";$("bleMagnitude").textContent="—";}
      $("bleButtonState").textContent=p.button?"Нажата":"Не нажата";
      if(p.mpu===false){
        $("bleDeviceState").textContent="MPU6050 не найден";
        setStatus("warning","MPU6050 не обнаружен","Проверьте питание датчика и линии SDA/SCL.","НЕТ ДАТЧИКА");
        $("monitorStatus").textContent="Нет данных";
      }else{
        stateChange(p.state);
      }
      $("deviceLastSeen").textContent="Последние данные: "+new Date().toLocaleTimeString();
    }else if(p.type==="event"){
      stateChange(p.event);
      if(p.event==="BUTTON_PRESSED")$("bleButtonState").textContent="Нажата";
      if(p.event==="BUTTON_RELEASED")$("bleButtonState").textContent="Не нажата";
      if(p.event==="BUZZER_TEST")showToast("Команда проверки зуммера отправлена.");
      if(p.event==="MPU_OK")showToast("MPU6050 отвечает.");
      if(p.event==="MPU_ERROR")showToast("MPU6050 не обнаружен. Проверьте подключение.");
      if(p.event!=="BLE_CONNECTED")logEvent("Устройство: "+(p.event||"событие"),"Получено от ESP32","Устройство");
    }
  }
  function notify(e){
    buffer+=new TextDecoder().decode(new Uint8Array(e.target.value.buffer,e.target.value.byteOffset,e.target.value.byteLength));
    let n;while((n=buffer.indexOf("\n"))>=0){const line=buffer.slice(0,n).trim();buffer=buffer.slice(n+1);if(line){try{packet(JSON.parse(line));}catch(err){console.warn("Некорректный пакет ESP32",line);}}}
    if(buffer.length>4096)buffer="";
  }
  async function command(cmd){
    if(!connected||!rx){showToast("Сначала подключите ESP32.");return;}
    try{const shortCommand=cmd==="BUZZER_TEST"?"BEEP":cmd==="MPU_TEST"?"MPU":cmd;const bytes=new TextEncoder().encode(JSON.stringify({c:shortCommand}));await rx.writeValueWithResponse(bytes);}
    catch(e){console.error(e);showToast("Не удалось отправить команду устройству.");}
  }
  async function connect(){
    if(!window.isSecureContext){showToast("Для Bluetooth откройте локальный сайт по HTTPS.");return;}
    if(!navigator.bluetooth){status("НЕ ПОДДЕРЖИВАЕТСЯ","Используйте Chrome или Edge на Windows либо Chrome на Android.");showToast("Этот браузер не поддерживает Bluetooth.");return;}
    try{
      $("deviceConnectBtn").disabled=true;status("ПОИСК","Выберите FallGuard-ESP32 в системном окне Bluetooth.");
      device=await navigator.bluetooth.requestDevice({filters:[{namePrefix:"FallGuard"}],optionalServices:[SERVICE]});
      device.addEventListener("gattserverdisconnected",()=>disconnect("Bluetooth отключён. Можно подключиться повторно."));
      const server=await device.gatt.connect(),service=await server.getPrimaryService(SERVICE);
      tx=await service.getCharacteristic(TX);rx=await service.getCharacteristic(RX);
      await tx.startNotifications();tx.addEventListener("characteristicvaluechanged",notify);
      connected=true;$("deviceConnectBtn").textContent="Отключить";
      $("deviceStatus").textContent="Подключено";
      $("deviceStatus").nextElementSibling.innerHTML='<i class="mini-dot green"></i> Связь по Bluetooth';
      $("bleDeviceName").textContent=device.name||"FallGuard ESP32";
      status("ПОДКЛЮЧЕНО","Получаем данные MPU6050 в реальном времени.");
      setTestButtons(true);showToast("ESP32 подключён.");
    }catch(e){
      console.error(e);if(device&&device.gatt&&device.gatt.connected)device.gatt.disconnect();
      disconnect(e.message||"Не удалось подключиться.");
      if(e.name!=="NotFoundError")showToast("Ошибка Bluetooth: "+(e.message||e.name));
    }finally{$("deviceConnectBtn").disabled=false;}
  }
  window.fallguardSendCommand=command;
  $("hardwareBuzzerTest").addEventListener("click",()=>command("BUZZER_TEST"));
  $("hardwareMpuTest").addEventListener("click",()=>command("MPU_TEST"));
  $("deviceConnectBtn").addEventListener("click",()=>{if(connected&&device&&device.gatt.connected){device.gatt.disconnect();disconnect("Отключено пользователем.");}else connect();});
  window.addEventListener("beforeunload",()=>{if(device&&device.gatt&&device.gatt.connected)device.gatt.disconnect();});
  if(!navigator.bluetooth)status("НЕ ПОДДЕРЖИВАЕТСЯ","Откройте сайт в Chrome или Edge на Windows либо Chrome на Android.");
})();