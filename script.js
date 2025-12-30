const API_KEY = '5293cce3bfb248a7bc514025253012';
const BASE_URL = 'https://api.weatherapi.com/v1';

// Состояние приложения
let state = {
    cities: [],
    useGeolocation: true,
    currentLocation: null,
    isLoading: false,
    isFirstLoad: true
};

// DOM элементы
const elements = {
    weatherCards: document.getElementById('weatherCards'),
    cityModal: document.getElementById('cityModal'),
    cityInput: document.getElementById('cityInput'),
    autocompleteDropdown: document.getElementById('autocompleteDropdown'),
    cityError: document.getElementById('cityError'),
    confirmCityBtn: document.getElementById('confirmCityBtn'),
    closeModal: document.getElementById('closeModal'),
    addCityBtn: document.getElementById('addCityBtn'),
    refreshBtn: document.getElementById('refreshBtn'),
    loadingOverlay: document.getElementById('loadingOverlay'),
    errorOverlay: document.getElementById('errorOverlay'),
    errorMessage: document.getElementById('errorMessage'),
    retryBtn: document.getElementById('retryBtn')
};

// Переменные для управления запросами автодополнения
let abortController = null;
let autocompleteCache = {};
let debounceTimer = null;

// Инициализация приложения
async function init() {
    loadState();
    setupEventListeners();
    
    // Если это первая загрузка, показываем загрузку
    if (state.isFirstLoad) {
        elements.loadingOverlay.classList.remove('hidden');
    }
    
    if (state.useGeolocation) {
        await getLocation();
    } else if (state.cities.length > 0) {
        await loadWeatherForAllCities();
    } else {
        // Показываем модальное окно для добавления первого города
        // Но только если это первая загрузка
        if (state.isFirstLoad) {
            setTimeout(() => {
                elements.loadingOverlay.classList.add('hidden');
                showCityModal();
            }, 500);
        } else {
            elements.loadingOverlay.classList.add('hidden');
            showWelcomeMessage();
        }
    }
    
    state.isFirstLoad = false;
    saveState();
}

// Загрузка состояния из localStorage
function loadState() {
    const savedState = localStorage.getItem('weatherAppState');
    if (savedState) {
        state = JSON.parse(savedState);
    }
}

// Сохранение состояния в localStorage
function saveState() {
    localStorage.setItem('weatherAppState', JSON.stringify(state));
}

// Настройка обработчиков событий
function setupEventListeners() {
    elements.addCityBtn.addEventListener('click', showCityModal);
    elements.closeModal.addEventListener('click', hideCityModal);
    elements.confirmCityBtn.addEventListener('click', addCityFromInput);
    elements.refreshBtn.addEventListener('click', refreshWeather);
    elements.retryBtn.addEventListener('click', refreshWeather);
    
    elements.cityInput.addEventListener('input', handleCityInput);
    elements.cityInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addCityFromInput();
        }
    });
    
    elements.cityInput.addEventListener('focus', handleCityInput);
    
    // Закрытие модального окна при клике вне его
    elements.cityModal.addEventListener('click', (e) => {
        if (e.target === elements.cityModal) {
            hideCityModal();
        }
    });
    
    // Закрытие выпадающего списка при клике вне его
    document.addEventListener('click', (e) => {
        if (!elements.cityInput.contains(e.target) && 
            !elements.autocompleteDropdown.contains(e.target)) {
            elements.autocompleteDropdown.style.display = 'none';
        }
    });
}

// Получение геолокации
async function getLocation() {
    if (!navigator.geolocation) {
        showError('Геолокация не поддерживается вашим браузером');
        state.useGeolocation = false;
        saveState();
        return;
    }
    
    try {
        const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            });
        });
        
        state.currentLocation = {
            lat: position.coords.latitude,
            lon: position.coords.longitude
        };
        
        await loadWeatherForAllCities();
    } catch (error) {
        console.warn('Геолокация отклонена или произошла ошибка:', error);
        state.useGeolocation = false;
        saveState();
        
        // Скрываем индикатор загрузки и показываем модальное окно
        elements.loadingOverlay.classList.add('hidden');
        
        // Показываем модальное окно только при первом отказе
        if (state.isFirstLoad || state.cities.length === 0) {
            showCityModal();
        } else {
            await loadWeatherForAllCities();
        }
    }
}

// Загрузка погоды для всех городов
async function loadWeatherForAllCities() {
    // Если нет геолокации и нет городов, не загружаем ничего
    if (!state.useGeolocation && state.cities.length === 0) {
        elements.loadingOverlay.classList.add('hidden');
        showWelcomeMessage();
        return;
    }
    
    elements.loadingOverlay.classList.remove('hidden');
    elements.errorOverlay.classList.add('hidden');
    
    try {
        const weatherPromises = [];
        
        // Если есть геолокация, загружаем погоду для текущего местоположения
        if (state.useGeolocation && state.currentLocation) {
            weatherPromises.push(getWeatherByCoords(state.currentLocation.lat, state.currentLocation.lon));
        }
        
        // Загружаем погоду для всех сохраненных городов
        for (const city of state.cities) {
            weatherPromises.push(getWeather(city));
        }
        
        const weatherData = await Promise.all(weatherPromises);
        displayWeather(weatherData);
    } catch (error) {
        console.error('Ошибка загрузки погоды:', error);
        showError('Не удалось загрузить данные о погоде. Проверьте подключение к интернету.');
    } finally {
        elements.loadingOverlay.classList.add('hidden');
    }
}

// Получение погоды по названию города
async function getWeather(city) {
    try {
        const response = await fetch(
            `${BASE_URL}/forecast.json?key=${API_KEY}&q=${encodeURIComponent(city)}&days=3&lang=ru&aqi=no`
        );
        
        if (!response.ok) {
            if (response.status === 400) {
                throw new Error('Город не найден');
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('Ошибка получения погоды для города', city, error);
        throw error;
    }
}

// Получение погоды по координатам
async function getWeatherByCoords(lat, lon) {
    try {
        const response = await fetch(
            `${BASE_URL}/forecast.json?key=${API_KEY}&q=${lat},${lon}&days=3&lang=ru&aqi=no`
        );
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('Ошибка получения погоды по координатам', error);
        throw error;
    }
}

// Поиск городов (автодополнение) через API
async function searchCities(query) {
    if (query.length < 2) {
        return [];
    }
    
    // Проверяем кэш
    const cacheKey = query.toLowerCase();
    if (autocompleteCache[cacheKey] && Date.now() - autocompleteCache[cacheKey].timestamp < 300000) {
        return autocompleteCache[cacheKey].data;
    }
    
    // Отменяем предыдущий запрос
    if (abortController) {
        abortController.abort();
    }
    
    abortController = new AbortController();
    
    try {
        const response = await fetch(
            `${BASE_URL}/search.json?key=${API_KEY}&q=${encodeURIComponent(query)}`,
            { signal: abortController.signal }
        );
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const cities = await response.json();
        const result = cities.map(city => ({
            name: city.name,
            region: city.region,
            country: city.country
        }));
        
        // Сохраняем в кэш
        autocompleteCache[cacheKey] = {
            data: result,
            timestamp: Date.now()
        };
        
        return result;
    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('Запрос автодополнения отменен');
            return [];
        }
        console.error('Ошибка поиска городов:', error);
        return [];
    }
}

// Обработка ввода города с debounce
async function handleCityInput() {
    const query = elements.cityInput.value.trim();
    
    // Очищаем предыдущий таймер
    if (debounceTimer) {
        clearTimeout(debounceTimer);
    }
    
    // Скрываем выпадающий список если запрос слишком короткий
    if (query.length < 2) {
        elements.autocompleteDropdown.style.display = 'none';
        return;
    }
    
    // Устанавливаем debounce на 300мс
    debounceTimer = setTimeout(async () => {
        elements.cityError.textContent = '';
        
        const cities = await searchCities(query);
        
        if (cities.length === 0) {
            elements.autocompleteDropdown.style.display = 'none';
            return;
        }
        
        // Отображаем результаты
        elements.autocompleteDropdown.innerHTML = cities
            .slice(0, 8) // Показываем до 8 результатов
            .map(city => `
                <div class="autocomplete-item" data-city="${city.name}, ${city.region}, ${city.country}">
                    <strong>${city.name}</strong>
                    <span class="autocomplete-details">${city.region}, ${city.country}</span>
                </div>
            `)
            .join('');
        
        elements.autocompleteDropdown.style.display = 'block';
        
        // Добавляем обработчики для элементов автодополнения
        document.querySelectorAll('.autocomplete-item').forEach(item => {
            item.addEventListener('click', () => {
                elements.cityInput.value = item.getAttribute('data-city').split(',')[0].trim();
                elements.autocompleteDropdown.style.display = 'none';
            });
        });
    }, 300);
}

// Отображение погоды
function displayWeather(weatherData) {
    elements.weatherCards.innerHTML = '';
    
    // Если нет данных о погоде, показываем приветственное сообщение
    if (!weatherData || weatherData.length === 0) {
        showWelcomeMessage();
        return;
    }
    
    weatherData.forEach((data, index) => {
        if (!data || !data.location) return;
        
        const isCurrentLocation = index === 0 && state.useGeolocation;
        const cityName = isCurrentLocation ? 'Текущее местоположение' : data.location.name;
        const cityId = isCurrentLocation ? 'current' : data.location.name;
        
        const weatherCard = document.createElement('div');
        weatherCard.className = `weather-card ${isCurrentLocation ? 'current' : ''}`;
        weatherCard.id = `card-${cityId}`;
        
        weatherCard.innerHTML = `
            <div class="weather-card-header">
                <h2 class="city-name">
                    <i class="fas fa-map-marker-alt"></i> ${cityName}
                    ${data.location.region ? `, ${data.location.region}` : ''}
                    ${data.location.country ? ` (${data.location.country})` : ''}
                </h2>
                ${!isCurrentLocation ? `
                    <button class="remove-btn" data-city="${data.location.name}">
                        <i class="fas fa-times"></i>
                    </button>
                ` : ''}
            </div>
            
            <div class="current-weather">
                <div class="temperature">${Math.round(data.current.temp_c)}°C</div>
                <div class="weather-icon">
                    <i class="${getWeatherIcon(data.current.condition.code, data.current.is_day)}"></i>
                    <div class="weather-condition">${data.current.condition.text}</div>
                </div>
            </div>
            
            <div class="weather-details">
                <div class="detail-row">
                    <span><i class="fas fa-temperature-low"></i> Ощущается как</span>
                    <span>${Math.round(data.current.feelslike_c)}°C</span>
                </div>
                <div class="detail-row">
                    <span><i class="fas fa-tint"></i> Влажность</span>
                    <span>${data.current.humidity}%</span>
                </div>
                <div class="detail-row">
                    <span><i class="fas fa-wind"></i> Ветер</span>
                    <span>${data.current.wind_kph} км/ч</span>
                </div>
                <div class="detail-row">
                    <span><i class="fas fa-compress-alt"></i> Давление</span>
                    <span>${data.current.pressure_mb} гПа</span>
                </div>
            </div>
            
            <div class="forecast">
                ${data.forecast.forecastday.map((day, i) => `
                    <div class="forecast-day">
                        <div class="forecast-date">
                            ${i === 0 ? 'Сегодня' : i === 1 ? 'Завтра' : formatDate(day.date)}
                        </div>
                        <div class="forecast-icon">
                            <i class="${getWeatherIcon(day.day.condition.code, 1)}"></i>
                        </div>
                        <div class="forecast-temp">
                            <span class="max-temp">${Math.round(day.day.maxtemp_c)}°</span>
                            <span class="min-temp">${Math.round(day.day.mintemp_c)}°</span>
                        </div>
                        <div class="forecast-condition">
                            ${day.day.condition.text}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        
        elements.weatherCards.appendChild(weatherCard);
    });
    
    // Добавляем обработчики для кнопок удаления
    document.querySelectorAll('.remove-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const city = e.currentTarget.getAttribute('data-city');
            removeCity(city);
        });
    });
}

// Показать приветственное сообщение
function showWelcomeMessage() {
    elements.weatherCards.innerHTML = `
        <div class="welcome-message">
            <div class="welcome-icon">
                <i class="fas fa-cloud-sun"></i>
            </div>
            <h2>Добро пожаловать в Weather Forecast!</h2>
            <p>Начните отслеживать погоду, добавив свой первый город.</p>
            <button id="addFirstCityBtn" class="btn add-city-btn">
                <i class="fas fa-plus"></i> Добавить первый город
            </button>
            <p class="welcome-hint">Или используйте кнопку "Добавить город" вверху</p>
        </div>
    `;
    
    // Добавляем обработчик для кнопки добавления первого города
    document.getElementById('addFirstCityBtn').addEventListener('click', showCityModal);
}

// Получение иконки погоды
function getWeatherIcon(code, isDay) {
    const icons = {
        1000: isDay ? 'fas fa-sun sunny' : 'fas fa-moon',
        1003: isDay ? 'fas fa-cloud-sun' : 'fas fa-cloud-moon',
        1006: 'fas fa-cloud cloudy',
        1009: 'fas fa-cloud cloudy',
        1030: 'fas fa-smog foggy',
        1063: 'fas fa-cloud-rain rainy',
        1066: 'fas fa-snowflake snowy',
        1069: 'fas fa-cloud-meatball',
        1072: 'fas fa-cloud-drizzle',
        1087: 'fas fa-bolt stormy',
        1114: 'fas fa-wind',
        1117: 'fas fa-wind',
        1135: 'fas fa-smog foggy',
        1147: 'fas fa-smog foggy',
        1150: 'fas fa-cloud-drizzle',
        1153: 'fas fa-cloud-drizzle',
        1168: 'fas fa-cloud-drizzle',
        1171: 'fas fa-cloud-drizzle',
        1180: 'fas fa-cloud-rain rainy',
        1183: 'fas fa-cloud-rain rainy',
        1186: 'fas fa-cloud-rain rainy',
        1189: 'fas fa-cloud-rain rainy',
        1192: 'fas fa-cloud-showers-heavy',
        1195: 'fas fa-cloud-showers-heavy',
        1198: 'fas fa-cloud-drizzle',
        1201: 'fas fa-cloud-showers-heavy',
        1204: 'fas fa-cloud-meatball',
        1207: 'fas fa-cloud-meatball',
        1210: 'fas fa-snowflake snowy',
        1213: 'fas fa-snowflake snowy',
        1216: 'fas fa-snowflake snowy',
        1219: 'fas fa-snowflake snowy',
        1222: 'fas fa-snowflake snowy',
        1225: 'fas fa-snowflake snowy',
        1237: 'fas fa-icicles',
        1240: 'fas fa-cloud-rain rainy',
        1243: 'fas fa-cloud-showers-heavy',
        1246: 'fas fa-cloud-showers-heavy',
        1249: 'fas fa-cloud-meatball',
        1252: 'fas fa-cloud-meatball',
        1255: 'fas fa-snowflake snowy',
        1258: 'fas fa-snowflake snowy',
        1261: 'fas fa-icicles',
        1264: 'fas fa-icicles',
        1273: 'fas fa-bolt stormy',
        1276: 'fas fa-bolt stormy',
        1279: 'fas fa-snowflake snowy',
        1282: 'fas fa-snowflake snowy'
    };
    
    return icons[code] || 'fas fa-cloud';
}

// Форматирование даты
function formatDate(dateString) {
    const date = new Date(dateString);
    const days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    const months = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
    const day = days[date.getDay()];
    const month = months[date.getMonth()];
    const dayOfMonth = date.getDate();
    
    return `${day}, ${dayOfMonth} ${month}`;
}

// Показ модального окна
function showCityModal() {
    elements.cityModal.style.display = 'flex';
    elements.cityInput.focus();
    elements.cityError.textContent = '';
    elements.autocompleteDropdown.style.display = 'none';
}

// Скрытие модального окна
function hideCityModal() {
    elements.cityModal.style.display = 'none';
    elements.cityInput.value = '';
    elements.autocompleteDropdown.style.display = 'none';
    elements.cityError.textContent = '';
    
    // Отменяем pending запросы
    if (abortController) {
        abortController.abort();
        abortController = null;
    }
}

// Добавление города из input
async function addCityFromInput() {
    const cityName = elements.cityInput.value.trim();
    
    if (!cityName) {
        elements.cityError.textContent = 'Введите название города';
        return;
    }
    
    // Проверяем, не добавлен ли уже этот город
    if (state.cities.some(city => city.toLowerCase() === cityName.toLowerCase())) {
        elements.cityError.textContent = 'Этот город уже добавлен';
        return;
    }
    
    elements.cityError.textContent = '';
    elements.confirmCityBtn.disabled = true;
    elements.confirmCityBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Проверка...';
    
    try {
        // Проверяем, существует ли такой город через API
        const weatherData = await getWeather(cityName);
        
        if (!weatherData || !weatherData.location) {
            throw new Error('Город не найден');
        }
        
        const fullCityName = weatherData.location.name;
        
        state.cities.push(fullCityName);
        saveState();
        await loadWeatherForAllCities();
        hideCityModal();
        
        // Показываем уведомление об успешном добавлении
        showNotification(`Город "${fullCityName}" успешно добавлен!`);
        
    } catch (error) {
        console.error('Ошибка добавления города:', error);
        if (error.message === 'Город не найден') {
            elements.cityError.textContent = 'Город не найден. Пожалуйста, выберите город из списка автодополнения.';
        } else {
            elements.cityError.textContent = 'Произошла ошибка при добавлении города. Попробуйте еще раз.';
        }
    } finally {
        elements.confirmCityBtn.disabled = false;
        elements.confirmCityBtn.innerHTML = 'Добавить';
    }
}

// Удаление города
async function removeCity(cityName) {
    if (confirm(`Вы действительно хотите удалить город "${cityName}"?`)) {
        state.cities = state.cities.filter(city => city !== cityName);
        saveState();
        
        // Если удалили все города и нет геолокации, показываем приветственное сообщение
        if (state.cities.length === 0 && !state.useGeolocation) {
            showWelcomeMessage();
        } else {
            await loadWeatherForAllCities();
        }
        
        // Показываем уведомление об удалении
        showNotification(`Город "${cityName}" удален`);
    }
}

// Обновление погоды
function refreshWeather() {
    // Если нет геолокации и нет городов, показываем приветственное сообщение
    if (!state.useGeolocation && state.cities.length === 0) {
        showWelcomeMessage();
        return;
    }
    
    elements.loadingOverlay.classList.remove('hidden');
    elements.errorOverlay.classList.add('hidden');
    
    // Очищаем кэш автодополнения
    autocompleteCache = {};
    
    loadWeatherForAllCities().then(() => {
        // Показываем уведомление об обновлении
        showNotification('Данные о погоде обновлены');
    });
}

// Показ ошибки
function showError(message) {
    elements.errorMessage.textContent = message;
    elements.errorOverlay.classList.remove('hidden');
    elements.loadingOverlay.classList.add('hidden');
}

// Показ уведомления
function showNotification(message) {
    // Создаем элемент уведомления
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.innerHTML = `
        <i class="fas fa-check-circle"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(notification);
    
    // Удаляем уведомление через 3 секунды
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 3000);
}

// Запуск приложения при загрузке страницы
document.addEventListener('DOMContentLoaded', init);
