// routes/buses.routes.js
import express from "express";
import { getBuses, updateBus } from "../controllers/buses.controller.js";

const router = express.Router();

router.get("/", getBuses);
router.put("/:bus_id", updateBus); // actualizar estado o pasajeros

export default router;
