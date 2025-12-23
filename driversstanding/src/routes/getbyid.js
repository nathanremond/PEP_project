import express from "express";
import Driversstanding from "../schemas/driversstandingschema.js";

const router = express.Router();

router.get("/:season", async (req, res) => {
    try {
        const { season } = req.params;

        const driversstanding = await Driversstanding.findOne({ season: Number(season) });

        if (!driversstanding) return res.status(404).json({ error: `Driversstanding ${season} not found` });

        return res.status(200).json(driversstanding);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

export default router;
