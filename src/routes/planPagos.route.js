import { Router } from 'express';
import { obtenerDetallePlanPagos } from '../controllers/planPagos.Controller.js';
import { verificarJWT } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/:id_plan', verificarJWT, obtenerDetallePlanPagos);

export default router;