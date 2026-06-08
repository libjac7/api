
import db from '../config/db.js';

export const obtenerDetallePlanPagos = async (req, res) => {
    const idUsAutenticado = req.user?.id_usuario;
    const token = req.headers.authorization;

    if (!token) {
        return res.status(401).json({
            data: { code: 401, message: "TOKEN_DE_ACCESO_REQUERIDO" }
        });
    }

    const { id_plan } = req.params;

    if (!id_plan || id_plan.trim() === '') {
        return res.status(400).json({
            data: { code: 400, message: "PARAMETRO_ID_PLAN_FALTANTE" }
        });
    }

    try {
        console.log(` [${idUsAutenticado}] consultando Plan de Pagos: [${id_plan.trim()}]`);

        const queryStr = 'CALL sp_obtener_detalle_plan_pagos(?);';
        // 1. Obtenemos el resultado 
        const [resultadoSP] = await db.query(queryStr, [id_plan.trim()]);

        if (!resultadoSP || resultadoSP.length === 0 || !resultadoSP[0] || resultadoSP[0].length === 0) {
            console.warn(`PLAN NO ENCONTRADO: El id_plan [${id_plan}] no existe en la base de datos.`);
            return res.status(404).json({
                data: { code: 404, message: "PLAN_PAGOS_NO_ENCONTRADO" }
            });
        }
        const primeraFila = resultadoSP[0][0];
        const rawData = primeraFila.plan_json;

        if (!rawData) {
            console.warn(`PLAN VACÍO: La columna plan_json devolvió null para el id_plan [${id_plan}].`);
            return res.status(404).json({
                data: { code: 404, message: "PLAN_PAGOS_VACIO" }
            });
        }

        // Si ya es un objeto de JS, se va directo. 
        // Si viene como String plano, se le aplica el parseo.
        let detallePlan;
        if (typeof rawData === 'string') {
            try {
                detallePlan = JSON.parse(rawData);
            } catch (jsonErr) {
                console.error("❌ Error parseando string a JSON en controlador:", jsonErr);
                detallePlan = rawData; 
            }
        } else {
            detallePlan = rawData;
        }

        console.log(`CONSULTA EXITOSA: Datos del plan [${id_plan}] procesados correctamente.`);

        // 4. Respondemos con la estructura
        return res.status(200).json({
            data: {
                code: 200,
                message: "PLAN_PAGOS_PROCESADO_CON_EXITO",
                detalle: detallePlan
            }
        });

    } catch (error) {
        console.error(" ERROR CRÍTICO EN CONTROLADOR DE PLAN DE PAGOS:", error.message || error);
        return res.status(500).json({
            data: { code: 500, message: "ERROR_INTERNO_SERVIDOR_RENDER" }
        });
    }
};
