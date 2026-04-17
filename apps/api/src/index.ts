import express from "express";
import "dotenv/config";

const PORT = process.env.PORT;

const app = express();
app.use(express.json());


app.get("/", (_req, res) => {
  res.send("Recallio API running");
});


app.listen(PORT, () => {
  console.log(`API running on port ${PORT}`);
});