import { Router } from 'express';
import { afiliarCredito } from '../controllers/credito.controller.js';
import { verificarJWT } from '../middlewares/auth.middleware.js';

const router = Router();

router.post('/', verificarJWT, afiliarCredito);

export default router;