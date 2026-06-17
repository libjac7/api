import db from '../config/db.js';
import { enviarRespuesta } from '../utils/response.js';

export const requerirPermiso = (nombrePermiso) => {
    return async (req, res, next) => {
        // Se recupera el ID del operador desde las credenciales del token inyectadas en el middleware de auth (login)
        const idUsuario = req.user?.id_usuario || req.user?.id_us || req.user?.id;

        if (!idUsuario) {
            console.error("Permisos Middleware: No se encontró un ID de usuario válido en el token JWT.");
            return res.status(401).json(enviarRespuesta('AUTENTICACION_REQUERIDA'));
        }

        try {
            // Se ejecuta el sp de BD para la verificacion de permisos
            const query = `
                CALL sp_verificar_permiso_usuario(?, ?, @tiene);
                SELECT @tiene AS tienePermiso;
            `;
            
            const [result] = await db.query(query, [idUsuario, nombrePermiso]);
            const autorizacion = result[1][0];

            // Si el procedimiento devuelve 1, el acceso es concedido (por rol o excepción de Whitelist)
            if (autorizacion && autorizacion.tienePermiso === 1) {
                return next(); // Acceso concedido
            }

            console.log(`ACCESO RECHAZADO: El usuario [${idUsuario}] intento operar la ruta sin el permiso: [${nombrePermiso}]`);
            return res.status(403).json(enviarRespuesta('ACCESO_DENEGADO_PERMISO'));

        } catch (error) {
            console.error("Error crítico en el middleware de permisos:", error);
            return res.status(500).json(enviarRespuesta('ERROR_SERVIDOR'));
        }
    };
};