import { fetchWeather } from './api.js';
import { getCurrentPosition } from './geo.js';
import { saveCities, loadCities } from './storage.js';
import { showLoader, showError, clearStatus, renderWeather, clearWeather } from './ui.js';

const cityForm = document.getElementById('cityForm');
const cityInput = document.getElementById('cityInput');
const addCityBtn = document.getElementById('addCityBtn');
const cityError = document.getElementById('cityError');
const dropdown = document.getElementById('dropdown');
const refreshBtn = document.getElementById('refreshBtn');

const citiesList = ['Москва', 'Санкт-Петербург', 'Казань', 'Новосибирск', 'Екатеринбург'];

let cities = loadCities();

async function loadAllWeather() {
  clearWeather();
  showLoader();

  try {
    for (const city of cities) {
      const data = await fetchWeather(city.query);
      renderWeather(data, city.name);
    }
    clearStatus();
  } catch {
    showError('Ошибка загрузки данных');
  }
}

async function init() {
  if (cities.length > 0) {
    loadAllWeather();
    return;
  }

  try {
    showLoader();
    const pos = await getCurrentPosition();
    const query = `${pos.coords.latitude},${pos.coords.longitude}`;
    cities = [{ name: 'Текущее местоположение', query }];
    saveCities(cities);
    loadAllWeather();
  } catch {
    cityForm.classList.remove('hidden');
    clearStatus();
  }
}

cityInput.addEventListener('input', () => {
  dropdown.innerHTML = '';
  const value = cityInput.value.toLowerCase();

  citiesList
    .filter(city => city.toLowerCase().includes(value))
    .forEach(city => {
      const div = document.createElement('div');
      div.textContent = city;
      div.onclick = () => {
        cityInput.value = city;
        dropdown.innerHTML = '';
      };
      dropdown.appendChild(div);
    });
});

addCityBtn.addEventListener('click', async () => {
  const city = cityInput.value;

  if (!citiesList.includes(city)) {
    cityError.textContent = 'Город не найден';
    return;
  }

  cityError.textContent = '';
  cities.push({ name: city, query: city });
  saveCities(cities);
  cityForm.classList.add('hidden');
  loadAllWeather();
});

refreshBtn.addEventListener('click', loadAllWeather);

init();