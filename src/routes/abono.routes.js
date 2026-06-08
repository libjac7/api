import { Router } from 'express';
import { registrarAbono } from '../controllers/abono.controller.js';
import { verificarJWT } from '../middlewares/auth.middleware.js';

const router = Router();

router.post('/', verificarJWT, registrarAbono);

export default router;