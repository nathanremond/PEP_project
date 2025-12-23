import express from "express";
import ConstructorsStanding from "../schemas/constructorsstandingschema.js";

const router = express.Router();

router.get("/", async(req, res) => {
    const data = await ConstructorsStanding.find();
    return res.status(200).json(data);
});

export default router;
