import { Router } from 'express';
import { asignarAsesorCobro, registrarCliente, obtenerInformacion, actualizarCliente } from '../controllers/cliente.controller.js';
import { verificarJWT } from '../middlewares/auth.middleware.js'; 
import multer from 'multer';

const router = Router();
// Almacenamiento de archivos temporales en RAM 
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {fileSize: 5 * 1024 * 1024} // 5 MB por fotografia
})
// imagenes requeridas 
const camposExpediente = upload.fields([ 
    {name: 'foto_perfil', maxCount: 1},
    {name: 'foto_dpi', maxCount: 1},
    {name: 'foto_fachada', maxCount: 1}
])

router.post('/', verificarJWT, camposExpediente, registrarCliente); // se envian las imagenes recibidas a la duncion de registro
router.post('/asignar-cobro', verificarJWT, asignarAsesorCobro); 
router.get('/obtener-clientes', verificarJWT, obtenerInformacion);
router.put('/actualizar-cliente', verificarJWT, actualizarCliente)

export default router;