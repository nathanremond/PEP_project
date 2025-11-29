import express from "express";
import Race from "../schemas/raceschema.js";

const router = express.Router();

router.get("/", async(req, res) => {
    const data = await Race.find();
    return res.status(200).json(data);
});

export default router;
