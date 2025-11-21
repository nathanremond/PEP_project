import express from "express";

const router = express.Router();

router.get("/", (req, res) => {
    const constructors = req.app.locals.constructorsData;
    res.json(constructors);
});

export default router;
