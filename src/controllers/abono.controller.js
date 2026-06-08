import crypto from 'crypto';
import db from '../config/db.js';

export const registrarAbono = async (req, res) => {
    // Roles permitidos
    const idUsOperador = req.user?.id_usuario;
    const rolCrudo = req.user && req.user.rol ? req.user.rol : '';
    const rolOperador = rolCrudo.trim().toLowerCase();

    const rolesPermitidos = ['asesor', 'jefe de asesores', 'secretaria', 'administrador', 'gerente'];
    if (!rolesPermitidos.includes(rolOperador)) {
        return res.status(403).json({ data: { code: 403, message: "ROL_NO_AUTORIZADO" } });
    }

    // Captura y desestructuracion del payload enviado
    const { id_plan, monto_abono, modalidad, nota } = req.body;

    // Validacion
    if (!id_plan || monto_abono === undefined || !modalidad) {
        return res.status(400).json({
            data: { code: 400, message: "PARAMETROS_FALTANTES" }
        });
    }

    try {
        const idPlanLimpio = id_plan.trim();
        const montoAbonoNumerico = parseFloat(monto_abono);
        const modalidadLimpia = modalidad.trim().toUpperCase();
        const notaLimpia = nota ? nota.trim() : 'Abono operativo de caja.';

        console.log(`INICIANDO PROCESO -> Evaluar Abono para Cuota: [${idPlanLimpio}] | Monto: Q.${montoAbonoNumerico}`);

        // Ejecuta sp de validacion
        const queryValidar = `
            CALL gestiones.sp_validar_abono_cuota(?, ?, ?, @codVal, @menVal);
            SELECT @codVal AS codigo, @menVal AS mensaje;
        `;

        const [resValidacion] = await db.query(queryValidar, [
            idPlanLimpio,
            montoAbonoNumerico,
            modalidadLimpia
        ]);

        // Mapeo para evitar caídas si resValidacion es nulo o vacío
        const datasetValidar = Array.isArray(resValidacion) 
            ? resValidacion.find(element => Array.isArray(element) && element[0] && 'codigo' in element[0]) 
            : null;
            
        const resultadoValidar = datasetValidar ? datasetValidar[0] : null;

        if (!resultadoValidar || resultadoValidar.codigo !== 1) {
            const mensajeRechazo = resultadoValidar?.mensaje || "PLAN_PAGOS_NO_ENCONTRADO";
            console.log(`RECHAZO EN PORTERIA -> Mensaje: [${mensajeRechazo}]`);
            
            return res.status(409).json({
                data: {
                    code: 409,
                    message: mensajeRechazo
                }
            });
        }

        // Si sp de validacion dio el ok pasa a ejecutar la transaccion
        console.log(`VALIDACION EXITOSA. Abriendo transaccion en caliente...`);
        
        const id_abono = `ABO-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;

        const queryEjecutar = `
            CALL gestiones.sp_insertar_abono_cuota(?, ?, ?, ?, ?, ?, @codEjec, @menEjec);
            SELECT @codEjec AS codigo, @menEjec AS mensaje;
        `;

        const [resEjecucion] = await db.query(queryEjecutar, [
            id_abono,
            idPlanLimpio,
            idUsOperador,
            montoAbonoNumerico,
            modalidadLimpia,
            notaLimpia
        ]);

        const datasetEjecutar = Array.isArray(resEjecucion)
            ? resEjecucion.find(element => Array.isArray(element) && element[0] && 'codigo' in element[0])
            : null;
            
        const resultadoEjecutar = datasetEjecutar ? datasetEjecutar[0] : null;

        if (resultadoEjecutar) {
            console.log(`RESPUESTA BD TRANSACCION -> Código: [${resultadoEjecutar.codigo}] | Mensaje: [${resultadoEjecutar.mensaje}]`);

            if (resultadoEjecutar.codigo === 1) {
                return res.status(201).json({
                    data: {
                        code: 201,
                        message: "ABONO_REALIZADO_CON_EXITO",
                        id_abono: id_abono
                    }
                });
            } else {
                return res.status(409).json({ // Cambiado a 409 para errores de lógica de negocio controlados por el SP
                    data: {
                        code: 409,
                        message: resultadoEjecutar.mensaje || "FALLO_EN_TRANSACCION_INTERNA"
                    }
                });
            }
        }

        return res.status(500).json({ data: { code: 500, message: "ERROR_DATASET_EJECUCION_VACIO" } });

    } catch (error) {
        console.error("ERROR CRITICO EN CONTROLADOR DE ABONOS:", error.message || error);
        
        // Se controlan fallos de comunicación o excepciones crudas de base de datos
        return res.status(500).json({ 
            data: { 
                code: 500, 
                message: "ERROR_INTERNO_SERVIDOR",
                detail: error.code || "INTEGRITY_EXCEPTION" 
            } 
        });
    }
};