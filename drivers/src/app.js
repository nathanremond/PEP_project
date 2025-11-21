import express from "express";
import getall from "./routes/getall.js";
import getbyid from "./routes/getbyid.js";
import health from "./routes/health.js";

const app = express();

app.use("/", getall);
app.use("/", getbyid);
app.use("/", health);

export default app;