#include <WiFi.h>
#include <WebServer.h>
#include <WebSocketsServer.h>
#include <DHT.h>
#include <LittleFS.h>
#define SPIFFS LittleFS

#define DHTPIN 4
#define DHTTYPE DHT11
#define LED_PIN 2
#define BUZZER_PIN 5
#define PIR_PIN 19

const char* ssid = "D.S CE 3";
const char* password = "01ad3j!5";

WebServer server(80);
WebSocketsServer webSocket = WebSocketsServer(81);
DHT dht(DHTPIN, DHTTYPE);

unsigned long lastRead = 0;
float temperature = 0.0;
float humidity = 0.0;
bool motionDetected = false;

// State tracking
bool ledState = false;
bool buzzerPlaying = false;
unsigned long buzzerEnd = 0;
int buzzerFreq = 1000;
int buzzerDur = 500;
bool dummyMode = false;

// --- Send JSON data to all connected WebSocket clients ---
void broadcastData() {
  String json = "{";
  json += "\"temperature\":" + String(temperature, 1) + ",";
  json += "\"humidity\":" + String(humidity, 1) + ",";
  json += "\"motion\":" + String(motionDetected ? 1 : 0) + ",";
  json += "\"led\":" + String(ledState ? 1 : 0) + ",";
  json += "\"buzzerPlaying\":" + String(buzzerPlaying ? 1 : 0) + ",";
  json += "\"buzzerFreq\":" + String(buzzerFreq) + ",";
  json += "\"buzzerDur\":" + String(buzzerDur) + ",";
  json += "\"dummyMode\":" + String(dummyMode ? 1 : 0);
  json += "}";
  webSocket.broadcastTXT(json);
}

// --- WebSocket Event Handler ---
void onWebSocketEvent(uint8_t num, WStype_t type, uint8_t * payload, size_t length) {
  if (type == WStype_CONNECTED) {
    Serial.printf("Client %u connected\n", num);
    broadcastData();
  } else if (type == WStype_TEXT) {
    String msg = String((char*)payload);
    Serial.printf("WS message: %s\n", msg.c_str());
    if (msg.indexOf("\"cmd\":\"led\"") >= 0) {
      ledState = !ledState;
      digitalWrite(LED_PIN, ledState ? HIGH : LOW);
      broadcastData();
    } else if (msg.indexOf("\"cmd\":\"buzz\"") >= 0) {
      int f = -1; long d = -1;
      int idxF = msg.indexOf("\"freq\":");
      if (idxF >= 0) f = msg.substring(idxF + 7).toInt();
      int idxD = msg.indexOf("\"dur\":");
      if (idxD >= 0) d = msg.substring(idxD + 6).toInt();
      if (f > 0) buzzerFreq = f;
      if (d > 0) buzzerDur = d;
      tone(BUZZER_PIN, buzzerFreq, buzzerDur);
      buzzerPlaying = true;
      buzzerEnd = millis() + (unsigned long)buzzerDur;
      broadcastData();
    } else if (msg.indexOf("\"cmd\":\"dummy\"") >= 0) {
      if (msg.indexOf("\"on\":1") >= 0) dummyMode = true;
      else if (msg.indexOf("\"on\":0") >= 0) dummyMode = false;
      broadcastData();
    }
  }
}

void handleLED() {
  ledState = !ledState;
  digitalWrite(LED_PIN, ledState ? HIGH : LOW);
  server.send(200, "application/json", String("{\"led\":") + (ledState? "1":"0") + "}");
  broadcastData();
}

void handleBuzz() {
  if (server.hasArg("freq")) buzzerFreq = server.arg("freq").toInt();
  if (server.hasArg("dur")) buzzerDur = server.arg("dur").toInt();
  tone(BUZZER_PIN, buzzerFreq, buzzerDur);
  buzzerPlaying = true;
  buzzerEnd = millis() + (unsigned long)buzzerDur;
  server.send(200, "application/json", String("{\"buzzerPlaying\":1,\"freq\":") + String(buzzerFreq) + ",\"dur\":" + String(buzzerDur) + "}");
  broadcastData();
}

void handleStatus() {
  String json = "{";
  json += "\"temperature\":" + String(temperature, 1) + ",";
  json += "\"humidity\":" + String(humidity, 1) + ",";
  json += "\"motion\":" + String(motionDetected ? 1 : 0) + ",";
  json += "\"led\":" + String(ledState ? 1 : 0) + ",";
  json += "\"buzzerPlaying\":" + String(buzzerPlaying ? 1 : 0) + ",";
  json += "\"buzzerFreq\":" + String(buzzerFreq) + ",";
  json += "\"buzzerDur\":" + String(buzzerDur) + ",";
  json += "\"dummyMode\":" + String(dummyMode ? 1 : 0);
  json += "}";
  server.send(200, "application/json", json);
}

void handleSetDummy() {
  if (server.hasArg("on")) {
    String a = server.arg("on");
    dummyMode = (a == "1" || a == "true");
    server.send(200, "text/plain", dummyMode ? "Dummy ON" : "Dummy OFF");
  } else {
    server.send(400, "text/plain", "Missing 'on' arg (0 or 1)");
  }
  broadcastData();
}

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(PIR_PIN, INPUT);
  dht.begin();

  if (!SPIFFS.begin(true)) {
    Serial.println("SPIFFS Mount Failed");
    return;
  }

  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi...");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nConnected!");
  Serial.print("ESP32 IP Address: ");
  Serial.println(WiFi.localIP());

  server.serveStatic("/", SPIFFS, "/index.html");
  server.serveStatic("/style.css", SPIFFS, "/style.css");
  server.serveStatic("/script.js", SPIFFS, "/script.js");

  server.on("/led", handleLED);
  server.on("/buzz", handleBuzz);
  server.on("/status", handleStatus);
  server.on("/setDummy", handleSetDummy);

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
    if (dummyMode) {
      float t = (now / 1000.0);
      temperature = 20.0 + 5.0 * sin(t / 30.0);
      humidity = 40.0 + 20.0 * cos(t / 45.0);
      motionDetected = (int)(sin(t / 10.0) > 0.6); // dummy motion pulses
    } else {
      temperature = dht.readTemperature();
      humidity = dht.readHumidity();
      motionDetected = digitalRead(PIR_PIN);
    }
    broadcastData();
  }

  if (buzzerPlaying && millis() > buzzerEnd) {
    buzzerPlaying = false;
    broadcastData();
  }
}
