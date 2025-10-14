#include <WiFi.h>
#include <WebServer.h>  // Use ESP32’s built-in web server library

// --- WiFi Credentials ---
const char* ssid = "D.S CE 3";
const char* password = "01ad3j!5";

// --- LED Pin ---
const int LED_PIN = 2;   // Built-in LED on many ESP32 boards (GPIO2)

// --- Web Server on port 80 ---
WebServer server(80);

// --- LED State Variable ---
bool ledState = false;

// --- HTML Page ---
String getHTMLPage() {
  String html = "<!DOCTYPE html><html>";
  html += "<head><title>ESP32 LED Control</title>";
  html += "<meta name='viewport' content='width=device-width, initial-scale=1'>";
  html += "<style>body{font-family:Arial;text-align:center;margin-top:50px;}";
  html += "button{padding:15px 30px;font-size:20px;}</style></head>";
  html += "<body><h2>ESP32 Web Server</h2>";
  html += "<p>LED Status: <b>" + String(ledState ? "ON" : "OFF") + "</b></p>";
  html += "<form action=\"/toggle\" method=\"POST\">";
  html += "<button type=\"submit\">" + String(ledState ? "Turn OFF" : "Turn ON") + "</button>";
  html += "</form></body></html>";
  return html;
}

// --- Handle Root Page ---
void handleRoot() {
  server.send(200, "text/html", getHTMLPage());
}

// --- Handle LED Toggle ---
void handleToggle() {
  ledState = !ledState;
  digitalWrite(LED_PIN, ledState ? HIGH : LOW);
  server.sendHeader("Location", "/");  // Redirect back to main page
  server.send(303);
}

// --- Setup Function ---
void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  // Connect to WiFi
  Serial.println();
  Serial.print("Connecting to WiFi: ");
  Serial.println(ssid);
  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println();
  Serial.println("✅ WiFi connected!");
  Serial.print("ESP32 IP Address: ");
  Serial.println(WiFi.localIP());

  // Setup Web Server Routes
  server.on("/", handleRoot);
  server.on("/toggle", HTTP_POST, handleToggle);

  server.begin();
  Serial.println("🌐 Web server started!");
}

// --- Loop Function ---
void loop() {
  server.handleClient();
}