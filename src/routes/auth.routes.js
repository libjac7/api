//URL PUBLICA
import { Router } from 'express';
import { login } from '../controllers/auth.controller.js';
import { registrarEmpleado } from '../controllers/emp.controller.js';

const router = Router();
router.post('/login', login);

// Temporal para crear usuario sin verificacion de jwt
//router.post('/primer-empleado', registrarEmpleado);

export default router;