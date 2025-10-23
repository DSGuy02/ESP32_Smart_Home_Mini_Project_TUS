let socket;
let motionClicks = 0;
let clickTimer = null;
let dummyMode = false;

function connectWebSocket() {
  const wsUrl = `ws://${window.location.hostname}:81/`;
  socket = new WebSocket(wsUrl);

  socket.onopen = () => console.log("WebSocket connected");
  socket.onclose = () => {
    console.log("WebSocket disconnected, retrying...");
    setTimeout(connectWebSocket, 2000);
  };

  socket.onmessage = (event) => {
    const d = JSON.parse(event.data);
    updateDashboard(d);
  };
}

function updateDashboard(d) {
  const tempDeg = -90 + (d.temperature / 50) * 180;
  document.getElementById('tempNeedle').style.transform = `rotate(${tempDeg}deg)`;
  document.getElementById('tempValue').textContent = d.temperature.toFixed(1) + " °C";

  const humDeg = -90 + (d.humidity / 100) * 180;
  document.getElementById('humNeedle').style.transform = `rotate(${humDeg}deg)`;
  document.getElementById('humValue').textContent = d.humidity.toFixed(1) + " %";

  const circle = document.getElementById('motionCircle');
  const motionStatus = document.getElementById('motionStatus');
  if (d.motion) {
    circle.classList.add('active');
    motionStatus.textContent = "Motion Detected";
  } else {
    circle.classList.remove('active');
    motionStatus.textContent = "No motion";
  }

  document.getElementById('ledStatus').textContent = d.led ? "LED: ON" : "LED: OFF";
  document.getElementById('buzzerStatus').textContent = d.buzzer ? "Buzzer: ON" : "Buzzer: OFF";
  dummyMode = !!d.dummyMode;
}

function sendWS(obj) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(obj));
  } else {
    if (obj.cmd === 'led' && obj.time) {
      fetch(`/led?time=${obj.time}`);
    } else if (obj.cmd === 'buzz') {
      const q = `?freq=${obj.freq||1000}&dur=${obj.dur||500}`;
      fetch(`/buzz${q}`);
    } else if (obj.cmd === 'led') {
      fetch('/led');
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  connectWebSocket();

  const circle = document.getElementById('motionCircle');
  circle.addEventListener('click', () => {
    motionClicks++;
    if (clickTimer) clearTimeout(clickTimer);
    clickTimer = setTimeout(() => {
      if (motionClicks >= 5) {
        if (socket && socket.readyState === WebSocket.OPEN) {
          sendWS({cmd:'dummy', on: dummyMode ? 0 : 1});
        } else {
          fetch(`/setDummy?on=${dummyMode ? 0 : 1}`);
        }
        circle.classList.add('active');
        setTimeout(()=>circle.classList.remove('active'), 700);
      }
      motionClicks = 0;
      clickTimer = null;
    }, 900);
  });

  document.getElementById('ledToggleBtn').addEventListener('click', ()=>{
    sendWS({cmd:'led'});
  });
  document.getElementById('ledTimedBtn').addEventListener('click', ()=>{
    const v = parseInt(document.getElementById('ledDuration').value || 0);
    if (v > 0) {
      sendWS({cmd:'led', time: v});
    } else alert('Enter seconds for LED');
  });

  document.getElementById('buzzBtn').addEventListener('click', ()=>{
    sendWS({cmd:'buzz'});
  });
  document.getElementById('buzzCustomBtn').addEventListener('click', ()=>{
    const f = parseInt(document.getElementById('freqInput').value || 1000);
    const d = parseInt(document.getElementById('durInput').value || 500);
    sendWS({cmd:'buzz', freq: f, dur: d});
  });

  const saved = localStorage.getItem('theme') || 'dark';
  applyTheme(saved);
});

function applyTheme(theme) {
  document.body.classList.toggle('light', theme === 'light');
  const btn = document.getElementById('themeToggle');
  btn.textContent = theme === 'light' ? '🌙' : '☀️';
  localStorage.setItem('theme', theme);
}
function toggleTheme() {
  const cur = localStorage.getItem('theme') || 'dark';
  applyTheme(cur === 'dark' ? 'light' : 'dark');
}
