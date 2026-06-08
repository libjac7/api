export const DiccionarioMensajes = {
    // exito
    EXITO: { code: 200, message: 'Solicitud exitosa.' },
    CONTRASENA_DEFECTO: { code: 200, message: 'Autenticación inicial correcta. Requiere cambiar contraseña.' },
    CREADO: { code: 201, message: 'Creado correctamente.' },

    // error de cliente
    PARAMETROS_FALTANTES: { code: 400, message: 'Faltan parámetros obligatorios en la petición.' },
    PARAMETROS_INVALIDOS: { code: 400, message: 'Parámetros no válidos.' },
    CATALOGO_INVALIDO: { code: 400, message: 'Los datos de catálogo provistos no son válidos.' },
    
    NO_AUTORIZADO: { code: 401, message: 'Acceso denegado: Se requiere un token de sesión activo.' },
    TOKEN_EXPIRADO: { code: 401, message: 'Token inválido o expirado. Inicie sesión nuevamente.' },
    CREDENCIALES_INCORRECTAS: { code: 401, message: 'Credenciales incorrectas o usuario inactivo.' },
    ROL_NO_AUTORIZADO: { code: 403, message: 'Operación rechazada: No cuenta con los permisos de rol requeridos para esta acción.' },

    NO_ENCONTRADO: { code: 404, message: 'El recurso solicitado no fue encontrado.' },
    
    // insertar usuario
    USUARIO_REPETIDO: { code: 409, message: 'El nombre de usuario ya se encuentra registrado.' },
    EMAIL_REPETIDO: { code: 409, message: 'El correo electrónico ya se encuentra registrado.' },
    DPI_REPETIDO: { code: 409, message: 'El número de DPI ya se encuentra registrado.' },

    // Insertar cliente
    CLIENTE_DPI_REPETIDO: { code: 409, message: 'El número de DPI de este cliente ya se encuentra registrado.' },
    CLIENTE_EMAIL_REPETIDO: { code: 409, message: 'El correo electrónico de este cliente ya se encuentra registrado.' },

    // error de servidor
    ERROR_SERVIDOR: { code: 500, message: 'Error crítico interno en el servidor.' },
    ERROR_BASE_DATOS: { code: 500, message: 'Error interno en la base de datos al registrar.' }
};