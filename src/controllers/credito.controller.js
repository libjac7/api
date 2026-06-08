import db from '../config/db.js';

export const afiliarCredito = async (req, res) => {
    // Autenticacion
    const idUsAutenticado = req.user?.id_usuario;
    const rolCrudo = req.user && req.user.rol ? req.user.rol : '';
    const rolOperador = rolCrudo.trim().toLowerCase();

    // Parametro de body
    const { id_cli, id_finan, monto_otorgado, total_cuotas } = req.body;

    console.log(`🏦 INTENTO DE AFILIACIÓN DE CRÉDITO -> Operador: [${idUsAutenticado}] con Rol: '${rolOperador}'`);

    //Control de acceso por rol
    const rolesPermitidos = ['administrador', 'gerente', 'secretaria'];
    
    if (!rolesPermitidos.includes(rolOperador)) {
        console.warn(`BLOQUEO DE SEGURIDAD: El usuario [${idUsAutenticado}] con rol '${rolOperador}' intento crear un credito sin privilegios.`);
        return res.status(403).json({
            data: {
                code: 403,
                message: "No esta autorizado para realizar esta accion"
            }
        });
    }

    // validacion en body
    if (!id_cli || !id_finan || !monto_otorgado || !total_cuotas) {
        return res.status(400).json({
            data: {
                code: 400,
                message: "Campos obligatiorios faltantes"
            }
        });
    }

    if (isNaN(monto_otorgado) || monto_otorgado <= 0 || isNaN(total_cuotas) || total_cuotas <= 0) {
        return res.status(400).json({
            data: {
                code: 400,
                message: "El monto otorgado y el total de cuotas deben ser numeros mayores a cero."
            }
        });
    }

    try {
        console.log(`PROCESANDO TRANSACCION -> Cliente: [${id_cli}], Plan: [${id_finan}], Monto: Q.${monto_otorgado}`);

        // Ejecuta el sp en BD
        const query = `
            CALL sp_crear_credito_cliente(?, ?, ?, ?, @cod, @men);
            SELECT @cod AS codigo, @men AS mensaje;
        `;

        const [rawResult] = await db.query(query, [id_cli.trim(), id_finan.trim(), monto_otorgado, total_cuotas]);
        const datasetSelect = rawResult.find(element => Array.isArray(element) && element[0] && 'codigo' in element[0]);
        const resultado = datasetSelect ? datasetSelect[0] : null;

        // Respuesta
        if (resultado) {
            switch (resultado.codigo) {
                case 1:
                    console.log(`CREDITO REGISTRADO CON EXITO para cliente [${id_cli}] por el operador [${idUsAutenticado}].`);
                    return res.status(201).json({
                        data: {
                            code: 201,
                            message: resultado.mensaje
                        }
                    });
                case 4 || 3:
                    console.warn(`VALIDACION DE NEGOCIO RECHAZADA EN BD: ${resultado.mensaje}`);
                    return res.status(404).json({
                        data: { code: 404, message: resultado.mensaje }
                    });

                case 5:
                    console.warn(`REGLA DE NEGOCIO VIOLADA EN BD: ${resultado.mensaje}`);
                    return res.status(409).json({
                        data: { code: 409, message: resultado.mensaje }
                    });

                default:
                    console.error("ERROR EN PROCEDIMIENTO ALMACENADO:", resultado.mensaje);
                    return res.status(500).json({
                        data: { code: 500, message: resultado.mensaje }
                    });
            }
        }

        return res.status(500).json({
            data: { code: 500, message: "No se recibio una respuesta valida desde la base de datos." }
        });

    } catch (error) {
        console.error("ERROR CRITICO EN CONTROLADOR DE CREDITOS:", error);
        return res.status(500).json({
            data: {
                code: 500,
                message: "Error critico interno en el servidor."
            }
        });
    }
};