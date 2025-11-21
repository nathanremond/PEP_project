import express from "express";

const router = express.Router();

router.get("/:id", (req, res) => {
    const { id } = req.params;
    const circuit = req.app.locals.circuitsData.find(
        (circuit) => circuit.circuitId == id);
    
    if (!circuit) return res.status(404).json({ error: `Circuit ${id} not found` });
    
    res.json(circuit);
});

export default router;
