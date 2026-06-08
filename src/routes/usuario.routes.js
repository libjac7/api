import { Router } from 'express';
import { cambiarPassword } from '../controllers/usuario.controller.js';
import { verificarJWT } from '../middlewares/auth.middleware.js';

const router = Router();

router.put('/:id/password', verificarJWT, cambiarPassword);

export default router;