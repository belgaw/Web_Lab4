const STORAGE_KEY = 'weather_cities';

export function saveCities(cities) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cities));
}

export function loadCities() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
}