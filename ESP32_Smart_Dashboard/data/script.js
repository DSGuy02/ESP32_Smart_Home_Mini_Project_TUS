let socket;

function connectWebSocket() {
  const wsUrl = `ws://${window.location.hostname}:81/`;
  socket = new WebSocket(wsUrl);

  socket.onopen = () => console.log("WebSocket connected");
  socket.onclose = () => {
    console.log("WebSocket disconnected, retrying...");
    setTimeout(connectWebSocket, 2000);
  };

  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    updateDashboard(data);
  };
}

function updateDashboard(data) {
  // Temperature
  const tempDeg = -90 + (data.temperature / 50) * 180;
  document.getElementById('tempNeedle').style.transform = `rotate(${tempDeg}deg)`;
  document.getElementById('tempValue').textContent = data.temperature.toFixed(1) + " °C";

  // Humidity
  const humDeg = -90 + (data.humidity / 100) * 180;
  document.getElementById('humNeedle').style.transform = `rotate(${humDeg}deg)`;
  document.getElementById('humValue').textContent = data.humidity.toFixed(1) + " %";

  // Motion
  const motionCircle = document.getElementById('motionCircle');
  if (data.motion) motionCircle.classList.add('active');
  else motionCircle.classList.remove('active');
}

function toggleLED() {
  fetch('/led');
}

function activateBuzzer() {
  fetch('/buzz');
}

// === Theme Handling ===
function applyTheme(theme) {
  document.body.classList.toggle('light', theme === 'light');
  const btn = document.getElementById('themeToggle');
  btn.textContent = theme === 'light' ? '🌙' : '☀️';
}

function toggleTheme() {
  const current = localStorage.getItem('theme') || 'dark';
  const newTheme = current === 'dark' ? 'light' : 'dark';
  localStorage.setItem('theme', newTheme);
  applyTheme(newTheme);
}

function loadTheme() {
  const saved = localStorage.getItem('theme') || 'dark';
  applyTheme(saved);
}

window.addEventListener('load', () => {
  loadTheme();
  connectWebSocket();
});
