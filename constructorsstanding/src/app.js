import express from "express";
import connectMongo from "./config/db.mongo.js";
import getall from "./routes/getall.js";
import getbyid from "./routes/getbyid.js";
import create from "./routes/create.js";
import health from "./routes/health.js";

const app = express();

app.use(express.json());
connectMongo();

app.use("/", getall);
app.use("/", getbyid);
app.use("/", create);
app.use("/", health);

export default app;
