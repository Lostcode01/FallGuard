# FallGuard — local prototype

Responsive dashboard and ESP32 Bluetooth integration for the FallGuard fall-detection prototype.

## Included

- Dashboard, user profile, demonstration contact, browser GPS map and event history.
- Local HTTPS server for a Windows PC and Android phone on the same Wi-Fi.
- Web Bluetooth connection to the ESP32 DevKit V1.
- Live MPU6050 acceleration values and device state.
- Website buttons to cancel a fall alarm or start a demonstration SOS.
- Physical button: short press cancels an active alarm; hold for 3 seconds to activate SOS.
- ESP32 buzzer alert; a fall alarm escalates to the SOS demonstration state after 15 seconds.

## Requirements

- Windows 10/11 and Node.js available in PowerShell.
- Chrome or Edge on Windows; Chrome on Android.
- ESP32 DevKit V1 and MPU6050.
- PC and phone on the same Wi-Fi network.

## First-time HTTPS setup

1. Open this folder in VS Code.
2. Open PowerShell in the project folder.
3. Run:

   ```powershell
   Set-ExecutionPolicy -Scope Process Bypass
   .\setup-local.ps1
   ```

4. The script installs mkcert using winget if necessary, creates a local HTTPS certificate and starts the server.
5. On the PC, open `https://localhost:8443`.
6. Copy `rootCA.crt` from this folder to your Android phone.
7. Install that certificate on Android as a CA certificate. The menu is usually **Settings → Security → Encryption & credentials → Install a certificate → CA certificate**; wording varies by Android version.
8. Open the phone URL printed by the script, such as `https://192.168.1.20:8443`.

Only install the CA certificate that you generated on your own PC. Do not share the private key in `certs/`.

## Starting it later

In PowerShell, from this folder:

```powershell
npm start
```

Keep the window open while using the website. Press Ctrl+C to stop the server. If Windows Firewall asks, allow Node.js on your **Private network**. If the PC's local IP changes, run `.\setup-local.ps1` again.

## ESP32 firmware

Open `firmware/FallGuard_ESP32.ino` in Arduino IDE. Select your ESP32 DevKit V1 board and upload the sketch. It uses the ESP32 Arduino core BLE library and built-in Wire library; no separate MPU6050 library is needed.

| Component | ESP32 pin |
|---|---|
| MPU6050 SDA | GPIO 22 |
| MPU6050 SCL | GPIO 21 |
| Buzzer signal | GPIO 14 |
| Pushbutton | GPIO 4 and GND |
| MPU6050 GND | GND |
| MPU6050 VCC | 3.3V |

The firmware advertises as `FallGuard-ESP32`. Click **Connect ESP32** in the dashboard and select it. A BLE peripheral generally has one active browser connection in this setup: disconnect on the PC before connecting from the phone.

## Browser compatibility

Use Chrome or Edge on Windows, and Chrome on Android. Web Bluetooth requires HTTPS and a user gesture to start pairing. Firefox and Safari are not supported by this Bluetooth workflow.

## Limitations and safety

- This is a prototype demonstration, not a certified medical or emergency system.
- The fall-detection thresholds are initial test values, not clinically validated. Test carefully and tune them using recorded sensor data.
- SOS is a demonstration only. No emergency services are contacted automatically. Use only non-emergency test phone numbers.
- Profile, event history and GPS data are stored in that browser's local storage; they do not synchronize between PC and phone.
- The PC must remain powered on with the local server running for the phone to open the site.
- The map uses OpenStreetMap tiles and Leaflet from public internet resources; the dashboard server itself is local.
