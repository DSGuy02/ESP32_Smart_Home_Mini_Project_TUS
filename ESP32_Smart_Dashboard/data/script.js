function updateDashboard() {
  fetch('/data')
    .then(response => response.json())
    .then(data => {
      const needle = document.getElementById('needle');
      const tempValue = document.getElementById('tempValue');
      const deg = -90 + (data.temperature / 50) * 180; // scale 0–50°C
      needle.style.transform = `rotate(${deg}deg)`;
      tempValue.textContent = data.temperature.toFixed(1) + " °C";

      const motionCircle = document.getElementById('motionCircle');
      if (data.motion) motionCircle.classList.add('active');
      else motionCircle.classList.remove('active');
    })
    .catch(err => console.error("Error fetching data:", err));
}

function toggleLED() {
  fetch('/led');
}

function activateBuzzer() {
  fetch('/buzz');
}

setInterval(updateDashboard, 2000);

