require("dotenv").config()

const express = require("express")
const cors = require("cors")
const PORT = process.env.PORT || 5000;
const orderRoutes = require("./routes/orders")
const analyticsRoutes = require("./routes/analytics")

const app = express()

app.use(cors({
  origin: "*",
}))
app.use(express.json())

app.use("/",orderRoutes)
app.use("/analytics", analyticsRoutes)

app.listen(PORT, () => {
  console.log(`API running on port ${PORT}`);
});
console.log("SUPABASE_URL:", process.env.SUPABASE_URL)