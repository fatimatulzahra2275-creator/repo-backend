const { normalizeCity } = require("./cityNormalizer")

const PK_LOCAL_REGEX = /^03\d{9}$/
const PK_E164_REGEX = /^\+923\d{9}$/
const PK_NODIAL_REGEX = /^3\d{9}$/

function normalizePakistaniPhone(phoneInput) {
  if (typeof phoneInput !== "string") {
    return { phone: phoneInput, isValid: false, error: "phone must be a string." }
  }

  let compact = phoneInput.replace(/[\s\-()]/g, "")
  if (compact.startsWith("0092")) compact = `+${compact.slice(2)}`
  if (compact.startsWith("92") && compact.length === 12) compact = `+${compact}`

  if (PK_E164_REGEX.test(compact)) {
    return { phone: `0${compact.slice(3)}`, isValid: true }
  }
  if (PK_LOCAL_REGEX.test(compact)) {
    return { phone: compact, isValid: true }
  }
  if (PK_NODIAL_REGEX.test(compact)) {
    return { phone: `0${compact}`, isValid: true }
  }

  return {
    phone: phoneInput,
    isValid: false,
    error: "phone must be a valid Pakistan mobile number (e.g., 03XXXXXXXXX or +923XXXXXXXXX).",
  }
}

function cleanAndValidateOrder(order) {
  const cleaned = { ...order }
  const errors = []

  const cityResult = normalizeCity(cleaned.city)
  if (cityResult.isValid) {
    cleaned.city = cityResult.city
  } else {
    errors.push(cityResult.error)
  }

  const phoneResult = normalizePakistaniPhone(cleaned.phone)
  if (phoneResult.isValid) {
    cleaned.phone = phoneResult.phone
  } else {
    errors.push(phoneResult.error)
  }

  return {
    isValid: errors.length === 0,
    errors,
    cleanedOrder: cleaned,
  }
}

module.exports = {
  cleanAndValidateOrder,
}
