import { Router } from 'express';
import { registrarEmpleado, obtenerInformacionEmpleados, asignarJefeAEmpleado } from '../controllers/emp.controller.js';
import { verificarJWT } from '../middlewares/auth.middleware.js';

const router = Router();

router.post('/', verificarJWT, registrarEmpleado);
router.post('/inf-empleado', verificarJWT, obtenerInformacionEmpleados);
router.post('/asignar-jefe', verificarJWT, asignarJefeAEmpleado);

export default router;
