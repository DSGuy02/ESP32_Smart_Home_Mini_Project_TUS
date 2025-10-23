let socket;let headerClickCount=0;let headerClickTimer=null;
function connectWebSocket(){const wsUrl=`ws://${window.location.hostname}:81/`;socket=new WebSocket(wsUrl);
socket.onopen=()=>console.log("WebSocket connected");
socket.onclose=()=>{console.log("WebSocket disconnected, retrying...");setTimeout(connectWebSocket,2000);};
socket.onmessage=e=>{const d=JSON.parse(e.data);updateDashboard(d);};}
function updateDashboard(d){
document.getElementById('tempNeedle').style.transform=`rotate(${-90+(d.temperature/50)*180}deg)`;
document.getElementById('tempValue').textContent=d.temperature.toFixed(1)+' °C';
document.getElementById('humNeedle').style.transform=`rotate(${-90+(d.humidity/100)*180}deg)`;
document.getElementById('humValue').textContent=d.humidity.toFixed(1)+' %';
document.getElementById('motionCircle').classList.toggle('active',!!d.motion);
const led=document.getElementById('ledIndicator');led.classList.toggle('on',!!d.led);led.classList.toggle('off',!d.led);
document.getElementById('ledText').textContent=d.led?'ON':'OFF';
const bz=document.getElementById('buzzerIndicator');bz.classList.toggle('on',!!d.buzzerPlaying);bz.classList.toggle('off',!d.buzzerPlaying);
document.getElementById('buzzerText').textContent=d.buzzerPlaying?`Playing ${d.buzzerFreq}Hz ${d.buzzerDur}ms`:'Idle';
const dm=document.getElementById('dummyIndicator');dm.classList.toggle('on',!!d.dummyMode);dm.classList.toggle('off',!d.dummyMode);
document.getElementById('dummyText').textContent=d.dummyMode?'ON (dummy)':'OFF (real)';}
function wsSend(o){if(socket&&socket.readyState===WebSocket.OPEN)socket.send(JSON.stringify(o));}
function buzzFromForm(){wsSend({cmd:'buzz',freq:+freqInput.value,dur:+durInput.value});}
function buzzREST(){fetch(`/buzz?freq=${+freqInput.value}&dur=${+durInput.value}`);}
document.getElementById('header').addEventListener('click',()=>{headerClickCount++;if(headerClickTimer)clearTimeout(headerClickTimer);
headerClickTimer=setTimeout(()=>{headerClickCount=0;},1200);
if(headerClickCount>=5){headerClickCount=0;fetch('/status').then(r=>r.json()).then(s=>{wsSend({cmd:'dummy',on:s.dummyMode?0:1});});}});
window.addEventListener('load',()=>{connectWebSocket();});