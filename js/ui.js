const weatherList = document.getElementById('weatherList');
const status = document.getElementById('status');

export function showLoader() {
  status.textContent = 'Загрузка...';
}

export function showError(message) {
  status.textContent = message;
}

export function clearStatus() {
  status.textContent = '';
}

export function renderWeather(data, title) {
  const card = document.createElement('div');
  card.className = 'weather-card';

  card.innerHTML = `
    <h3>${title}</h3>
    <div class="forecast">
      ${data.forecast.forecastday.map(day => `
        <div>
          <p>${day.date}</p>
          <img src="${day.day.condition.icon}" />
          <p>${day.day.avgtemp_c}°C</p>
        </div>
      `).join('')}
    </div>
  `;

  weatherList.appendChild(card);
}

export function clearWeather() {
  weatherList.innerHTML = '';
}