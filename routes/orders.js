const express = require("express")
const router = express.Router()

const supabase = require("../supabaseClient")
const { calculateRisk, makeDecision } = require("../riskEngine")
const { normalizeOrderPayload, validateStandardOrder } = require("../utils/orderFormat")
const { cleanAndValidateOrder } = require("../utils/orderCleaner")

const SUPABASE_TIMEOUT_MS = 10000
const clampPercentage = (value) => Math.min(100, Math.max(0, value))

// GET all orders
router.get("/orders", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false })
      .abortSignal(AbortSignal.timeout(SUPABASE_TIMEOUT_MS))

    if (error) return res.status(500).json({ error: `Failed to fetch orders: ${error.message}` })

    return res.json(data || [])
  } catch (error) {
    if (error?.name === "AbortError" || error?.name === "TimeoutError") {
      return res.status(500).json({ error: "Supabase connection timed out while fetching orders" })
    }
    return res.status(500).json({ error: `Supabase connection failed: ${error?.message || "Unknown error"}` })
  }
})

// GET single order by ID
router.get("/order/:id", async (req, res) => {
  try {
    const { id } = req.params
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("id", id)
      .maybeSingle()
      .abortSignal(AbortSignal.timeout(SUPABASE_TIMEOUT_MS))

    if (error) return res.status(500).json({ error: `Failed to fetch order: ${error.message}` })
    if (!data) return res.status(404).json({ error: `Order not found for id ${id}` })

    return res.json(data)
  } catch (error) {
    if (error?.name === "AbortError" || error?.name === "TimeoutError") {
      return res.status(500).json({ error: "Supabase connection timed out while fetching order" })
    }
    return res.status(500).json({ error: `Supabase connection failed: ${error?.message || "Unknown error"}` })
  }
})

// POST /new-order with Customer Intelligence
router.post("/new-order", async (req, res) => {
  try {
    const normalizedOrder = normalizeOrderPayload(req.body)
    const validation = validateStandardOrder(normalizedOrder)
    if (!validation.isValid) {
      return res.status(400).json({ error: "Invalid order payload.", details: validation.errors })
    }

    const cleaning = cleanAndValidateOrder(normalizedOrder)
    if (!cleaning.isValid) {
      return res.status(400).json({ error: "Order cleaning/validation failed.", details: cleaning.errors })
    }

    const order = cleaning.cleanedOrder

    // Fetch customer (maybeSingle safe)
    let { data: customer, error: customerFetchError } = await supabase
      .from("customers")
      .select("*")
      .eq("phone", order.phone)
      .maybeSingle()
      .abortSignal(AbortSignal.timeout(SUPABASE_TIMEOUT_MS))

    if (customerFetchError) return res.status(500).json({ error: customerFetchError.message })

    if (!customer) {
      const { data: newCustomer, error: createError } = await supabase
        .from("customers")
        .insert([{ phone: order.phone, orders_count: 0, rto_history: 0 }])
        .select("*")
        .single()
        .abortSignal(AbortSignal.timeout(SUPABASE_TIMEOUT_MS))

      if (createError) return res.status(500).json({ error: createError.message })
      customer = newCustomer
    }

    const riskResult = calculateRisk(order, customer)
    const risk = riskResult.risk
    const reasons = Array.isArray(riskResult.reasons) ? [...riskResult.reasons] : []
    const decision = makeDecision(risk)
    reasons.push(`Decision was set to ${decision} based on risk score ${risk}.`)
    const initialStatus = risk > 60 ? "verification_pending" : "approved"

    // Fetch top courier safely
    const { data: couriers, error: courierFetchError } = await supabase
      .from("couriers")
      .select("*")
      .order("success_rate", { ascending: false })
      .limit(1)
      .abortSignal(AbortSignal.timeout(SUPABASE_TIMEOUT_MS))

    if (courierFetchError) return res.status(500).json({ error: `Failed to fetch courier: ${courierFetchError.message}` })
    if (!couriers || couriers.length === 0) return res.status(500).json({ error: "No courier available in couriers table" })

    const selectedCourier = couriers[0]
    const courierId = decision !== "Cancel" ? selectedCourier.id : null

    let rtoProbability = 0
    if (risk > 60) rtoProbability += 30
    if (customer && (customer.rto_history || 0) > 2) rtoProbability += 30
    if (customer && (customer.orders_count || 0) > 5) rtoProbability -= 10
    if (selectedCourier && (selectedCourier.success_rate || 0) < 85) rtoProbability += 20
    rtoProbability = clampPercentage(rtoProbability)

    const baseOrderInsertPayload = {
      customer_name: order.customer_name,
      phone: order.phone,
      city: order.city,
      order_value: order.order_value,
      risk_score: risk,
      decision,
      reason: reasons,
      status: initialStatus,
      courier_id: courierId,
      rto_probability: rtoProbability,
    }

    let insertPayload = { ...baseOrderInsertPayload, product: order.product }

    // Insert order
    let { data: insertedOrder, error: orderInsertError } = await supabase
      .from("orders")
      .insert([insertPayload])
      .select("*")
      .single()
      .abortSignal(AbortSignal.timeout(SUPABASE_TIMEOUT_MS))

    if (orderInsertError?.message?.includes("Could not find the 'product' column")) {
      ;({ data: insertedOrder, error: orderInsertError } = await supabase
        .from("orders")
        .insert([baseOrderInsertPayload])
        .select("*")
        .single()
        .abortSignal(AbortSignal.timeout(SUPABASE_TIMEOUT_MS)))
    }

    if (orderInsertError) return res.status(500).json({ error: orderInsertError.message })

    // Update status if needed
    const status = insertedOrder.risk_score > 60 ? "verification_pending" : "approved"
    const { data: persistedOrder, error: statusUpdateError } = await supabase
      .from("orders")
      .update({ status })
      .eq("id", insertedOrder.id)
      .select("*")
      .single()
      .abortSignal(AbortSignal.timeout(SUPABASE_TIMEOUT_MS))

    if (statusUpdateError) return res.status(500).json({ error: `Failed to update order status: ${statusUpdateError.message}` })

    // Update reasons with final decision
    const finalizedReasons = reasons
      .filter((item) => typeof item === "string" && !item.startsWith("Decision was set to"))
    finalizedReasons.push(`Decision was set to ${persistedOrder.decision} based on risk score ${persistedOrder.risk_score}.`)

    const { data: orderWithReasons, error: reasonUpdateError } = await supabase
      .from("orders")
      .update({ reason: finalizedReasons })
      .eq("id", persistedOrder.id)
      .select("*")
      .single()
      .abortSignal(AbortSignal.timeout(SUPABASE_TIMEOUT_MS))

    if (reasonUpdateError) return res.status(500).json({ error: `Failed to update order reasons: ${reasonUpdateError.message}` })

    // Update customer counts
    const rtoIncrement = decision === "Cancel" ? 1 : 0
    const { data: updatedCustomer, error: customerUpdateError } = await supabase
      .from("customers")
      .update({
        orders_count: (customer.orders_count || 0) + 1,
        rto_history: (customer.rto_history || 0) + rtoIncrement,
      })
      .eq("id", customer.id)
      .select("*")
      .single()
      .abortSignal(AbortSignal.timeout(SUPABASE_TIMEOUT_MS))

    if (customerUpdateError) return res.status(500).json({ error: customerUpdateError.message })

    // Build response
    const intelligence = {
      risk_score: orderWithReasons.risk_score,
      decision: orderWithReasons.decision,
      reason: orderWithReasons.reason || finalizedReasons,
      rto_probability: orderWithReasons.rto_probability,
      status: orderWithReasons.status,
      courier: selectedCourier
        ? { id: selectedCourier.id, name: selectedCourier.name, success_rate: selectedCourier.success_rate }
        : null,
    }

    const summary = {
      risk_band:
        intelligence.risk_score > 80
          ? "Very High"
          : intelligence.risk_score > 60
          ? "High"
          : intelligence.risk_score >= 30
          ? "Medium"
          : "Low",
      action_required: intelligence.status === "verification_pending",
      recommended_decision: intelligence.decision,
      assigned_courier: intelligence.courier?.name || null,
    }

    return res.status(201).json({
      message: "Order created successfully",
      order: orderWithReasons,
      standardized_order: order,
      intelligence,
      summary,
      customer: updatedCustomer,
    })
  } catch (error) {
    if (error?.name === "AbortError" || error?.name === "TimeoutError") {
      return res.status(504).json({ error: "Supabase request timed out" })
    }
    return res.status(500).json({ error: error?.message || "Unexpected server error" })
  }
})

module.exports = router