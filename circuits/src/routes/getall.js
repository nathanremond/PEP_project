import express from "express";

const router = express.Router();

router.get("/", (req, res) => {
    const circuits = req.app.locals.circuitsData;
    res.json(circuits);
});

export default router;
