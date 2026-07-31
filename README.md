# Pagina-Flor
Pagina web de Flor


## Cómo activar el cobro del curso "Inglés desde cero" (con backend)

Esta versión valida el pago de verdad antes de mostrar el material, usando
Google Apps Script (gratis) + Google Sheets como base de datos + Gmail para
mandar el acceso automáticamente. Todo el detalle paso a paso está en los
comentarios de `apps-script/Code.gs` — acá el resumen:

1. **Google Sheet**: creá una hoja llamada "Accesos" con encabezados
   `Timestamp | PaymentId | Curso | Email | Token | Estado` en la fila 1.
2. **Apps Script**: en esa Sheet, Extensiones > Apps Script, pegá todo el
   contenido de `apps-script/Code.gs`.
3. **Access Token de Mercado Pago**: en Configuración del proyecto >
   Propiedades del script, agregá `MP_ACCESS_TOKEN` con tu Access Token
   privado (developers.mercadopago.com > Credenciales de producción).
4. **Completá tus cursos** en el objeto `CURSOS` dentro de `Code.gs` (título
   y links reales al material).
5. **Implementar > Nueva implementación > Aplicación web** (ejecutar como
   "Yo", acceso "Cualquier usuario"). Copiá la URL que termina en `/exec`.
6. Pegá esa URL en **dos lugares**:
   - En Mercado Pago: Tu negocio > Configuración > Notificaciones (webhooks),
     como "URL de producción", evento "Pagos". Se configura una sola vez y
     aplica a todos los links de pago de tu cuenta.
   - En `acceso.html`, en la constante `APPS_SCRIPT_URL`.
7. Al crear el **Link de pago** de cada curso en Mercado Pago, en
   Configuración avanzada completá:
   - **Referencia externa**: el id del curso (ej. `basics`, tal cual está
     en `CURSOS` dentro de `Code.gs`).
   - **URL de retorno (éxito)**: `https://federanda.github.io/Ingles-with-Flor/gracias.html`
8. Pegá el link de pago generado en `index.html`, reemplazando
   `TU-LINK-DE-MERCADOPAGO-AQUI`.

**Flujo resultante:** el comprador paga → Mercado Pago avisa a tu Apps
Script → el script confirma el pago contra la API de Mercado Pago → guarda
la fila en la Sheet → manda un email con un link único
(`acceso.html?token=...`) → esa página valida el token contra el script
antes de mostrar el material. Nadie ve el contenido sin ese token válido.

Para sumar otro curso: repetí el paso 7-8 con otra Referencia externa
(ej. `fluency`) y agregá su bloque dentro de `CURSOS` en `Code.gs` (después
tenés que volver a implementar una nueva versión del script para que el
cambio se publique).

**Nota:** la primera vez que Google te pida autorizar permisos (para leer
la Sheet y mandar emails), es normal — es tu propia cuenta autorizando tu
propio script.
