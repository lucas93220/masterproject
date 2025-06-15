const axios = require('axios');

const API_KEY = process.env.WEATHER_API_KEY;

exports.getWeatherByCity = async (city) => {
  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&units=metric&appid=${API_KEY}&lang=fr`;
    const { data } = await axios.get(url);
    return {
      temperature: data.main.temp,
      temperature_min: data.main.temp_min,
      temperature_max: data.main.temp_max,
      description: data.weather[0].description,
      icon: data.weather[0].icon,
      pluie: data.weather[0].main.toLowerCase().includes('rain') || data.weather[0].description.toLowerCase().includes('pluie'),
      vent: data.wind.speed,
      raw: data,
    };
  } catch (error) {
    throw new Error("Erreur lors de la récupération météo : " + (error.response?.data?.message || error.message));
  }
};
