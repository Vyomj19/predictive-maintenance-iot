#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <DHT.h>

// ===== WIFI INFO =====
const char* ssid = "phone";
const char* password = "youknowit243";

// Use your computer's IPv4 address from ipconfig
const char* serverUrl = "http://172.20.10.3:8000/sensor-data";

// ===== DHT11 =====
#define DHTPIN 4
#define DHTTYPE DHT11
DHT dht(DHTPIN, DHTTYPE);

// ===== MPU6050 =====
Adafruit_MPU6050 mpu;

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("Starting system...");
  

  // Start DHT11
  dht.begin();
  Serial.println("DHT11 started.");

  // Start MPU6050
  Wire.begin(21, 22); // SDA = GPIO21, SCL = GPIO22

  if (!mpu.begin()) {
    Serial.println("Failed to find MPU6050 chip!");
    while (1) {
      delay(10);
    }
  }

  Serial.println("MPU6050 initialized.");

  // Connect WiFi
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println();
  Serial.println("WiFi connected!");
  Serial.print("ESP32 IP: ");
  Serial.println(WiFi.localIP());
}

void loop() {
  // Read DHT11
  float temperature = dht.readTemperature();
  float humidity = dht.readHumidity();

  if (isnan(temperature) || isnan(humidity)) {
    Serial.println("DHT11 read failed!");
  }

  // Read MPU6050
  sensors_event_t a, g, temp;
  mpu.getEvent(&a, &g, &temp);

  // Build JSON
  String json = "{";
  json += "\"machine_id\":\"motor_1\",";
  json += "\"temperature\":" + String(temperature) + ",";
  json += "\"humidity\":" + String(humidity) + ",";
  json += "\"vibration_x\":" + String(a.acceleration.x) + ",";
  json += "\"vibration_y\":" + String(a.acceleration.y) + ",";
  json += "\"vibration_z\":" + String(a.acceleration.z);
  json += "}";

  // Print sensor data
  Serial.println("---- SENSOR DATA ----");
  Serial.println(json);

  // Send to backend
  Serial.println("About to send HTTP...");

  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;

    http.begin(serverUrl);
    http.addHeader("Content-Type", "application/json");

    int response = http.POST(json);

    Serial.print("HTTP Response: ");
    Serial.println(response);

    if (response > 0) {
      String responseBody = http.getString();
      Serial.print("Backend says: ");
      Serial.println(responseBody);
    } else {
      Serial.println("HTTP request failed.");
    }

    http.end();
  } else {
    Serial.println("WiFi not connected.");
  }

  delay(5000);
}