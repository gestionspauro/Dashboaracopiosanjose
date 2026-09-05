# Guía: publicar el dashboard en GitHub con actualización diaria

Esto te va a dejar un link público (tipo `https://tu-usuario.github.io/dashboard-acopio/`)
que se actualiza solo, todos los días, tomando los datos del Excel que tenés en Google Drive.

Importante antes de empezar: el link va a ser **público**. Cualquiera que lo tenga puede
verlo, aunque no aparezca en buscadores. Si los datos de contratos/precios son sensibles
para tus clientes, tenelo en cuenta (más detalles en el punto 6, al final).

---

## Paso 1 — Preparar la fuente de datos en Google Drive

Necesitás un link que devuelva el Excel en formato CSV, sin pedir login. La forma más
confiable es convertir tu planilla en un Google Sheet "de verdad" (no un .xlsx subido):

1. Abrí tu archivo en Google Drive.
2. Si es un `.xlsx` subido (no un Google Sheet nativo): click derecho → **Abrir con → Hojas de cálculo de Google**. Esto crea una copia como Google Sheet. Usá esa copia de acá en adelante (es la que vas a seguir editando).
3. En el Google Sheet: **Archivo → Compartir → Publicar en la web**.
4. Elegí la hoja correcta (la que tiene los datos de entregas) y como formato elegí **Valores separados por comas (.csv)**.
5. Click en **Publicar**, confirmá, y copiá el link que te da. Se ve más o menos así:
   `https://docs.google.com/spreadsheets/d/e/2PACX-XXXXXXX/pub?gid=0&single=true&output=csv`
6. Guardá ese link — lo vas a necesitar en el Paso 3.

De ahora en más, cada vez que edites y guardes ese Google Sheet, el link publicado
siempre va a reflejar los datos más recientes.

---

## Paso 2 — Crear el repositorio en GitHub

1. Entrá a [github.com](https://github.com) y creá una cuenta si todavía no tenés.
2. Click en **New repository** (botón verde, o el "+" arriba a la derecha → "New repository").
3. Nombre sugerido: `dashboard-acopio-san-jose`.
4. Dejalo como **Public**.
5. Click en **Create repository**.

---

## Paso 3 — Subir los archivos

Te dejo 5 archivos armados. Necesitás subirlos **respetando las carpetas**:

```
dashboard-acopio-san-jose/
├── index.html
├── data.json
├── script.js
└── .github/
    └── workflows/
        └── update-dashboard.yml
└── scripts/
    └── update_dashboard.py
```

**La forma más simple (sin instalar nada), usando la web de GitHub:**

1. En tu repositorio recién creado, click en **Add file → Upload files**.
2. Arrastrá `index.html`, `data.json` y `script.js` juntos (estos tres van en la raíz). Click **Commit changes**.
3. Para los archivos en carpetas, GitHub no te deja arrastrar carpetas directamente desde esa pantalla, así que hacelo así:
   - Click en **Add file → Create new file**.
   - En el campo de nombre, escribí `scripts/update_dashboard.py` (al escribir la barra `/`, GitHub crea la carpeta sola).
   - Pegá el contenido del archivo `update_dashboard.py` que te dejo abajo.
   - **Commit changes**.
   - Repetí lo mismo para `.github/workflows/update-dashboard.yml`.

Antes de agregar cada archivo, activá la extensión "Search and reference past chats" no aplica acá — simplemente copiá el contenido de cada archivo que te compartí en esta conversación (los cinco están listos para descargar más abajo).

---

## Paso 4 — Configurar el link de origen (sin exponer nada como "secreto" innecesario)

1. En tu repositorio: **Settings → Secrets and variables → Actions**.
2. Pestaña **Variables** → **New repository variable**.
3. Nombre: `SOURCE_CSV_URL`
4. Valor: el link que copiaste en el Paso 1.
5. **Add variable**.

---

## Paso 5 — Activar GitHub Pages

1. **Settings → Pages**.
2. En "Build and deployment" → Source: **Deploy from a branch**.
3. Branch: `main`, carpeta `/ (root)`.
4. **Save**.
5. Esperá 1-2 minutos. GitHub te va a mostrar el link público arriba de esa misma pantalla
   (algo como `https://tu-usuario.github.io/dashboard-acopio-san-jose/`).

---

## Paso 6 — Probar la actualización automática

1. Andá a la pestaña **Actions** de tu repositorio.
2. Vas a ver el workflow **"Actualizar dashboard"** en la lista de la izquierda. Hacé click.
3. Click en **Run workflow** (botón desplegable a la derecha) → **Run workflow** de nuevo para confirmar.
4. Esperá ~30 segundos y refrescá. Si el círculo queda verde ✅, funcionó: `data.json` se actualizó con tus datos reales de Drive.
5. Entrá al link de tu dashboard (Paso 5) y confirmá que los datos coinciden con tu Google Sheet.

De acá en más, el workflow se va a ejecutar solo **todos los días a las 09:00 UTC**
(podés cambiar el horario editando la línea `cron` en `update-dashboard.yml` — usá
[crontab.guru](https://crontab.guru) si querés otro horario). También podés forzar una
actualización cuando quieras repitiendo el paso "Run workflow".

---

## Una aclaración sobre privacidad

- El repositorio es público → cualquiera puede ver el código, incluido el link de tu
  Google Sheet publicado (que a su vez es de lectura pública, sin login).
- El sitio de GitHub Pages también es público → cualquiera con el link ve el dashboard,
  incluidos montos liquidados y datos de productores.
- Si eso te preocupa para algún cliente, las alternativas son: (a) usar un repositorio
  privado + GitHub Pro (tiene costo, pero permite Pages privado), o (b) agregar una
  contraseña simple del lado del cliente (no es seguridad real, solo un filtro básico),
  o (c) migrar esto a un hosting con autenticación de verdad más adelante. Para un uso
  de "demo para prospectar clientes" como el que veníamos armando, el esquema público
  actual suele ser aceptable — pero para datos reales de un cliente que ya firmó
  contigo, vale la pena que lo pienses.

---

## Mantenimiento futuro

- **Para agregar más productores o cultivos**: no hace falta tocar nada, el dashboard
  los detecta solo desde los datos.
- **Si cambian las columnas del Excel**: hay que ajustar `REQUIRED_COLUMNS` en
  `scripts/update_dashboard.py` para que coincida.
- **Si el workflow falla**: la pestaña Actions te muestra el error exacto (por ejemplo,
  "faltan columnas" o "no se pudo descargar"). El error más común es que el link de
  "Publicar en la web" haya vencido — Google a veces lo despublica si desactivás esa
  opción sin querer; solo hay que volver a publicarlo y actualizar la variable
  `SOURCE_CSV_URL`.
