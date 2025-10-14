#include <WiFi.h>
#include <WebServer.h>
#include <DHT.h>
#include <SPIFFS.h>

#define DHTPIN 4
#define DHTTYPE DHT11
#define LED_PIN 2
#define BUZZER_PIN 5
#define PIR_PIN 13

const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

WebServer server(80);
DHT dht(DHTPIN, DHTTYPE);

void handleData() {
  float temp = dht.readTemperature();
  int motion = digitalRead(PIR_PIN);
  String json = "{\"temperature\":" + String(temp) + ",\"motion\":" + String(motion) + "}";
  server.send(200, "application/json", json);
}

void handleLED() {
  digitalWrite(LED_PIN, !digitalRead(LED_PIN));
  server.send(200, "text/plain", "LED toggled");
}

void handleBuzz() {
  tone(BUZZER_PIN, 1000, 500);
  server.send(200, "text/plain", "Buzz!");
}

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(PIR_PIN, INPUT);
  dht.begin();

  // Mount SPIFFS
  if (!SPIFFS.begin(true)) {
    Serial.println("SPIFFS Mount Failed");
    return;
  }

  // Connect WiFi
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi...");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nConnected!");
  Serial.print("ESP32 IP Address: ");
  Serial.println(WiFi.localIP());

  // Serve static files from SPIFFS
  server.serveStatic("/", SPIFFS, "/index.html");
  server.serveStatic("/style.css", SPIFFS, "/style.css");
  server.serveStatic("/script.js", SPIFFS, "/script.js");

  // API routes
  server.on("/data", handleData);
  server.on("/led", handleLED);
  server.on("/buzz", handleBuzz);

  server.begin();
  Serial.println("HTTP server started");
}

void loop() {
  server.handleClient();
}

