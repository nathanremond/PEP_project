import express from "express";
import ConstructorsStanding from "../schemas/constructorsstandingschema.js";

const router = express.Router();

router.get("/:season", async (req, res) => {
    try {
        const { season } = req.params;

        const constructorsstanding = await ConstructorsStanding.findOne({ season: Number(season) });

        if (!constructorsstanding) return res.status(404).json({ error: `Constructorsstanding ${season} not found` });

        return res.status(200).json(constructorsstanding);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

export default router;
