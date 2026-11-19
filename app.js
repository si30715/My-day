
const $ = id => document.getElementById(id);

// Default Location
const defaultCity = {
    name: 'Tamsui',
    country: 'Taiwan',
    latitude: 25.17,
    longitude: 121.44,
    timezone: 'Asia/Taipei'
};

// Settings
const stored = JSON.parse(
    localStorage.getItem('skyNoteSettings') || '{}'
);

let settings = {
    city: defaultCity,
    notifyOn: false,
    notifyCount: 2,
    times: ['07:00', '18:00', '21:00'],
    rainAdvice: true,
    tempAdvice: true,
    pressureAdvice: true,
    ...stored
};

let forecast = null;
let selectedDate = null;

// Weather Helpers
const codeIcon = c =>
    c === 0 ? '☀️' :
    c <= 3 ? '⛅' :
    c <= 48 ? '☁️' :
    c <= 67 ? '🌧️' :
    c <= 77 ? '❄️' :
    c <= 82 ? '🌦️' :
    c <= 86 ? '🌨️' : '⛈️';

const condition = c =>
    c === 0 ? 'Clear Sky' :
    c <= 3 ? 'Partly Cloudy' :
    c <= 48 ? 'Cloudy' :
    c <= 67 ? 'Rain' :
    c <= 77 ? 'Snow' :
    c <= 82 ? 'Rain Showers' :
    c <= 86 ? 'Snow Showers' : 'Thunderstorm';

const rainy = c =>
    [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99]
        .includes(c);

const cloud = c => c >= 2 && c <= 48;

const fmt = (n, unit = '°') =>
    Number.isFinite(n) ? Math.round(n) + unit : '--';

const localNow = tz =>
    new Date(
        new Date().toLocaleString('en-US', { timeZone: tz })
    );

const dateString = tz =>
    new Intl.DateTimeFormat('en-CA', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(new Date());

const dayName = d =>
    new Date(d + 'T12:00:00')
        .toLocaleDateString('en-US', { weekday: 'short' });


        const dateLabel = d => {
            const date = new Date(d + 'T12:00:00');
        
            const month = date.toLocaleDateString('en-US', {
                month: 'long'
            });
        
            const day = date.getDate();
            const weekday = date.toLocaleDateString('en-US', {
                weekday: 'short'
            });
        
            const suffix =
                day % 100 >= 11 && day % 100 <= 13
                    ? 'th'
                    : day % 10 === 1
                        ? 'st'
                        : day % 10 === 2
                            ? 'nd'
                            : day % 10 === 3
                                ? 'rd'
                                : 'th';
        
            return `${month} ${day}${suffix}, ${weekday}`;
        };
        
const shortTime = t => t.slice(11, 16);

// Page Navigation
function show(page) {
    for (const id of ['home', 'details', 'settings']) {
        $(id).classList.toggle('hidden', id !== page);
    }

    document.querySelector('header').classList.toggle(
        'hidden',
        page !== 'home'
    );

    window.scrollTo(0, 0);
}


// Background
function applyBackground() {
    if (!forecast) return;

    const tz = settings.city.timezone;
    const date = dateString(tz);
    const idx = forecast.daily.time.indexOf(date);

    const sunrise =
        forecast.daily.sunrise[idx] || forecast.daily.sunrise[0];

    const sunset =
        forecast.daily.sunset[idx] || forecast.daily.sunset[0];

    const time = new Intl.DateTimeFormat('en-GB', {
        timeZone: tz,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }).format(new Date());

    const night =
        time < shortTime(sunrise) ||
        time >= shortTime(sunset);

    const c = forecast.current.weather_code;

    document.body.className =
        night ? 'night' :
        rainy(c) ? 'rainy' :
        cloud(c) ? 'cloudy' : 'sunny';
}

// Weather API
async function loadWeather() {
    const { latitude, longitude, timezone } = settings.city;

   
const params = new URLSearchParams({
    latitude,
    longitude,
    timezone,

    models: 'best_match',

    current: [
        'temperature_2m',
        'apparent_temperature',
        'relative_humidity_2m',
        'weather_code',
        'pressure_msl',
        'wind_speed_10m',
        'precipitation',
        'rain',
        'cloud_cover'
    ].join(','),

    hourly: [
        'temperature_2m',
        'precipitation_probability',
        'precipitation',
        'rain',
        'showers',
        'cloud_cover',
        'weather_code'
    ].join(','),

    daily: [
        'weather_code',
        'temperature_2m_max',
        'temperature_2m_min',
        'precipitation_probability_max',
        'precipitation_sum',
        'sunrise',
        'sunset',
        'uv_index_max'
    ].join(','),

    forecast_days: '7',
    forecast_hours: '168'
});

    $('condition').textContent = 'Loading weather...';

    try {
        const r = await fetch(
            'https://api.open-meteo.com/v1/forecast?' + params
        );

        if (!r.ok) {
            throw Error('Weather API ' + r.status);
        }

        forecast = await r.json();
        render();

    } catch (e) {
        console.error(e);

        $('condition').textContent = 'Weather unavailable';
        $('hourly').textContent = 'Check your internet connection.';
    }
}

// Render Main Screen
function render() {
    const c = forecast.current;

    $('placeBtn').innerHTML =
        settings.city.name + ' <span>⌄</span>';

    $('todayDate').textContent =
        new Intl.DateTimeFormat('en-US', {
            timeZone: settings.city.timezone,
            weekday: 'long',
            month: 'long',
            day: 'numeric'
        }).format(new Date());

    $('temp').textContent = fmt(c.temperature_2m);
    $('condition').textContent = condition(c.weather_code);
    $('feels').textContent =
        'Feels like ' + fmt(c.apparent_temperature);

    $('bigIcon').textContent = codeIcon(c.weather_code);

    applyBackground();
    renderHourly();
    renderWeekly();
}

// Hourly Forecast

function renderHourly() {
    const h = forecast.hourly;
    const d = forecast.daily;
    const now = forecast.current.time;

    // Find the current hour
    const currentHour = now.slice(0, 13);

    let start = h.time.findIndex(
        t => t.slice(0, 13) >= currentHour
    );

    if (start < 0) start = 0;

    // Get the next 24 hours
    
const rows = h.time.slice(start, start + 24).map(
    (time, index) => ({
        time,
        temp: h.temperature_2m[start + index],
        icon: codeIcon(h.weather_code[start + index]),

        // Rain and cloud data
        rainAmount: h.precipitation[start + index],
        rainChance: h.precipitation_probability[start + index],
        cloudCover: h.cloud_cover[start + index],

        special: false
    })
);

    if (!rows.length) {
        $('hourly').textContent = 'Hourly forecast unavailable';
        return;
    }

    // Add sunrise and sunset events
    const events = [];

    for (let i = 0; i < d.time.length; i++) {
        events.push(
            {
                time: d.sunrise[i],
                label: 'Sunrise',
                icon: '🌅',
                special: true
            },
            {
                time: d.sunset[i],
                label: 'Sunset',
                icon: '🌇',
                special: true
            }
        );
    }

    // Use the 24-hour interval from the first forecast hour
    const end = new Date(
        rows[0].time + ':00'
    );

    end.setHours(end.getHours() + 24);

    const endTime =
        `${end.getFullYear()}-` +
        `${String(end.getMonth() + 1).padStart(2, '0')}-` +
        `${String(end.getDate()).padStart(2, '0')}T` +
        `${String(end.getHours()).padStart(2, '0')}:00`;

    for (const event of events) {
        if (
            event.time >= rows[0].time &&
            event.time < endTime
        ) {
            rows.push(event);
        }
    }

    rows.sort((a, b) => a.time.localeCompare(b.time));

    
$('hourly').innerHTML = rows.map(r => {
    const isNow =
        !r.special &&
        r.time.slice(0, 13) === currentHour;

    return `
        <div class="hour ${r.special ? 'special' : ''}">

            <span class="time">
                ${isNow ? 'Now' : shortTime(r.time)}
            </span>

            <span class="emoji">${r.icon}</span>

            <span class="value">
                ${r.special ? r.label : fmt(r.temp)}
            </span>

            ${!r.special ? `
                <div class="rainInfo">
                    <span class="rainChance">
                        💧 ${r.rainChance ?? '--'}%
                    </span>


                    ${Number.isFinite(r.rainAmount) && r.rainAmount >= 0.05
                        ? `
                            <span class="rainAmount">
                                ${r.rainAmount.toFixed(1)} mm
                            </span>
                        `
                        : ''}
                    
                </div>
            ` : ''}

        </div>
    `;
}).join('');

}

// Weekly Forecast

function renderWeekly() {
    const d = forecast.daily;

    $('weekly').innerHTML = d.time.map((date, i) => `
        <button class="day" data-day="${i}">
            <span class="dayName">
                ${i === 0 ? 'Today' : dayName(date)}
            </span>

            <span class="dayIcon">
                ${codeIcon(d.weather_code[i])}
            </span>

            <span class="dayHigh">
                ${fmt(d.temperature_2m_max[i])}
            </span>

            <span class="dayLow">
                ${fmt(d.temperature_2m_min[i])}
            </span>
        </button>
    `).join('');

    document.querySelectorAll('[data-day]').forEach(b => {
        b.onclick = () => openDetail(Number(b.dataset.day));
    });
}


// Weather Details
function openDetail(i = 0) {
    if (!forecast) return;

    const d = forecast.daily;
    const c = forecast.current;
    const today = i === 0;

    $('detailTitle').textContent =
        today ? "Today's Weather" : dateLabel(d.time[i]);

    $('detailIcon').textContent =
        codeIcon(d.weather_code[i]);

    $('detailTemp').textContent =
        today
            ? fmt(c.temperature_2m)
            : fmt(d.temperature_2m_max[i]);

    $('detailCondition').textContent =
        condition(d.weather_code[i]);

    const items = [
        [
            '🌧️ Rain chance',
            fmt(d.precipitation_probability_max[i], '%')
        ],
        [
            '🌡️ High / Low',
            fmt(d.temperature_2m_max[i]) +
            ' / ' +
            fmt(d.temperature_2m_min[i])
        ],
        [
            '🌅 Sunrise',
            shortTime(d.sunrise[i])
        ],
        [
            '🌇 Sunset',
            shortTime(d.sunset[i])
        ],
        [
            '☀️ UV max',
            fmt(d.uv_index_max[i], '')
        ]
    ];

    if (today) {
        items.splice(
            2,
            0,
            [
                '🌡️ Feels like',
                fmt(c.apparent_temperature)
            ],
            [
                '💧 Humidity',
                fmt(c.relative_humidity_2m, '%')
            ],
            [
                '🌀 Pressure',
                fmt(c.pressure_msl, ' hPa')
            ],
            [
                '💨 Wind',
                fmt(c.wind_speed_10m, ' km/h')
            ]
        );
    }

    $('detailGrid').innerHTML = items.map(([l, v]) => `
        <div class="glass detailItem">
            <div class="label">${l}</div>
            <div class="val">${v}</div>
        </div>
    `).join('');

    show('details');
}

// Notification Times
function renderTimes() {
    const n = Number($('notifyCount').value);

    $('times').innerHTML = Array.from(
        { length: n },
        (_, i) => `
            <label>
                Notification ${i + 1}
                <input
                    type="time"
                    data-time="${i}"
                    value="${settings.times[i] || '07:00'}"
                >
            </label>
        `
    ).join('');
}

// Open Settings
function openSettings() {
    $('selectedCity').textContent =
        settings.city.name + ', ' + settings.city.country;

    $('notifyOn').checked = settings.notifyOn;
    $('notifyCount').value = settings.notifyCount;

    for (const id of [
        'rainAdvice',
        'tempAdvice',
        'pressureAdvice'
    ]) {
        $(id).checked = settings[id];
    }

    renderTimes();
    show('settings');
}

// Event Listeners
$('settingsBtn').onclick = openSettings;
$('placeBtn').onclick = openSettings;

$('currentCard').onclick = () => openDetail(0);

document.querySelectorAll('[data-back]').forEach(b => {
    b.onclick = () => show('home');
});

$('notifyCount').onchange = renderTimes;

// Search City

$('searchCity').onclick = async () => {
    const input = $('cityInput').value.trim();

    if (!input) return;

    const el = $('cityResults');
    el.textContent = 'Searching...';

    // Separate city name and country
    const parts = input.split(',').map(s => s.trim());
    const cityName = parts[0];
    const region = (parts[1] || '').toLowerCase();

    const countryCodes = {
        taiwan: 'TW',
        tw: 'TW',
        '台湾': 'TW',
        '臺灣': 'TW',
        japan: 'JP',
        jp: 'JP',
        '日本': 'JP',
        china: 'CN',
        cn: 'CN'
    };

    const countryCode = countryCodes[region];

    // Search in both Japanese and English
    
    const isJapanese = /[\u3040-\u30ff\u3400-\u9fff]/.test(cityName);

    const languages = isJapanese
    ? ['ja', 'en']
    : ['en', 'ja'];


    try {
        const searches = languages.map(async language => {
            const params = new URLSearchParams({
                name: countryCode ? cityName : input,
                count: 30,
                language,
                format: 'json'
            });

            if (countryCode) {
                params.set('countryCode', countryCode);
            }

            const response = await fetch(
                'https://geocoding-api.open-meteo.com/v1/search?' +
                params
            );

            if (!response.ok) {
                throw Error('City search failed');
            }

            const data = await response.json();
            return data.results || [];
        });

        const results = await Promise.allSettled(searches);

        // Combine results and remove duplicates
        const cities = new Map();

        results.forEach(result => {
            if (result.status !== 'fulfilled') return;

            result.value.forEach(city => {
                if (!cities.has(city.id)) {
                    cities.set(city.id, city);
                }
            });
        });

        el.replaceChildren();

        if (cities.size === 0) {
            el.textContent = 'No results found';
            return;
        }

        cities.forEach(city => {
            const button = document.createElement('button');
            button.className = 'cityOption';

            const country =
                city.country_code === 'TW'
                    ? 'Taiwan'
                    : city.country;

            const locationLabel = [
                city.name,
                city.admin1,
                country
            ].filter(Boolean).join(', ');

            button.textContent = locationLabel;

            button.onclick = () => {
                settings.city = {
                    name: city.name,
                    country,
                    latitude: city.latitude,
                    longitude: city.longitude,
                    timezone: city.timezone
                };

                $('selectedCity').textContent = locationLabel;

                el.replaceChildren();
                $('cityInput').value = '';
            };

            el.append(button);
        });

    } catch (error) {
        console.error(error);
        el.textContent = 'City search failed';
    }
};

// Save Settings
$('saveSettings').onclick = () => {
    settings.notifyOn = $('notifyOn').checked;
    settings.notifyCount = Number($('notifyCount').value);

    document.querySelectorAll('[data-time]').forEach(el => {
        settings.times[Number(el.dataset.time)] = el.value;
    });

    for (const id of [
        'rainAdvice',
        'tempAdvice',
        'pressureAdvice'
    ]) {
        settings[id] = $(id).checked;
    }

    localStorage.setItem(
        'skyNoteSettings',
        JSON.stringify(settings)
    );

    show('home');
    loadWeather();
};

// Initialize
loadWeather();


const WEATHER_REFRESH_MS = 15 * 60 * 1000;

let lastWeatherUpdate = Date.now();

setInterval(() => {
    if (!document.hidden && navigator.onLine) {
        loadWeather();
        lastWeatherUpdate = Date.now();
    }
}, WEATHER_REFRESH_MS);

document.addEventListener('visibilitychange', () => {
    if (
        !document.hidden &&
        navigator.onLine &&
        Date.now() - lastWeatherUpdate >= WEATHER_REFRESH_MS
    ) {
        loadWeather();
        lastWeatherUpdate = Date.now();
    }
});


// Update Background Every Minute
setInterval(() => {
    if (forecast) {
        applyBackground();
    }
}, 60000);

// Register Service Worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker
        .register('./sw.js')
        .catch(console.warn);
}
