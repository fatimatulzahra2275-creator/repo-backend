const { randomUUID } = require("crypto")

const FIELD_ALIASES = {
  order_id: ["order_id", "orderId", "id"],
  customer_name: ["customer_name", "customerName", "name"],
  phone: ["phone", "phone_number", "phoneNumber", "mobile", "mobile_number"],
  city: ["city", "customer_city", "location"],
  product: ["product", "item", "product_name", "productName"],
  order_value: ["order_value", "orderValue", "amount", "total", "price"],
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const pickFirstValue = (source, keys) => {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key) && source[key] !== undefined && source[key] !== null) {
      return source[key]
    }
  }
  return undefined
}

function normalizeOrderPayload(payload) {
  const source = payload && typeof payload === "object" ? payload : {}
  const normalized = {
    order_id: pickFirstValue(source, FIELD_ALIASES.order_id) || randomUUID(),
    customer_name: pickFirstValue(source, FIELD_ALIASES.customer_name),
    phone: pickFirstValue(source, FIELD_ALIASES.phone),
    city: pickFirstValue(source, FIELD_ALIASES.city),
    product: pickFirstValue(source, FIELD_ALIASES.product),
    order_value: pickFirstValue(source, FIELD_ALIASES.order_value),
  }

  if (typeof normalized.customer_name === "string") normalized.customer_name = normalized.customer_name.trim()
  if (typeof normalized.phone === "string") normalized.phone = normalized.phone.trim()
  if (typeof normalized.city === "string") normalized.city = normalized.city.trim()
  if (typeof normalized.product === "string") normalized.product = normalized.product.trim()
  if (typeof normalized.order_value === "string" && normalized.order_value.trim() !== "") {
    normalized.order_value = Number(normalized.order_value)
  }

  return normalized
}

function validateStandardOrder(order) {
  const errors = []

  if (!order.order_id || typeof order.order_id !== "string" || !UUID_REGEX.test(order.order_id)) {
    errors.push("order_id must be a valid UUID.")
  }
  if (!order.customer_name || typeof order.customer_name !== "string") {
    errors.push("customer_name is required and must be a string.")
  }
  if (!order.phone || typeof order.phone !== "string") {
    errors.push("phone is required and must be a string.")
  }
  if (!order.city || typeof order.city !== "string") {
    errors.push("city is required and must be a string.")
  }
  if (!order.product || typeof order.product !== "string") {
    errors.push("product is required and must be a string.")
  }
  if (typeof order.order_value !== "number" || Number.isNaN(order.order_value)) {
    errors.push("order_value is required and must be a number.")
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}

module.exports = {
  normalizeOrderPayload,
  validateStandardOrder,
}
