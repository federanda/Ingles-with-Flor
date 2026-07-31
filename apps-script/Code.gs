/**
 * ============================================================
 *  BACKEND LIVIANO PARA "COMPRAR ACCESO" — Ingles with Flor
 * ============================================================
 *
 * Qué hace este script:
 *  1. Recibe el aviso (webhook) de Mercado Pago cuando alguien paga.
 *  2. Le pregunta a la API de Mercado Pago si ese pago está
 *     realmente aprobado (nunca confía ciegamente en el aviso).
 *  3. Si está aprobado, guarda la compra en una hoja de cálculo
 *     y le manda por email al comprador un link único de acceso.
 *  4. Cuando el comprador entra a ese link (acceso.html?token=...),
 *     el sitio le pregunta a este mismo script "¿este token es
 *     válido?" y, si lo es, le muestra el material del curso.
 *
 * -----------------------------------------------------------
 *  CONFIGURACIÓN (se hace una sola vez)
 * -----------------------------------------------------------
 *  1. Creá una Google Sheet nueva (o usá una que ya tengas).
 *  2. Renombrá la primera hoja como "Accesos" (así, exacto).
 *  3. En la fila 1, poné estos encabezados, uno por columna:
 *       A: Timestamp | B: PaymentId | C: Curso | D: Email | E: Token | F: Estado
 *  4. Extensiones > Apps Script. Borrá lo que haya y pegá TODO este archivo.
 *  5. Arriba a la izquierda, Proyecto sin título > ponele un nombre.
 *  6. Ícono de engranaje (Configuración del proyecto) > Propiedades del
 *     script > Agregar propiedad del script:
 *        Nombre:  MP_ACCESS_TOKEN
 *        Valor:   tu Access Token PRIVADO de Mercado Pago
 *                 (developers.mercadopago.com > Tus integraciones >
 *                 la app que crees > Credenciales de producción)
 *  7. Completá el objeto CURSOS más abajo con tus cursos reales.
 *  8. Implementar (botón celeste, arriba a la derecha) > Nueva implementación:
 *        - Tipo: Aplicación web
 *        - Ejecutar como: Yo (tu cuenta)
 *        - Quién tiene acceso: Cualquier usuario
 *     Autorizá los permisos que te pida Google. Copiá la URL que
 *     termina en /exec — la vas a necesitar en dos lugares:
 *        a) En Mercado Pago, como webhook (ver paso 9).
 *        b) En acceso.html, en la constante APPS_SCRIPT_URL.
 *  9. En Mercado Pago: Tu negocio > Configuración > Notificaciones
 *     (webhooks) > pegá la URL del paso 8 como "URL de producción"
 *     y activá el evento "Pagos". Esto se configura UNA sola vez
 *     y aplica a todos los links de pago de tu cuenta.
 * 10. Al crear cada "Link de pago" en Mercado Pago, en Configuración
 *     avanzada completá "Referencia externa" con el ID del curso
 *     tal cual está en el objeto CURSOS de abajo (ej: "basics").
 *     Así el script sabe qué curso corresponde a cada pago.
 *
 *  Cada vez que agregues o cambies un curso en CURSOS, tenés que
 *  volver a "Implementar > Administrar implementaciones > Editar >
 *  Nueva versión" para que el cambio se publique.
 * -----------------------------------------------------------
 */

const SHEET_NAME = 'Accesos';
const WHATSAPP_URL = 'https://wa.me/5492323530200';
const SITE_URL = 'https://federanda.github.io/Ingles-with-Flor';

// Un bloque por curso. La clave (ej. "basics") es la "Referencia externa"
// que vas a poner en el Link de pago de Mercado Pago.
const CURSOS = {
  basics: {
    titulo: 'Inglés desde cero',
    materiales: [
      { texto: 'Ver clases (carpeta de Google Drive)', url: 'https://drive.google.com/REEMPLAZAR-CON-TU-CARPETA' },
      { texto: 'Descargar guía en PDF', url: 'https://drive.google.com/REEMPLAZAR-CON-TU-PDF' },
    ],
  },
  // Para sumar otro curso, copiá este bloque cambiando la clave y los datos:
  // fluency: {
  //   titulo: 'Saltar el plateau',
  //   materiales: [ { texto: 'Ver clases', url: 'https://...' } ],
  // },
};

/**
 * Mercado Pago llama a esta función automáticamente cuando hay un pago.
 * No la ejecutás vos a mano.
 */
function doPost(e) {
  try {
    var body = {};
    if (e.postData && e.postData.contents) {
      try { body = JSON.parse(e.postData.contents); } catch (parseErr) { body = {}; }
    }

    var paymentId = (body.data && body.data.id) || e.parameter['data.id'] || e.parameter.id;
    var tipo = body.type || e.parameter.type || body.topic || e.parameter.topic;

    // Solo nos interesan las notificaciones de pagos
    if (!paymentId || (tipo && tipo !== 'payment')) {
      return ContentService.createTextOutput('ignorado');
    }

    procesarPago(paymentId);
    return ContentService.createTextOutput('ok');
  } catch (err) {
    // Igual respondemos 200 para que Mercado Pago no reintente en loop
    return ContentService.createTextOutput('error registrado: ' + err);
  }
}

function procesarPago(paymentId) {
  var accessToken = PropertiesService.getScriptProperties().getProperty('MP_ACCESS_TOKEN');
  if (!accessToken) {
    throw new Error('Falta configurar MP_ACCESS_TOKEN en Propiedades del script');
  }

  var resp = UrlFetchApp.fetch('https://api.mercadopago.com/v1/payments/' + paymentId, {
    headers: { Authorization: 'Bearer ' + accessToken },
    muteHttpExceptions: true,
  });
  var payment = JSON.parse(resp.getContentText());

  // Solo damos acceso si Mercado Pago confirma que está aprobado de verdad
  if (payment.status !== 'approved') return;

  var cursoId = payment.external_reference;
  var curso = CURSOS[cursoId];
  if (!curso) return; // referencia externa vacía o que no coincide con ningún curso

  var email = payment.payer && payment.payer.email;
  if (!email) return;

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);

  // Evitamos duplicar el acceso si Mercado Pago reintenta el mismo aviso
  var filas = sheet.getDataRange().getValues();
  for (var i = 1; i < filas.length; i++) {
    if (String(filas[i][1]) === String(paymentId)) return;
  }

  var token = Utilities.getUuid();
  sheet.appendRow([new Date(), paymentId, cursoId, email, token, 'approved']);

  var link = SITE_URL + '/acceso.html?token=' + token;
  MailApp.sendEmail({
    to: email,
    subject: 'Tu acceso a "' + curso.titulo + '" — Ingles with Flor',
    htmlBody:
      '<p>¡Hola! Gracias por tu compra 🎉</p>' +
      '<p>Ya podés entrar a tu material acá:</p>' +
      '<p><a href="' + link + '">' + link + '</a></p>' +
      '<p>Cualquier duda, escribime por WhatsApp: <a href="' + WHATSAPP_URL + '">' + WHATSAPP_URL + '</a></p>' +
      '<p>— Flor</p>',
  });
}

/**
 * acceso.html llama a esta función (vía fetch) pasándole el token
 * que el comprador recibió por email, para saber qué material mostrarle.
 */
function doGet(e) {
  var token = e.parameter.token;
  var resultado = { ok: false };

  if (token) {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    var filas = sheet.getDataRange().getValues();
    for (var i = 1; i < filas.length; i++) {
      if (filas[i][4] === token && filas[i][5] === 'approved') {
        var curso = CURSOS[filas[i][2]];
        if (curso) {
          resultado = { ok: true, titulo: curso.titulo, materiales: curso.materiales };
        }
        break;
      }
    }
  }

  return ContentService
    .createTextOutput(JSON.stringify(resultado))
    .setMimeType(ContentService.MimeType.JSON);
}
