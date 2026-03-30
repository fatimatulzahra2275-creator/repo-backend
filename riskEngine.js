function calculateRisk(order, customer) {
    let risk = 0
    const reasons = []

    if (order.order_value > 5000) {
        risk += 20
        reasons.push("Order value is above 5000, increasing risk by 20.")
    }

    if (order.city === "Interior Sindh") {
        risk += 30
        reasons.push("Destination city is Interior Sindh, increasing risk by 30.")
    }

    if (!customer) {
        risk += 20
        reasons.push("Customer is new/unrecognized, increasing risk by 20.")
    }

    if (customer) {
        if (customer.orders_count > 5) {
            risk -= 10
            reasons.push("Customer has more than 5 prior orders, reducing risk by 10.")
        }

        if (customer.rto_history > 2) {
            risk += 40
            reasons.push("Customer has high RTO history (>2), increasing risk by 40.")
        }
    }

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