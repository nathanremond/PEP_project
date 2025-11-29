import express from "express";
import mongoose from "mongoose";
import Race from "../schemas/raceschema.js";

const router = express.Router();

router.get("/:id", async (req, res) => {
    try {
        const { id } = req.params;

        const race = await Race.findById(id);

        if (!race) return res.status(404).json({ error: `Race ${id} not found` });

        return res.status(200).json(race);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

export default router;
