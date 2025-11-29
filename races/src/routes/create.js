import express from "express";
import Race from "../schemas/raceschema.js";

const router = express.Router();

router.post("/", async(req, res) => {
    const createdrace = await Race.create(req.body);
    return res.status(201).json(createdrace);
});

export default router;
