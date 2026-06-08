import express from 'express';
import { 
    obtenerEstados, 
    obtenerRoles, 
    obtenerDepartamentos, 
    obtenerMunicipiosPorDepartamento, 
    obtenerPlanesFinanciamiento 
} from '../controllers/catalogos.controller.js';
import { verificarJWT } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.get('/estados', verificarJWT, obtenerEstados);
router.get('/roles', verificarJWT, obtenerRoles);
router.get('/departamentos', verificarJWT, obtenerDepartamentos);
router.get('/planes-financiamiento', verificarJWT, obtenerPlanesFinanciamiento);
router.get('/municipios/:id_dep', verificarJWT, obtenerMunicipiosPorDepartamento);

export default router;