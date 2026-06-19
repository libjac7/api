import { Router } from 'express';
import { registrarEmpleado, obtenerInformacionEmpleados, asignarJefeAEmpleado, actualizarEmpleado } from '../controllers/emp.controller.js';
import { verificarJWT } from '../middlewares/auth.middleware.js';

const router = Router();

router.post('/', verificarJWT, registrarEmpleado);
router.post('/inf-empleado', verificarJWT, obtenerInformacionEmpleados);
router.post('/asignar-jefe', verificarJWT, asignarJefeAEmpleado);
router.put('/actualizar/:id', verificarJWT, actualizarEmpleado);

export default router;
