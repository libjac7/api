import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import db from '../config/db.js';

export const login = async (req, res) => {
    const { username, password } = req.body;

    // Validar estructura del JSON entrante
    if (!username || typeof username !== 'string' || !password || typeof password !== 'string') {
        console.warn("INTENTO DE LOGIN FALLIDO: Parametros inválidos en el Body.");
        return res.status(400).json({ 
            data: {
                code: 400, 
                message: "El nombre de usuario (username) y la contraseña (password) son obligatorios." 
            }
        });
    }

    try {
        // Busca datos en BD
        const query = `
            SELECT
                u.id_emp,
                u.id_us, 
                u.pass_us, 
                u.token_version, 
                e.name_emp, 
                e.ape_emp, 
                r.name_rol,
                u.es_password_defecto
            FROM usuarios u
            INNER JOIN roles r ON u.id_rol = r.id_rol
            INNER JOIN empleados e ON u.id_emp = e.id_emp
            WHERE u.name_us = ? AND u.id_est = (SELECT id_est FROM estados WHERE name_est = 'activo' LIMIT 1)
        `;
        
        const [usuarios] = await db.query(query, [username.trim()]);

        if (usuarios.length === 0) {
            console.warn(`LOGIN FALLIDO: El usuario [${username.trim()}] no existe o esta inactivo.`);
            return res.status(401).json({ 
                data: { code: 401, message: "Credenciales inválidas o usuario inactivo." } 
            });
        }

        const usuario = usuarios[0];

        // Validacion de contraseña
        const coinciden = await bcrypt.compare(password.trim(), usuario.pass_us);
        if (!coinciden) {
            console.warn(`LOGIN FALLIDO: Contraseña incorrecta para el usuario [${username.trim()}].`);
            return res.status(401).json({ 
                data: { code: 401, message: "Credenciales invalidas." } 
            });
        }

        // datos JWT
        const payload = {
            id_emp: usuario.id_emp,
            id_usuario: usuario.id_us,
            rol: usuario.name_rol,
            version: usuario.token_version
        };

        // Token con cigencia de 1H
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

        console.log(`LOGIN EXITOSO: El usuario [${usuario.id_us}] inicio sesion. Token Version: [${usuario.token_version}].`);

        // Respuesta
        return res.status(200).json({
            data: {
                code: 200,
                message: "Login exitoso.",
                token,
                usuario: {
                    id_emp: usuario.id_emp,
                    id: usuario.id_us,
                    rol: usuario.name_rol,
                    nombre: usuario.name_emp,
                    apellido: usuario.ape_emp,
                    es_password_defecto: usuario.es_password_defecto
                }
            }
        });

    } catch (error) {
        console.error("ERROR CRÍTICO EN LOGIN:", error);
        return res.status(500).json({ 
            data: { code: 500, message: "Error interno en el servidor." } 
        });
    }
};