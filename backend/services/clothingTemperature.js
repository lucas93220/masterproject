// Le schéma existant utilise INTEGER. Aucun arrondi silencieux des préférences.
function validateTemperatures(body, previous = {}, required = false) {
  if (!required && !Object.hasOwn(body, 'temperature_min') && !Object.hasOwn(body, 'temperature_max')) return;
  const min = Object.hasOwn(body, 'temperature_min') ? body.temperature_min : previous.temperature_min;
  const max = Object.hasOwn(body, 'temperature_max') ? body.temperature_max : previous.temperature_max;
  const integer = value => Number.isInteger(value) && value >= -2147483648 && value <= 2147483647;
  if (((required || min !== undefined) && !integer(min)) ||
      ((required || max !== undefined) && !integer(max)) ||
      (integer(min) && integer(max) && min > max)) {
    throw Object.assign(new Error('Indiquez des températures entières, avec un minimum inférieur ou égal au maximum'), { status: 400 });
  }
}
module.exports = { validateTemperatures };
