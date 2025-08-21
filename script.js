// Simple Weather App using Open‑Meteo (no API key)
const $ = (sel) => document.querySelector(sel);

const els = {
  form: $('#searchForm'),
  input: $('#cityInput'),
  choices: $('#choices'),
  status: $('#status'),
  current: $('#currentCard'),
  details: $('#detailsCard'),
  forecast: $('#forecast'),
  themeToggle: $('#themeToggle'),
};

// Theme toggle (remember preference)
(function initTheme(){
  const pref = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  if(pref === 'light') document.documentElement.classList.add('light');
  els.themeToggle.addEventListener('click', () => {
    document.documentElement.classList.toggle('light');
    localStorage.setItem('theme', document.documentElement.classList.contains('light') ? 'light' : 'dark');
  });
})();

els.form.addEventListener('submit', (e) => {
  e.preventDefault();
  const q = els.input.value.trim();
  if(!q) return;
  searchCity(q);
});

async function searchCity(query){
  setStatus('Searching…');
  els.choices.classList.add('hidden');
  els.choices.innerHTML = '';

  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`;
    const res = await fetch(url);
    if(!res.ok) throw new Error('Geocoding failed');
    const data = await res.json();

    if(!data.results || data.results.length === 0){
      setStatus('No matching city found. Try another name.');
      return;
    }

    setStatus('Select a location:');
    els.choices.classList.remove('hidden');

    data.results.forEach(place => {
      const btn = document.createElement('button');
      btn.className = 'choice';
      btn.innerHTML = `
        <strong>${place.name}</strong>
        <div class="sub">${[place.admin1, place.country].filter(Boolean).join(', ')} — lat ${place.latitude.toFixed(2)}, lon ${place.longitude.toFixed(2)}</div>
      `;
      btn.addEventListener('click', () => {
        els.choices.classList.add('hidden');
        setStatus(`Loading weather for ${place.name}…`);
        fetchWeather(place);
      });
      els.choices.appendChild(btn);
    });
  } catch (err){
    console.error(err);
    setStatus('Network error. Please try again.');
  }
}

async function fetchWeather(place){
  const { latitude, longitude, timezone } = {
    latitude: place.latitude,
    longitude: place.longitude,
    timezone: 'auto',
  };

  // Request current weather + hourly + daily
  const params = new URLSearchParams({
    latitude, longitude, timezone,
    current: ['temperature_2m','relative_humidity_2m','apparent_temperature','is_day','precipitation','weather_code','wind_speed_10m','wind_direction_10m'].join(','),
    hourly: ['temperature_2m','precipitation_probability','relative_humidity_2m','wind_speed_10m'].join(','),
    daily: ['weather_code','temperature_2m_max','temperature_2m_min','precipitation_sum','sunrise','sunset','wind_speed_10m_max'].join(','),
  });

  const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;

  try{
    const res = await fetch(url);
    if(!res.ok) throw new Error('Weather fetch failed');
    const data = await res.json();
    renderCurrent(place, data);
    renderForecast(data);
    setStatus('');
  }catch(err){
    console.error(err);
    setStatus('Could not load weather. Please try again.');
  }
}

function renderCurrent(place, data){
  const c = data.current;
  const wmo = c.weather_code;
  const emoji = weatherEmoji(wmo, c.is_day);

  const wind = `${Math.round(c.wind_speed_10m)} km/h ${arrowForDir(c.wind_direction_10m)}`;
  const hum = `${c.relative_humidity_2m}%`;
  const feels = `${Math.round(c.apparent_temperature)}°`;

  els.current.innerHTML = `
    <div class="row" style="justify-content:space-between;align-items:center">
      <div>
        <div class="sub">${place.name}, ${place.country || ''}</div>
        <div class="hero-temp">${Math.round(c.temperature_2m)}°C ${emoji}</div>
        <div class="sub">${wmoText(wmo)}</div>
      </div>
      <div class="badge">Lat ${place.latitude.toFixed(2)} • Lon ${place.longitude.toFixed(2)}</div>
    </div>
  `;

  els.details.innerHTML = `
    <h3 style="margin-top:0">Details</h3>
    <div class="row">
      <span class="badge">Feels like: <strong>${feels}</strong></span>
      <span class="badge">Humidity: <strong>${hum}</strong></span>
      <span class="badge">Wind: <strong>${wind}</strong></span>
      <span class="badge">Precip: <strong>${c.precipitation ?? 0} mm</strong></span>
      <span class="badge">Daylight: <strong>${c.is_day ? 'Day' : 'Night'}</strong></span>
    </div>
  `;
}

function renderForecast(data){
  const d = data.daily;
  const days = d.time.map((date, i) => ({
    date,
    code: d.weather_code[i],
    tmax: d.temperature_2m_max[i],
    tmin: d.temperature_2m_min[i],
    rain: d.precipitation_sum[i],
    windMax: d.wind_speed_10m_max?.[i]
  })).slice(0, 5);

  els.forecast.innerHTML = days.map(day => {
    const e = weatherEmoji(day.code, 1);
    const pretty = new Date(day.date).toLocaleDateString(undefined, { weekday:'short', month:'short', day:'numeric' });
    return `
      <div class="tile">
        <div class="sub">${pretty}</div>
        <div style="font-size:26px">${e}</div>
        <div><strong>${Math.round(day.tmax)}°</strong> / ${Math.round(day.tmin)}°C</div>
        <div class="sub">Rain: ${Math.round(day.rain ?? 0)} mm</div>
        ${day.windMax != null ? `<div class="sub">Wind max: ${Math.round(day.windMax)} km/h</div>` : ''}
      </div>
    `;
  }).join('');
}

function setStatus(msg){ els.status.textContent = msg; }

// Helpers: WMO to emoji/text
function weatherEmoji(code, isDay){
  const map = {
    0: '☀️', // Clear
    1: '🌤️', 2:'⛅', 3:'☁️',
    45:'🌫️', 48:'🌫️',
    51:'🌦️', 53:'🌦️', 55:'🌦️',
    56:'🌧️', 57:'🌧️',
    61:'🌧️', 63:'🌧️', 65:'🌧️',
    66:'🌧️', 67:'🌧️',
    71:'🌨️', 73:'🌨️', 75:'❄️',
    77:'❄️',
    80:'🌧️', 81:'🌧️', 82:'🌧️',
    85:'🌨️', 86:'🌨️',
    95:'⛈️', 96:'⛈️', 99:'⛈️'
  };
  let e = map[code] ?? (isDay ? '🌤️' : '🌙');
  if(!isDay && (code === 0 || code === 1)) e = '🌙';
  return e;
}

function wmoText(code){
  const txt = {
    0:'Clear sky', 1:'Mainly clear', 2:'Partly cloudy', 3:'Overcast',
    45:'Fog', 48:'Depositing rime fog',
    51:'Light drizzle', 53:'Moderate drizzle', 55:'Dense drizzle',
    56:'Freezing drizzle', 57:'Dense freezing drizzle',
    61:'Slight rain', 63:'Moderate rain', 65:'Heavy rain',
    66:'Freezing rain', 67:'Heavy freezing rain',
    71:'Slight snow', 73:'Moderate snow', 75:'Heavy snow',
    77:'Snow grains',
    80:'Slight rain showers', 81:'Moderate rain showers', 82:'Violent rain showers',
    85:'Slight snow showers', 86:'Heavy snow showers',
    95:'Thunderstorm', 96:'Thunderstorm w/ hail', 99:'Severe thunderstorm w/ hail'
  };
  return txt[code] ?? '—';
}

function arrowForDir(deg){
  const arrows = ['↑','↗','→','↘','↓','↙','←','↖'];
  const idx = Math.round(deg / 45) % 8;
  return arrows[idx];
}

// Try to show user's city quickly using IP (optional, no API key)
// For privacy, this is disabled by default. Enable if you want:
// quickStart();
async function quickStart(){
  try{
    // Free IP geolocation endpoint (no key). If blocked, simply ignore.
    const res = await fetch('https://ipapi.co/json/');
    if(res.ok){
      const j = await res.json();
      if(j.city) {
        els.input.value = j.city;
        searchCity(j.city);
      }
    }
  }catch{ /* ignore */ }
}
