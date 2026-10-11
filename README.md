# El Galpón — sitio piloto

Landing + catálogo para revendedores, con pedido por WhatsApp. Sitio estático: no necesita servidor, base de datos ni instalación.

## Archivos

| Archivo | Qué es |
| --- | --- |
| `index.html` | La página |
| `styles.css` | Diseño (colores, tipografías, celular y compu) |
| `app.js` | Lógica: inicio, catálogo, carrito, compartir y panel de administrador |
| `data.json` | **Todos los datos**: negocio, fotos del depósito y productos |
| `img/` | Fotos (las del depósito son de muestra: reemplazarlas por reales) |
| `vercel.json` | Configuración de Vercel (que `data.json` no quede en caché) |

## Subirlo por primera vez

1. **GitHub:** creá un repositorio nuevo (por ejemplo `el-galpon`) y subí todos los archivos de esta carpeta, con la carpeta `img` incluida (*Add file → Upload files*, arrastrás todo y *Commit changes*).
2. **Vercel:** *Add New → Project*, elegí el repositorio `el-galpon` e *Import*. Framework: **Other**. No hace falta build command ni output directory. *Deploy*.
3. En 1 minuto queda online en `el-galpon.vercel.app` (o el nombre que te asigne).
4. **Dominio propio (opcional):** en Vercel, *Settings → Domains*, agregás `elgalpon.com.ar` y seguís los pasos de DNS que te indica.

## Editar datos y productos

1. Abrí tu sitio con `#admin` al final: `https://tu-sitio.vercel.app/#admin`
2. Completá WhatsApp, dirección, horarios, razón social, CUIT, pedido mínimo, etc. Editá productos, precios, stock y fotos. Los cambios se ven al instante (solo en tu navegador) y quedan guardados ahí aunque cierres la pestaña.
3. Tocá **Descargar data.json**.
4. En GitHub, entrá al repositorio → *Add file → Upload files* → subí el `data.json` descargado (reemplaza el anterior) → *Commit changes*.
5. Vercel publica solo en ~1 minuto.

Notas:
- El `#admin` no es una contraseña: cualquiera que lo escriba puede **probar** cambios en su propio navegador, pero nadie puede publicar sin acceso a tu GitHub.
- Las fotos que subís desde el panel quedan dentro de `data.json`. Si preferís, podés subir la foto a `img/` y en `data.json` poner su ruta (`"img/nombre.jpg"`).
- Para cambiar los precios a mano sin el panel, también podés editar `data.json` directo en GitHub (ícono del lápiz).

## Probar en tu compu

Abriendo `index.html` con doble clic no carga el catálogo (el navegador bloquea leer `data.json`). Usá un servidor local:

```
npx serve .
```

y abrí `http://localhost:3000`.

## Créditos de fotos de muestra

Fotos de [Unsplash](https://unsplash.com) (licencia libre). Reemplazarlas por fotos reales de la mercadería y el depósito.
