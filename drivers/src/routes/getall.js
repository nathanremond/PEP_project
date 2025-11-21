import express from "express";

const router = express.Router();

router.get("/", (req, res) => {
    const drivers = req.app.locals.driversData;
    res.json(drivers);
});

export default router;
