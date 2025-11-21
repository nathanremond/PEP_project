import express from "express";

const router = express.Router();

router.get("/:id", (req, res) => {
    const { id } = req.params;
    const constructor = req.app.locals.constructorsData.find(
        (constructor) => constructor.constructorId == id);
    
    if (!constructor) return res.status(404).json({ error: `Constructor ${id} not found` });
    
    res.json(constructor);
});

export default router;
