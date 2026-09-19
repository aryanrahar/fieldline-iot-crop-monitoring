/*
  Fieldline ESP32 reference firmware.
  Hardware: ESP32 + DHT22 + capacitive soil sensor + GPS.
  Provision WIFI_PASSWORD and DEVICE_API_KEY outside source control before flashing.
*/
#include <WiFi.h>
#include <HTTPClient.h>
#include <DHT.h>
#include <TinyGPSPlus.h>
#include <time.h>

#define DHT_PIN 4
#define DHT_TYPE DHT22
#define SOIL_PIN 34
#define GPS_RX 16
#define GPS_TX 17

const char* WIFI_SSID = "YOUR_WIFI";
const char* WIFI_PASSWORD = "YOUR_PASSWORD";
const char* API_URL = "https://YOUR_PUBLIC_HOST/api/v1/readings";
const char* DEVICE_API_KEY = "YOUR_DEVICE_API_KEY";
const int SOIL_DRY_RAW = 3300;
const int SOIL_WET_RAW = 1200;

DHT dht(DHT_PIN, DHT_TYPE);
TinyGPSPlus gps;
HardwareSerial gpsSerial(2);

String isoTimestamp() {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) return "1970-01-01T00:00:00Z";
  char value[25];
  strftime(value, sizeof(value), "%Y-%m-%dT%H:%M:%SZ", &timeinfo);
  return String(value);
}

void connectWifi() {
  if (WiFi.status() == WL_CONNECTED) return;
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  unsigned long started = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - started < 15000) {
    delay(500);
  }
}

void setup() {
  Serial.begin(115200);
  dht.begin();
  gpsSerial.begin(9600, SERIAL_8N1, GPS_RX, GPS_TX);
  connectWifi();
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");
}

void loop() {
  while (gpsSerial.available()) gps.encode(gpsSerial.read());
  connectWifi();

  float temperature = dht.readTemperature();
  float humidity = dht.readHumidity();
  int rawSoil = analogRead(SOIL_PIN);
  float soil = constrain(map(rawSoil, SOIL_DRY_RAW, SOIL_WET_RAW, 0, 100), 0, 100);

  if (!isnan(temperature) && !isnan(humidity) && WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.setTimeout(5000);
    http.begin(API_URL);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("X-Device-Key", DEVICE_API_KEY);
    String payload = "{\"deviceId\":\"field-esp32-01\",\"timestamp\":\"" + isoTimestamp() +
      "\",\"sensors\":{\"soilMoisture\":" + String(soil) + ",\"temperature\":" + String(temperature) +
      ",\"humidity\":" + String(humidity) + ",\"battery\":100},\"gps\":{\"latitude\":" +
      String(gps.location.isValid() ? gps.location.lat() : 29.9695, 6) + ",\"longitude\":" +
      String(gps.location.isValid() ? gps.location.lng() : 76.8783, 6) + "}}";
    int status = http.POST(payload);
    Serial.printf("Telemetry POST status: %d\n", status);
    http.end();
  }
  delay(10000);
}
