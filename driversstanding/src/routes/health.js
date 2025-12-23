import express from "express";

const router = express.Router();

router.post("/health", (req, res) => {
    res.json(
        { message: "API OK" }
    )
});

export default router;