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

1. **Authentication → Sign-in method:** habilitá **Correo electrónico/contraseña** (para cualquier mail: Hotmail, Gmail, etc.) y **Google**.
2. **Authentication → Settings → Authorized domains:** agregá el dominio de Vercel (por ejemplo `el-galpon.vercel.app`) y tu dominio propio si lo tenés.
3. **Firestore Database → Crear base de datos** (ubicación `southamerica-east1`, São Paulo). Después, en la pestaña **Reglas**, pegá el contenido de `firestore.rules` y **Publicar**.
4. **Storage → Comenzar.** Pide pasar al plan Blaze (pago por uso, con cuota gratis que este sitio no va a superar; hay que cargar una tarjeta). En **Reglas**, pegá `storage.rules` y **Publicar**.
   - Si no querés activar Storage todavía, el sitio funciona igual: las fotos que subas quedan guardadas dentro de los datos (alcanza para unas 15–20 fotos).

## Primer uso del panel

1. Entrá a `https://tu-sitio.vercel.app/#admin` (si ya estaba abierta, recargá con F5).
2. La primera vez tocá **“Es mi primera vez: crear acceso”** con tu mail, verificalo desde el mail que te llega y tocá **“Ya verifiqué”** (o usá **Ingresar con Google** si es una cuenta de Google).
3. Tocá **“Cargar datos iniciales”**. Después, en **Datos y fotos**, completá WhatsApp, dirección y horarios y tocá **Guardar y publicar**. Desde ahí, todo se edita y publica al instante, sin GitHub.

## Pedidos

Cuando el revendedor toca **Enviar pedido por WhatsApp**, el pedido se guarda con un número (ej. `#K3F9A`) y se abre WhatsApp con el mensaje ya escrito y ese número; solo tiene que tocar Enviar. En **Panel → Pedidos** los ves todos y les cambiás el estado: Nuevo, Confirmado, Listo para retirar, Entregado o Cancelado.

## Panel: qué hay en cada pestaña

- **Pedidos:** resumen y lista de pedidos. Cada pedido muestra cómo se entrega (retiro o envío a zona), el vendedor asignado y la comisión. Al marcarlo **Entregado** la comisión queda calculada y congelada.
- **Clientes:** feriantes y revendedores que compraron, con su vendedor asignado.
- **Vendedores** (administradores): alta de vendedores con su código y link, clientes, ventas, comisión a cobrar y cobrada, botón **Liquidar** y el historial de liquidaciones con el detalle para mandar por WhatsApp.
- **Contactos** (administradores): formularios de la web. Los que quieren ser vendedores se dan de alta con un toque.
- **Productos:** SKU o código interno (se ve en la lista, en cada pedido y en el mensaje de WhatsApp, y avisa si está repetido), carga rápida, ofertas, combos y estado **Por encargo** (para publicar lo que todavía no está en el depósito). Muestra vistas y agregados al carrito para medir el interés.
- **Datos y ajustes** (administradores): datos del negocio, fotos, marcas, **comisiones** (general, por rubro, extra por sumar vendedores, meses) y **envíos** por zona.
- **Equipo** (administradores).

## Vendedores y comisiones

1. **Alta:** Panel → Vendedores → Nuevo vendedor (o desde Contactos). Cada uno tiene un **código** (ej. `MARTA`) y su **link**: `https://el-galpon-seven.vercel.app/?v=MARTA`. Si cargás su mail, entra a su propio panel en `/#admin` (la primera vez con “Es mi primera vez: crear acceso”).
2. **Asignación del cliente:** el feriante queda a nombre del vendedor si entra por su link, si escribe su código en el carrito o si ya era su cliente (por teléfono). El primero que lo trajo lo conserva mientras compre: vence a los 6 meses sin compras. Desde el pedido podés reasignarlo a mano.
3. **Comisión:** se calcula al marcar el pedido como Entregado, sobre los productos (el envío no suma), con el % de cada rubro. Si el vendedor fue sumado por otro, el que lo sumó cobra un extra durante los primeros meses. Un solo nivel.
4. **Liquidación:** en Vendedores, “Liquidar” registra el pago de todo lo pendiente y marca esos pedidos como pagados. Un pedido liquidado ya no se puede cancelar ni reasignar.
5. **Promo con productos y cartel con QR:** desde el panel del vendedor, desde Vendedores (“Promo y cartel”) o desde Panel → Promos y QR. La promo muestra hasta 6 productos con foto, precio y ganancia, en formato vertical para estados o 4:5 para feed y WhatsApp. El cartel con QR sale en A4 para imprimir.
6. **Transparencia:** las reglas se muestran iguales en la web (Contacto → Quiero ser vendedor) y en el panel de cada vendedor, con sus pedidos, clientes, equipo y liquidaciones.

## Fotos de productos en promos e imágenes para compartir (una sola vez)

Para que las fotos que subís desde el panel aparezcan dentro de las promos y de las imágenes para estados, el depósito de fotos de Firebase tiene que permitir leerlas desde la web:

1. Entrá a [console.cloud.google.com](https://console.cloud.google.com), elegí el proyecto **el-galpon-b3cac** y tocá el ícono **Activar Cloud Shell** (arriba a la derecha, `>_`).
2. Pegá estas dos líneas y Enter:

```
echo '[{"origin":["*"],"method":["GET"],"maxAgeSeconds":3600}]' > cors.json
gsutil cors set cors.json gs://el-galpon-b3cac.firebasestorage.app
```

Si no lo hacés, las promos igual se arman, pero las fotos subidas salen reemplazadas por la inicial del producto.

## Cuentas: clientes, vendedores y equipo

Hay una sola puerta de entrada: el botón **Ingresar** (arriba a la derecha) o `/#cuenta`.
- **Clientes (feriantes):** crean su cuenta con nombre, WhatsApp, mail y contraseña (o con Google). En **Mi cuenta** ven sus pedidos con el estado (recibido, confirmado, listo, entregado), los repiten con un toque y editan sus datos. Los pedidos que hacen estando dentro quedan guardados en su cuenta. Si entraron por el link o QR de un vendedor, queda guardado.
- **Vendedores:** se dan de alta en Panel → Vendedores con su mail. Crean su cuenta con ese mismo mail, lo verifican y entran directo a su panel.
- **Equipo y dueño:** igual, con el mail cargado en Equipo (o en `GALPON_ADMINS`).

Para probar el portal de vendedor: Panel → Vendedores → Nuevo vendedor con un mail distinto al tuyo; en una ventana de incógnito tocá **Ingresar → No tengo cuenta: crearla** con ese mail, verificalo y tocá **Ya verifiqué**.

## Canal de difusión y QR

- En **Datos y ajustes** cargá el WhatsApp del negocio y, si tenés, el **Link del canal de WhatsApp**.
- Todos los QR (cartel, promo, panel del vendedor) apuntan a `tu-sitio/?v=CODIGO&go=canal`: la web registra al vendedor y salta sola al canal. Si no hay link de canal, abre WhatsApp con el mensaje “Quiero sumarme a la lista de difusión… vengo de parte de X (código X)”. Como el QR apunta a la web, los carteles impresos siguen andando aunque cambies el canal.
- En banners y carteles figura siempre **el WhatsApp del negocio**.
- **Panel → Promos y QR:** promo general con productos, cartel general, los de cada vendedor y los escaneos de cada QR.

## Equipo y permisos

Desde **Panel → Equipo** sumás personas por su mail, sin tocar código (los vendedores se suman desde la pestaña Vendedores):
- **Carga de productos:** agrega y edita productos, precios, fotos y stock, y ve los pedidos.
- **Administrador:** además cambia los datos del negocio, las fotos de la página y el equipo.

Los **dueños** (acceso total permanente) se definen en código: `firebase-config.js` → `GALPON_ADMINS`, y la misma lista en `firestore.rules` y `storage.rules` (volver a publicar las reglas en la consola).

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
