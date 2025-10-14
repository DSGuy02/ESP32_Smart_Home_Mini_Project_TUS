#include <WiFi.h>
#include <WebServer.h>
#include <WebSocketsServer.h>
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
WebSocketsServer webSocket = WebSocketsServer(81);
DHT dht(DHTPIN, DHTTYPE);

unsigned long lastRead = 0;
float temperature = 0.0;
float humidity = 0.0;
bool motionDetected = false;

// --- Send JSON data to all connected WebSocket clients ---
void broadcastData() {
  String json = "{\"temperature\":" + String(temperature, 1) +
  ",\"humidity\":" + String(humidity, 1) +
  ",\"motion\":" + String(motionDetected ? 1 : 0) + "}";
  webSocket.broadcastTXT(json);
}

// --- WebSocket Event Handler ---
void onWebSocketEvent(uint8_t num, WStype_t type, uint8_t * payload, size_t length) {
  if (type == WStype_CONNECTED) {
    Serial.printf("Client %u connected\n", num);
    // Send current data upon new connection
    broadcastData();
  }
}

// --- API Handlers ---
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

  // Serve static files
  server.serveStatic("/", SPIFFS, "/index.html");
  server.serveStatic("/style.css", SPIFFS, "/style.css");
  server.serveStatic("/script.js", SPIFFS, "/script.js");

  // API routes
  server.on("/led", handleLED);
  server.on("/buzz", handleBuzz);

  server.begin();
  webSocket.begin();
  webSocket.onEvent(onWebSocketEvent);

  Serial.println("HTTP + WebSocket server started");
}

void loop() {
  server.handleClient();
  webSocket.loop();

  unsigned long now = millis();
  if (now - lastRead > 2000) {
    lastRead = now;
    temperature = dht.readTemperature();
    humidity = dht.readHumidity();
    motionDetected = digitalRead(PIR_PIN);
    broadcastData();
  }
}
