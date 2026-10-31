/*
 FallGuard ESP32 DevKit V1
 MPU6050 SDA=22, SCL=21; buzzer=14; button=GPIO4 to GND.
 BLE UART service compatible with the FallGuard browser dashboard.
*/
#include <Arduino.h>
#include <Wire.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <math.h>

const int SDA_PIN=22,SCL_PIN=21,BUZZER=14,BUTTON=4;
const uint8_t MPU=0x68;
#define UUID_SERVICE "6e400001-b5a3-f393-e0a9-e50e24dcca9e"
#define UUID_RX      "6e400002-b5a3-f393-e0a9-e50e24dcca9e"
#define UUID_TX      "6e400003-b5a3-f393-e0a9-e50e24dcca9e"
BLECharacteristic *txChar=nullptr;
bool bleConnected=false,mpuOK=false;
enum Mode{NORMAL,FALL_ALARM,SOS_ACTIVE}; Mode mode=NORMAL;
float ax=0,ay=0,az=1,gx=0,gy=0,gz=0,totalG=1;
unsigned long lastRead=0,lastSend=0,fallStart=0,freefallTime=0,lastBuzz=0,lastDebounce=0,pressedAt=0;
bool freefall=false,buzzerOn=false,buttonHeld=false,longDone=false;
int previousRead=HIGH,stableRead=HIGH,beepCount=0;

const char* modeName(){return mode==FALL_ALARM?"FALL_ALARM":mode==SOS_ACTIVE?"SOS_ACTIVE":"NORMAL";}
void sendJSON(const String &s){Serial.println(s);if(bleConnected&&txChar){txChar->setValue(s.c_str());txChar->notify();}}
void event(const char* name){sendJSON(String("{\"type\":\"event\",\"event\":\"")+name+"\"}");}
void fallAlarm(){if(mode!=NORMAL)return;mode=FALL_ALARM;fallStart=millis();beepCount=0;lastBuzz=0;event("FALL_ALARM");}
void cancelMode(){if(mode==NORMAL)return;mode=NORMAL;noTone(BUZZER);event("CANCELLED");}
void sos(){if(mode==SOS_ACTIVE)return;mode=SOS_ACTIVE;beepCount=0;lastBuzz=0;event("SOS_ACTIVE");}

class ServerCB:public BLEServerCallbacks{
 void onConnect(BLEServer*)override{bleConnected=true;event("BLE_CONNECTED");}
 void onDisconnect(BLEServer*)override{bleConnected=false;BLEDevice::startAdvertising();}
};
class RxCB:public BLECharacteristicCallbacks{
 void onWrite(BLECharacteristic*c)override{
  String s=c->getValue().c_str();s.trim();
  if(s.indexOf("CANCEL")>=0||s.indexOf("RESET")>=0)cancelMode();
  else if(s.indexOf("SOS")>=0)sos();
 }
};
bool regWrite(uint8_t r,uint8_t v){Wire.beginTransmission(MPU);Wire.write(r);Wire.write(v);return Wire.endTransmission()==0;}
bool readMPU(){
 Wire.beginTransmission(MPU);Wire.write(0x3B);if(Wire.endTransmission(false)!=0)return false;
 if(Wire.requestFrom(MPU,(uint8_t)14,(uint8_t)true)!=14)return false;
 int16_t ra=(Wire.read()<<8)|Wire.read(),rb=(Wire.read()<<8)|Wire.read(),rc=(Wire.read()<<8)|Wire.read();
 Wire.read();Wire.read();
 int16_t rgx=(Wire.read()<<8)|Wire.read(),rgy=(Wire.read()<<8)|Wire.read(),rgz=(Wire.read()<<8)|Wire.read();
 ax=ra/4096.0f;ay=rb/4096.0f;az=rc/4096.0f;
 gx=rgx/65.5f;gy=rgy/65.5f;gz=rgz/65.5f;totalG=sqrtf(ax*ax+ay*ay+az*az);return true;
}
void detectFall(){
 if(!mpuOK||mode!=NORMAL)return;unsigned long t=millis();
 if(totalG<0.55f){freefall=true;freefallTime=t;}
 if(freefall&&t-freefallTime<1500&&totalG>2.8f){freefall=false;fallAlarm();}
 if(freefall&&t-freefallTime>=1500)freefall=false;
 if(totalG>3.6f)fallAlarm();
}
void buttonTask(){
 int r=digitalRead(BUTTON);if(r!=previousRead)lastDebounce=millis();
 if(millis()-lastDebounce>35&&r!=stableRead){
  stableRead=r;
  if(stableRead==LOW){buttonHeld=true;longDone=false;pressedAt=millis();}
  else if(buttonHeld){if(!longDone&&millis()-pressedAt<3000&&(mode==FALL_ALARM||mode==SOS_ACTIVE))cancelMode();buttonHeld=false;}
 }
 previousRead=r;
 if(buttonHeld&&!longDone&&millis()-pressedAt>=3000){longDone=true;sos();}
}
void buzzerTask(){
 if(mode==NORMAL){noTone(BUZZER);buzzerOn=false;return;}
 unsigned long t=millis(),interval=mode==FALL_ALARM?250:160;if(t-lastBuzz<interval)return;lastBuzz=t;
 if(buzzerOn){noTone(BUZZER);buzzerOn=false;}
 else{tone(BUZZER,mode==FALL_ALARM?(beepCount%2?760:1100):(beepCount%3?900:1300));buzzerOn=true;beepCount++;}
}
void setup(){
 Serial.begin(115200);pinMode(BUZZER,OUTPUT);pinMode(BUTTON,INPUT_PULLUP);noTone(BUZZER);
 Wire.begin(SDA_PIN,SCL_PIN);Wire.setClock(400000);
 if(regWrite(0x6B,0x00)){regWrite(0x1C,0x10);regWrite(0x1B,0x08);Wire.beginTransmission(MPU);Wire.write(0x75);if(Wire.endTransmission(false)==0&&Wire.requestFrom(MPU,(uint8_t)1)==1){uint8_t who=Wire.read();mpuOK=(who==0x68||who==0x69);}}
 Serial.println(mpuOK?"MPU6050 ready":"MPU6050 not found; check wiring");
 BLEDevice::init("FallGuard-ESP32");BLEDevice::setMTU(185);
 BLEServer*s=BLEDevice::createServer();s->setCallbacks(new ServerCB());
 BLEService*svc=s->createService(UUID_SERVICE);
 txChar=svc->createCharacteristic(UUID_TX,BLECharacteristic::PROPERTY_NOTIFY);txChar->addDescriptor(new BLE2902());
 BLECharacteristic*rx=svc->createCharacteristic(UUID_RX,BLECharacteristic::PROPERTY_WRITE|BLECharacteristic::PROPERTY_WRITE_NR);rx->setCallbacks(new RxCB());
 svc->start();BLEAdvertising*adv=BLEDevice::getAdvertising();adv->addServiceUUID(UUID_SERVICE);adv->setScanResponse(true);BLEDevice::startAdvertising();
 Serial.println("BLE ready: FallGuard-ESP32");
}
void loop(){
 unsigned long t=millis();
 if(mpuOK&&t-lastRead>=40){lastRead=t;if(readMPU())detectFall();}
 buttonTask();buzzerTask();
 if(mode==FALL_ALARM&&t-fallStart>=15000)sos();
 if(t-lastSend>=250){lastSend=t;char out[240];snprintf(out,sizeof(out),"{\"type\":\"status\",\"state\":\"%s\",\"ax\":%.3f,\"ay\":%.3f,\"az\":%.3f,\"gx\":%.1f,\"gy\":%.1f,\"gz\":%.1f,\"g\":%.3f}",modeName(),ax,ay,az,gx,gy,gz,totalG);sendJSON(out);}
 delay(2);
}