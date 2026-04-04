function calculateRisk(order, customer) {
    let risk = 0
    const reasons = []

    // ✅ Order Value
    if (order.order_value > 10000) {
        risk += 30
        reasons.push("High order value (>10000), increasing risk by 30.")
    } else if (order.order_value > 5000) {
        risk += 15
        reasons.push("Moderate order value (>5000), increasing risk by 15.")
    }

    // ✅ City Risk (explicit matching)
    const highRiskCities = [
        "Sukkur",
        "Larkana",
        "Jacobabad",
        "Dadu",
        "Khairpur"
    ]

    const mediumRiskCities = [
        "Peshawar",
        "Quetta",
        "Multan",
        "Hyderabad"
    ]

    if (highRiskCities.includes(order.city)) {
        risk += 25
        reasons.push(`High-risk city (${order.city}), increasing risk by 25.`)
    } else if (mediumRiskCities.includes(order.city)) {
        risk += 10
        reasons.push(`Medium-risk city (${order.city}), increasing risk by 10.`)
    } else {
        risk += 5
        reasons.push(`Low-risk city (${order.city}), small baseline risk applied.`)
    }

    // ✅ Customer
    if (!customer) {
        risk += 25
        reasons.push("New/unrecognized customer, increasing risk by 25.")
    }

    if (customer) {
        if (customer.orders_count > 5) {
            risk -= 15
            reasons.push("Repeat customer (>5 orders), reducing risk by 15.")
        }

        if (customer.rto_history > 2) {
            risk += 35
            reasons.push("High RTO history (>2), increasing risk by 35.")
        } else if (customer.rto_history > 0) {
            risk += 15
            reasons.push("Some RTO history, increasing risk by 15.")
        }
    }

    // ✅ Ensure realistic bounds
    risk = Math.max(0, Math.min(100, risk))

    if (!reasons.length) {
        reasons.push("No major risk signals detected.")
    }

    return { risk, reasons }
}

function makeDecision(risk) {
    if (risk < 30) return "Ship"
    if (risk < 60) return "Reconfirm"
    if (risk < 80) return "Hold"
    return "Cancel"
}

module.exports = { calculateRisk, makeDecision }
