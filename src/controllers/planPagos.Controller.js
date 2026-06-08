
import db from '../config/db.js';

export const obtenerDetallePlanPagos = async (req, res) => {
    // validacion
    const idUsAutenticado = req.user?.id_usuario;
    const token = req.headers.authorization;

    if (!token) {
        return res.status(401).json({
            data: {
                code: 401,
                message: "TOKEN_DE_ACCESO_REQUERIDO"
            }
        });
    }

    //param
    const { id_plan } = req.params;

    if (!id_plan || id_plan.trim() === '') {
        return res.status(400).json({
            data: {
                code: 400,
                message: "PARAMETRO_ID_PLAN_FALTANTE"
            }
        });
    }

    try {
        console.log(`🔎 OPERADOR: [${idUsAutenticado}] consultando Plan de Pagos: [${id_plan.trim()}]`);

        //Ejecuta el sp
        const queryStr = 'CALL sp_obtener_detalle_plan_pagos(?);';
        const [rows] = await db.query(queryStr, [id_plan.trim()]);

        if (!rows || rows[0].length === 0 || rows[0][0].plan_json === null) {
            console.warn(`PLAN NO ENCONTRADO: El id_plan [${id_plan}] no existe en el sistema.`);
            return res.status(404).json({
                data: {
                    code: 404,
                    message: "PLAN_PAGOS_NO_ENCONTRADO"
                }
            });
        }
        const detallePlan = JSON.parse(rows[0][0].plan_json);

        //respuesta
        return res.status(200).json({
            data: {
                code: 200,
                message: "PLAN_PAGOS_PROCESADO_CON_EXITO",
                detalle: detallePlan
            }
        });

    } catch (error) {
        console.error("ERROR CRÍTICO EN CONTROLADOR DE PLAN DE PAGOS:", error.message || error);
        return res.status(500).json({
            data: {
                code: 500,
                message: "ERROR_INTERNO_SERVIDOR_RENDER"
            }
        });
    }
};