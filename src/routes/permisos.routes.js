import { Router } from 'express';
import { gestionarExcepcionesMasivas } from '../controllers/permisos.controller.js'
import { verificarJWT } from '../middlewares/auth.middleware.js';
import { requerirPermiso } from '../middlewares/permisos.middleware.js';

const router = Router();

// Solo un usuario con sesión activa Y que tenga el permiso de 'OTORGAR_PERMISOS' (Gerente/Admin) puede delegar o bloquear
router.post('/configurar-excepcion', verificarJWT, requerirPermiso('OTORGAR_PERMISOS'), gestionarExcepcionesMasivas);

export default router;