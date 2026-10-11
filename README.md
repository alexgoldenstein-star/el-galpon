# El Galpón — sitio piloto

Landing + catálogo para revendedores, con pedido por WhatsApp. Sitio estático en Vercel que guarda datos, fotos y pedidos en Firebase (proyecto `el-galpon-b3cac`).

## Archivos

| Archivo | Qué es |
| --- | --- |
| `index.html` | La página |
| `styles.css` | Diseño (colores, tipografías, celular y compu) |
| `app.js` | Lógica: inicio, catálogo, carrito, compartir, panel de administrador y pedidos |
| `firebase-config.js` | Conexión a Firebase y **lista de mails administradores** |
| `firestore.rules` / `storage.rules` | Reglas de seguridad (quién lee y quién escribe) |
| `data.json` | Datos iniciales. Se usan hasta la primera vez que publicás desde el panel |
| `img/` | Fotos iniciales (las del depósito son de muestra: reemplazarlas por reales) |

## Configurar Firebase (una sola vez)

En [console.firebase.google.com](https://console.firebase.google.com) → proyecto **el-galpon-b3cac**:

1. **Authentication → Sign-in method → Google → Habilitar.**
2. **Authentication → Settings → Authorized domains:** agregá el dominio de Vercel (por ejemplo `el-galpon.vercel.app`) y tu dominio propio si lo tenés.
3. **Firestore Database → Crear base de datos** (ubicación `southamerica-east1`, São Paulo). Después, en la pestaña **Reglas**, pegá el contenido de `firestore.rules` y **Publicar**.
4. **Storage → Comenzar.** Pide pasar al plan Blaze (pago por uso, con cuota gratis que este sitio no va a superar; hay que cargar una tarjeta). En **Reglas**, pegá `storage.rules` y **Publicar**.
   - Si no querés activar Storage todavía, el sitio funciona igual: las fotos que subas quedan guardadas dentro de los datos (alcanza para unas 15–20 fotos).

## Primer uso del panel

1. Entrá a `https://tu-sitio.vercel.app/#admin` (si ya estaba abierta, recargá con F5).
2. **Ingresar con Google** con un mail administrador.
3. Vas a ver el aviso “Los datos todavía no están en Firebase”. Completá WhatsApp, dirección, horarios, razón social, CUIT, etc. y tocá **Guardar y publicar**. Desde ahí, todo se edita y publica al instante, sin GitHub.

## Pedidos

Cada vez que alguien toca **Enviar pedido por WhatsApp**, el pedido queda registrado (nombre, barrio, productos y total) en el panel, sección **Pedidos recibidos**, donde le cambiás el estado: Nuevo, Confirmado, Entregado o Cancelado.

## Agregar otro administrador

Agregá su mail (en minúsculas) en los tres lugares:
- `firebase-config.js` → `GALPON_ADMINS`
- `firestore.rules` → lista dentro de `isAdmin()` (y volver a publicar las reglas en la consola)
- `storage.rules` → la misma lista (y volver a publicar)

Después `git add . && git commit -m "Nuevo admin" && git push`.

## Actualizar el código

```
git add .
git commit -m "Cambios"
git push
```

Vercel publica solo en ~1 minuto.

## Probar en tu compu

```
npx serve .
```

y abrí `http://localhost:3000` (agregá `localhost` en Authorized domains si querés probar el login local).

## Créditos de fotos de muestra

Fotos de [Unsplash](https://unsplash.com) (licencia libre). Reemplazarlas por fotos reales de la mercadería y el depósito.
