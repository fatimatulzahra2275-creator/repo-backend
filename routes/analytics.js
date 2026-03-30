const express = require("express")
const router = express.Router()

const supabase = require("../supabaseClient")

const SUPABASE_TIMEOUT_MS = 10000
const average = (values) => {
  if (!values.length) return 0
  const sum = values.reduce((acc, value) => acc + value, 0)
  return Number((sum / values.length).toFixed(2))
}

router.get("/overview", async (req, res) => {
  try {
    const totalOrdersQuery = supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .abortSignal(AbortSignal.timeout(SUPABASE_TIMEOUT_MS))

    const highRiskOrdersQuery = supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .gt("risk_score", 60)
      .abortSignal(AbortSignal.timeout(SUPABASE_TIMEOUT_MS))

    const verificationPendingQuery = supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .eq("status", "verification_pending")
      .abortSignal(AbortSignal.timeout(SUPABASE_TIMEOUT_MS))

    const avgRtoProbabilityQuery = supabase
      .from("orders")
      .select("rto_probability")
      .not("rto_probability", "is", null)
      .abortSignal(AbortSignal.timeout(SUPABASE_TIMEOUT_MS))

    const [totalOrdersResult, highRiskResult, verificationPendingResult, avgRtoResult] = await Promise.all([
      totalOrdersQuery,
      highRiskOrdersQuery,
      verificationPendingQuery,
      avgRtoProbabilityQuery,
    ])

    if (totalOrdersResult.error) {
      return res.status(500).json({ error: `Failed to fetch total orders: ${totalOrdersResult.error.message}` })
    }

    if (highRiskResult.error) {
      return res.status(500).json({ error: `Failed to fetch high-risk orders: ${highRiskResult.error.message}` })
    }

    if (verificationPendingResult.error) {
      return res.status(500).json({
        error: `Failed to fetch verification pending count: ${verificationPendingResult.error.message}`,
      })
    }

    if (avgRtoResult.error) {
      return res.status(500).json({ error: `Failed to fetch average RTO probability: ${avgRtoResult.error.message}` })
    }

    const rtoRows = avgRtoResult.data || []
    const rtoSum = rtoRows.reduce((sum, row) => sum + (Number(row.rto_probability) || 0), 0)
    const avgRtoProbability = rtoRows.length ? Number((rtoSum / rtoRows.length).toFixed(2)) : 0

    return res.json({
      total_orders: totalOrdersResult.count || 0,
      high_risk_orders: highRiskResult.count || 0,
      verification_pending: verificationPendingResult.count || 0,
      avg_rto_probability: avgRtoProbability,
    })
  } catch (error) {
    if (error?.name === "AbortError" || error?.name === "TimeoutError") {
      return res.status(500).json({ error: "Supabase connection timed out while fetching analytics" })
    }
    return res.status(500).json({ error: `Failed to fetch analytics overview: ${error?.message || "Unknown error"}` })
  }
})

router.get("/risk", async (req, res) => {
  try {
    const lowQuery = supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .lt("risk_score", 30)
      .abortSignal(AbortSignal.timeout(SUPABASE_TIMEOUT_MS))

    const mediumQuery = supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .gte("risk_score", 30)
      .lte("risk_score", 60)
      .abortSignal(AbortSignal.timeout(SUPABASE_TIMEOUT_MS))

    const highQuery = supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .gt("risk_score", 60)
      .lte("risk_score", 80)
      .abortSignal(AbortSignal.timeout(SUPABASE_TIMEOUT_MS))

    const veryHighQuery = supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .gt("risk_score", 80)
      .abortSignal(AbortSignal.timeout(SUPABASE_TIMEOUT_MS))

    const [lowResult, mediumResult, highResult, veryHighResult] = await Promise.all([
      lowQuery,
      mediumQuery,
      highQuery,
      veryHighQuery,
    ])

    if (lowResult.error) return res.status(500).json({ error: `Failed to fetch low risk count: ${lowResult.error.message}` })
    if (mediumResult.error) return res.status(500).json({ error: `Failed to fetch medium risk count: ${mediumResult.error.message}` })
    if (highResult.error) return res.status(500).json({ error: `Failed to fetch high risk count: ${highResult.error.message}` })
    if (veryHighResult.error) {
      return res.status(500).json({ error: `Failed to fetch very high risk count: ${veryHighResult.error.message}` })
    }

    return res.json({
      low: lowResult.count || 0,
      medium: mediumResult.count || 0,
      high: highResult.count || 0,
      very_high: veryHighResult.count || 0,
    })
  } catch (error) {
    if (error?.name === "AbortError" || error?.name === "TimeoutError") {
      return res.status(500).json({ error: "Supabase connection timed out while fetching risk analytics" })
    }
    return res.status(500).json({ error: `Failed to fetch risk analytics: ${error?.message || "Unknown error"}` })
  }
})

router.get("/rto", async (req, res) => {
  try {
    const avgQuery = supabase
      .from("orders")
      .select("rto_probability")
      .not("rto_probability", "is", null)
      .abortSignal(AbortSignal.timeout(SUPABASE_TIMEOUT_MS))

    const above50Query = supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .gt("rto_probability", 50)
      .abortSignal(AbortSignal.timeout(SUPABASE_TIMEOUT_MS))

    const [avgResult, above50Result] = await Promise.all([avgQuery, above50Query])

    if (avgResult.error) {
      return res.status(500).json({ error: `Failed to fetch RTO probability values: ${avgResult.error.message}` })
    }
    if (above50Result.error) {
      return res.status(500).json({ error: `Failed to fetch RTO > 50 count: ${above50Result.error.message}` })
    }

    const rtoValues = (avgResult.data || []).map((row) => Number(row.rto_probability) || 0)
    return res.json({
      avg_rto_probability: average(rtoValues),
      high_rto_probability_orders: above50Result.count || 0,
    })
  } catch (error) {
    if (error?.name === "AbortError" || error?.name === "TimeoutError") {
      return res.status(500).json({ error: "Supabase connection timed out while fetching RTO analytics" })
    }
    return res.status(500).json({ error: `Failed to fetch RTO analytics: ${error?.message || "Unknown error"}` })
  }
})

router.get("/couriers", async (req, res) => {
  try {
    const couriersResult = await supabase
      .from("couriers")
      .select("id, name, success_rate")
      .abortSignal(AbortSignal.timeout(SUPABASE_TIMEOUT_MS))

    if (couriersResult.error) {
      return res.status(500).json({ error: `Failed to fetch couriers: ${couriersResult.error.message}` })
    }

    const ordersResult = await supabase
      .from("orders")
      .select("courier_id, rto_probability")
      .not("courier_id", "is", null)
      .abortSignal(AbortSignal.timeout(SUPABASE_TIMEOUT_MS))

    if (ordersResult.error) {
      return res.status(500).json({ error: `Failed to fetch courier orders: ${ordersResult.error.message}` })
    }

    const ordersByCourier = (ordersResult.data || []).reduce((acc, row) => {
      const id = row.courier_id
      if (!acc[id]) acc[id] = []
      acc[id].push(row)
      return acc
    }, {})

    const analytics = (couriersResult.data || []).map((courier) => {
      const courierOrders = ordersByCourier[courier.id] || []
      const rtoValues = courierOrders
        .map((row) => Number(row.rto_probability))
        .filter((value) => Number.isFinite(value))

      return {
        courier_id: courier.id,
        courier_name: courier.name,
        total_orders_assigned: courierOrders.length,
        avg_rto_probability: average(rtoValues),
        avg_courier_success_rate: Number(courier.success_rate) || 0,
      }
    })

    return res.json({ couriers: analytics })
  } catch (error) {
    if (error?.name === "AbortError" || error?.name === "TimeoutError") {
      return res.status(500).json({ error: "Supabase connection timed out while fetching courier analytics" })
    }
    return res.status(500).json({ error: `Failed to fetch courier analytics: ${error?.message || "Unknown error"}` })
  }
})

module.exports = router
