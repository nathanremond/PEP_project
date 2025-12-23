import express from "express";
import Driversstanding from "../schemas/driversstandingschema.js";

const router = express.Router();

router.get("/", async(req, res) => {
    const data = await Driversstanding.find();
    return res.status(200).json(data);
});

export default router;
