const API_KEY = '5293cce3bfb248a7bc514025253012';
const BASE_URL = 'https://api.weatherapi.com/v1/forecast.json';

export async function fetchWeather(query) {
  const url = `${BASE_URL}?key=${API_KEY}&q=${query}&days=3&lang=ru`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error('Ошибка загрузки погоды');
  }

  return response.json();
}