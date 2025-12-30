
const API_KEY = '5293cce3bfb248a7bc514025253012'; // Замени на свой ключ с weatherapi.com
const BASE_URL = 'https://api.weatherapi.com/v1';

let state = {
    mainLocation: localStorage.getItem('mainLocation') || null, // Координаты или имя
    extraCities: JSON.parse(localStorage.getItem('extraCities')) || [],
    isGeo: !localStorage.getItem('mainLocation') // Флаг, была ли получена геопозиция
};

// Элементы DOM
const mainContainer = document.getElementById('main-weather');
const extraContainer = document.getElementById('extra-weather');
const cityInput = document.getElementById('city-input');
const dropdown = document.getElementById('autocomplete-list');
const errorMsg = document.getElementById('error-msg');
const refreshBtn = document.getElementById('refresh-btn');

// Инициализация
window.addEventListener('DOMContentLoaded', () => {
    if (!state.mainLocation) {
        getUserLocation();
    } else {
        renderAllWeather();
    }
});

// 1. Геолокация
function getUserLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                state.mainLocation = `${pos.coords.latitude},${pos.coords.longitude}`;
                state.isGeo = true;
                saveState();
                renderAllWeather();
            },
            () => {
                showError("Доступ к геопозиции отклонен. Введите город вручную.");
                state.isGeo = false;
            }
        );
    }
}

// 2. Получение данных с API
async function fetchWeatherData(query) {
    try {
        const res = await fetch(`${BASE_URL}/forecast.json?key=${API_KEY}&q=${query}&days=3&lang=ru`);
        if (!res.ok) throw new Error('Город не найден');
        return await res.json();
    } catch (err) {
        console.error(err);
        return null;
    }
}

// 3. Отрисовка
async function renderAllWeather() {
    mainContainer.innerHTML = '<div class="loading-spinner">Загрузка...</div>';
    extraContainer.innerHTML = '';

    // Основной город
    if (state.mainLocation) {
        const data = await fetchWeatherData(state.mainLocation);
        if (data) {
            const label = state.isGeo ? "Текущее местоположение" : data.location.name;
            mainContainer.innerHTML = createWeatherHTML(data, label);
        }
    }

    // Дополнительные города
    for (const city of state.extraCities) {
        const data = await fetchWeatherData(city);
        if (data) {
            const card = document.createElement('div');
            card.innerHTML = createWeatherHTML(data, data.location.name, true);
            extraContainer.appendChild(card);
        }
    }
}

function createWeatherHTML(data, label, canDelete = false) {
    const forecastHTML = data.forecast.forecastday.map(day => `
        <div class="day-item">
            <p><strong>${new Date(day.date).toLocaleDateString('ru-RU', {weekday: 'short'})}</strong></p>
            <img src="${day.day.condition.icon}" width="40">
            <p>${Math.round(day.day.avgtemp_c)}°C</p>
        </div>
    `).join('');

    return `
        <div class="weather-card">
            <div class="weather-header">
                <h2>${label}</h2>
                <p>${data.current.condition.text} | Текущая: ${data.current.temp_c}°C</p>
            </div>
            <div class="forecast-row">${forecastHTML}</div>
        </div>
    `;
}

// 4. Поиск и Автодополнение
cityInput.addEventListener('input', async (e) => {
    const val = e.target.value;
    errorMsg.style.display = 'none';
    if (val.length < 3) {
        dropdown.style.display = 'none';
        return;
    }

    const res = await fetch(`${BASE_URL}/search.json?key=${API_KEY}&q=${val}`);
    const cities = await res.json();
    
    if (cities.length > 0) {
        dropdown.innerHTML = cities.map(c => `<li onclick="addCity('${c.name}')">${c.name}, ${c.country}</li>`).join('');
        dropdown.style.display = 'block';
    }
});

function addCity(cityName) {
    if (!state.mainLocation) {
        state.mainLocation = cityName;
        state.isGeo = false;
    } else if (!state.extraCities.includes(cityName)) {
        if (state.extraCities.length >= 2 || state.extraCities.length < 2) {
             state.extraCities.push(cityName);
        }
    }
    
    dropdown.style.display = 'none';
    cityInput.value = '';
    saveState();
    renderAllWeather();
}

// 5. Вспомогательные функции
function saveState() {
    localStorage.setItem('mainLocation', state.mainLocation);
    localStorage.setItem('extraCities', JSON.stringify(state.extraCities));
}

function showError(text) {
    errorMsg.textContent = text;
    errorMsg.style.display = 'block';
}

refreshBtn.addEventListener('click', renderAllWeather);

// Закрытие выпадающего списка при клике мимо
document.addEventListener('click', (e) => {
    if (e.target !== cityInput) dropdown.style.display = 'none';
});
