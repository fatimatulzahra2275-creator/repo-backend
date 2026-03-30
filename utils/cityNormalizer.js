const CITY_MAP = {
  karachi: "Karachi",
  khi: "Karachi",
  "khi city": "Karachi",
  lahore: "Lahore",
  lhr: "Lahore",
  islamabad: "Islamabad",
  isl: "Islamabad",
  rawalpindi: "Rawalpindi",
  pindi: "Rawalpindi",
  faisalabad: "Faisalabad",
  fsd: "Faisalabad",
  multan: "Multan",
  mtn: "Multan",
  peshawar: "Peshawar",
  quetta: "Quetta",
  hyderabad: "Hyderabad",
  sukkur: "Sukkur",
  "interior sindh": "Interior Sindh",
}

function normalizeCity(cityInput) {
  if (typeof cityInput !== "string") {
    return { city: cityInput, isValid: false, error: "city must be a string." }
  }

  const key = cityInput.trim().toLowerCase()
  if (!key) {
    return { city: cityInput, isValid: false, error: "city cannot be empty." }
  }

  const normalized = CITY_MAP[key]
  if (!normalized) {
    return { city: cityInput, isValid: false, error: `Unsupported city value: ${cityInput}` }
  }

  return { city: normalized, isValid: true }
}

module.exports = {
  normalizeCity,
}
