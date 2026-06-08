import jwt from 'jsonwebtoken';
import db from '../config/db.js';

export const verificarJWT = async (req, res, next) => {
    // header de autorizacion
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.warn("⚠️ PETICIÓN RECHAZADA: Formato de token inválido o ausente.");
        return res.status(401).json({ 
            data: { 
                code: 401, 
                message: "TOKEN_REQUERIDO" 
            } 
        });
    }

    const token = authHeader.split(' ')[1];

    try {
        // Verificaion de la firma JWT
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        console.log("CONTENIDO REAL DEL TOKEN DESCODIFICADO:", decoded);

        // Verifica la version y el estado en BD
        const queryVersion = 'SELECT token_version, id_est FROM usuarios WHERE id_us = ?';
        const [rows] = await db.query(queryVersion, [decoded.id_usuario]);

        if (rows.length === 0) {
            console.warn(`TOKEN INVALIDADO: El usuario [${decoded.id_usuario}] ya no existe en el sistema.`);
            return res.status(401).json({ 
                data: { 
                    code: 401, 
                    message: "USUARIO_NO_ENCONTRADO" 
                } 
            });
        }

        const usuarioBD = rows[0];
        //Valida si el usuario fue suspendido
        if (usuarioBD.id_est !== 1) { 
             console.warn(`TOKEN INVALIDADO: El usuario [${decoded.id_usuario}] ya no está activo.`);
             return res.status(401).json({ 
                 data: { 
                     code: 401, 
                     message: "USUARIO_INACTIVO" 
                 } 
             });
        }

        // Compara versiones de contraseña
        if (decoded.version !== usuarioBD.token_version) {
            console.warn(`🚫 SESIÓN EXPULSADA: Token pide versión [${decoded.version}] pero la BD va por la [${usuarioBD.token_version}].`);
            return res.status(401).json({ 
                data: {
                    code: 401, 
                    message: "SESION_REVOCADA" 
                }
            });
        }

        // Datos en la peticion
        req.user = {
            id_usuario: decoded.id_usuario,
            rol: decoded.rol,
            version: decoded.version
        };

        // Todo correcto
        next();

    } catch (error) {
        console.error("ERROR EN VERIFICACION DE JWT:", error.message || error);

        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ 
                data: { 
                    code: 401, 
                    message: "TOKEN_EXPIRADO" 
                } 
            });
        }
        
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ 
                data: { 
                    code: 401, 
                    message: "TOKEN_INVALIDO" 
                } 
            });
        }
        return res.status(500).json({ 
            data: { 
                code: 500, 
                message: "ERROR_INTEGRIDAD_AUTENTICACION" 
            } 
        });
    }
};