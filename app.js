const API_KEY = '5293cce3bfb248a7bc514025253012';


function fetchWeatherByCity(city, container) {
container.innerHTML = 'Загрузка...';


fetch(`https://api.openweathermap.org/data/2.5/forecast?q=${city}&units=metric&lang=ru&appid=${API_KEY}`)
.then(res => res.json())
.then(data => renderForecast(data, city, container))
.catch(() => container.innerHTML = 'Ошибка загрузки');
}


function fetchWeatherByCoords(lat, lon) {
weatherContainer.innerHTML = 'Загрузка...';


fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&lang=ru&appid=${API_KEY}`)
.then(res => res.json())
.then(data => renderForecast(data, 'Текущее местоположение', weatherContainer))
.catch(() => weatherContainer.innerHTML = 'Ошибка');
}


function renderForecast(data, title, container) {
const days = {};


data.list.forEach(item => {
const date = item.dt_txt.split(' ')[0];
if (!days[date]) days[date] = [];
days[date].push(item);
});


const dates = Object.keys(days).slice(0, 3);


container.innerHTML = `<h3>${title}</h3>` + dates.map(date => {
const temps = days[date].map(i => i.main.temp);
const avg = (temps.reduce((a, b) => a + b) / temps.length).toFixed(1);
return `<div class="card"><strong>${date}</strong><p>${avg} °C</p></div>`;
}).join('');
}


function initGeo() {
navigator.geolocation.getCurrentPosition(
pos => {
state.main = { type: 'geo', value: pos.coords };
saveState();
fetchWeatherByCoords(pos.coords.latitude, pos.coords.longitude);
},
() => cityError.textContent = 'Разрешение отклонено. Введите город.'
);
}


refreshBtn.onclick = () => location.reload(false);


cityInput.oninput = () => {
suggestions.innerHTML = '';
const value = cityInput.value.toLowerCase();
citiesList.filter(c => c.toLowerCase().includes(value)).forEach(city => {
const li = document.createElement('li');
li.textContent = city;
li.onclick = () => {
cityInput.value = city;
suggestions.innerHTML = '';
};
suggestions.appendChild(li);
});
};


addCityBtn.onclick = () => {
const city = cityInput.value;
if (!citiesList.includes(city)) {
cityError.textContent = 'Город не найден';
return;
}
state.cities.push(city);
saveState();
fetchWeatherByCity(city, citiesContainer);
};


if (!state.main) initGeo();
else if (state.main.type === 'geo') fetchWeatherByCoords(state.main.value.latitude, state.main.value.longitude);
else fetchWeatherByCity(state.main.value, weatherContainer);


state.cities.forEach(city => fetchWeatherByCity(city, citiesContainer));