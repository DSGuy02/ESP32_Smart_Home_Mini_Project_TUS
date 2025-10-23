let socket;
let headerClickCount = 0;
let headerClickTimer = null;

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

  // LED
  const ledIndicator = document.getElementById('ledIndicator');
  const ledText = document.getElementById('ledText');
  if (data.led) {
    ledIndicator.classList.remove('off'); ledIndicator.classList.add('on');
    ledText.textContent = "ON";
  } else {
    ledIndicator.classList.remove('on'); ledIndicator.classList.add('off');
    ledText.textContent = "OFF";
  }

  // Buzzer
  const buzzerIndicator = document.getElementById('buzzerIndicator');
  const buzzerText = document.getElementById('buzzerText');
  if (data.buzzerPlaying) {
    buzzerIndicator.classList.remove('off'); buzzerIndicator.classList.add('on');
    buzzerText.textContent = "Playing " + data.buzzerFreq + "Hz for " + data.buzzerDur + "ms";
  } else {
    buzzerIndicator.classList.remove('on'); buzzerIndicator.classList.add('off');
    buzzerText.textContent = "Idle";
  }

  // Dummy mode indicator (hidden toggle control available via header clicks)
  const dummyIndicator = document.getElementById('dummyIndicator');
  const dummyText = document.getElementById('dummyText');
  if (data.dummyMode) {
    dummyIndicator.classList.remove('off'); dummyIndicator.classList.add('on');
    dummyText.textContent = "ON (dummy readings)";
  } else {
    dummyIndicator.classList.remove('on'); dummyIndicator.classList.add('off');
    dummyText.textContent = "OFF (real sensor)";
  }
}

function toggleTheme() {
  const current = localStorage.getItem('theme') || 'dark';
  const newTheme = current === 'dark' ? 'light' : 'dark';
  localStorage.setItem('theme', newTheme);
  applyTheme(newTheme);
}

function applyTheme(theme) {
  document.body.classList.toggle('light', theme === 'light');
  const btn = document.getElementById('themeToggle');
  btn.textContent = theme === 'light' ? '🌙' : '☀️';
}

function loadTheme() {
  const saved = localStorage.getItem('theme') || 'dark';
  applyTheme(saved);
}

function wsSend(obj) {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    console.warn("WS not open");
    return;
  }
  socket.send(JSON.stringify(obj));
}

function buzzFromForm() {
  const f = parseInt(document.getElementById('freqInput').value) || 1000;
  const d = parseInt(document.getElementById('durInput').value) || 500;
  // send via WebSocket for immediate feedback
  wsSend({cmd:'buzz', freq: f, dur: d});
}

// Alternative: use REST endpoint (for clients that prefer it)
function buzzREST() {
  const f = encodeURIComponent(document.getElementById('freqInput').value);
  const d = encodeURIComponent(document.getElementById('durInput').value);
  fetch(`/buzz?freq=${f}&dur=${d}`).then(()=>console.log('REST buzz sent'));
}

// Hidden toggle for dummy mode: click header 5 times quickly
document.getElementById('header').addEventListener('click', () => {
  headerClickCount++;
  if (headerClickTimer) clearTimeout(headerClickTimer);
  headerClickTimer = setTimeout(()=>{ headerClickCount = 0; }, 1200);
  if (headerClickCount >= 5) {
    headerClickCount = 0;
    // toggle dummy mode via websocket
    wsSend({cmd:'dummy', on: "toggle"});
    // since our server expects on:1 or on:0, we'll query current status via /status and then toggle
    fetch('/status').then(r=>r.json()).then(s=>{
      const newOn = s.dummyMode ? 0 : 1;
      wsSend({cmd:'dummy', on: newOn});
      // give user visual feedback briefly
      const tmp = document.createElement('div');
      tmp.style.position='fixed'; tmp.style.left='50%'; tmp.style.top='10%';
      tmp.style.transform='translateX(-50%)'; tmp.style.background='var(--accent-color)';
      tmp.style.color='var(--bg-color)'; tmp.style.padding='8px'; tmp.style.borderRadius='8px';
      tmp.textContent = 'Toggled dummy mode';
      document.body.appendChild(tmp);
      setTimeout(()=>document.body.removeChild(tmp), 1000);
    });
  }
});

window.addEventListener('load', () => {
  loadTheme();
  connectWebSocket();
});
