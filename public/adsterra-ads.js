// Adsterra Ad Units for TheDailyPulse.space
// Unit 1: Head loader (already added in index.html <head>)

// Unit 2: 160x600 Skyscraper
var adsterra_conf_160 = document.createElement('script');
adsterra_conf_160.type = 'text/javascript';
adsterra_conf_160.innerHTML = 'atOptions = ' + JSON.stringify({
  'key': '198695a08a60e90b59f6a5370452a9fb',
  'format': 'iframe',
  'height': 600,
  'width': 160,
  'params': {}
}) + ';';

var adsterra_invoke_160 = document.createElement('script');
adsterra_invoke_160.type = 'text/javascript';
adsterra_invoke_160.src = 'https://www.highperformanceformat.com/198695a08a60e90b59f6a5370452a9fb/invoke.js';

var sidebar = document.getElementById('adsterra-sidebar');
if (sidebar) {
  document.body.appendChild(adsterra_conf_160);
  document.body.appendChild(adsterra_invoke_160);
}

// Unit 3: 728x90 Leaderboard
var adsterra_conf_728 = document.createElement('script');
adsterra_conf_728.type = 'text/javascript';
adsterra_conf_728.innerHTML = 'atOptions = ' + JSON.stringify({
  'key': '5d1d33fad1aa774f2588e74770c88134',
  'format': 'iframe',
  'height': 90,
  'width': 728,
  'params': {}
}) + ';';

var adsterra_invoke_728 = document.createElement('script');
adsterra_invoke_728.type = 'text/javascript';
adsterra_invoke_728.src = 'https://www.highperformanceformat.com/5d1d33fad1aa774f2588e74770c88134/invoke.js';

var container = document.getElementById('adsterra-infeed');
if (container) {
  container.appendChild(adsterra_conf_728);
  container.appendChild(adsterra_invoke_728);
}
