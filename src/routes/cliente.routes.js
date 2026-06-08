import { Router } from 'express';
import { asignarAsesorCobro, registrarCliente, obtenerInformacion, actualizarCliente } from '../controllers/cliente.controller.js';
import { verificarJWT } from '../middlewares/auth.middleware.js'; 

const router = Router();

router.post('/', verificarJWT, registrarCliente); 
router.post('/asignar-cobro', verificarJWT, asignarAsesorCobro); 
router.get('/obtener-clientes', verificarJWT, obtenerInformacion);
router.put('/actualizar-cliente', verificarJWT, actualizarCliente)

export default router;