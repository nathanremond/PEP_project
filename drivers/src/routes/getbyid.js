import express from "express";

const router = express.Router();

router.get("/:id", (req, res) => {
    const { id } = req.params;
    const driver = req.app.locals.driversData.find(
        (driver) => driver.driverId == id);
    
    if (!driver) return res.status(404).json({ error: `Driver ${id} not found` });
    
    res.json(driver);
});

export default router;
