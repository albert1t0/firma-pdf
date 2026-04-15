# Firma PDF

Aplicación para insertar una imagen de firma y texto opcional en documentos PDF. Dispone de interfaz web (Flask) y línea de comandos. Soporta procesamiento individual y por lotes.

## Requisitos

- Python 3.10+
- PyMuPDF, Flask, Pillow

```bash
pip install -r requirements.txt
```

## Inicio rápido

```bash
# Interfaz web (recomendado)
python web_app.py

# Línea de comandos
python firma_pdf.py "documento.pdf" -x 12 -y 2.5
```

---

## Interfaz Web

Aplicación web con wizard interactivo para firmar PDFs de forma visual, arrastrando la firma y el texto directamente sobre una vista previa de la página.

### Ejecución local

```bash
python web_app.py
```

Abrir [http://localhost:5000](http://localhost:5000) en el navegador.

### Ejecución con Docker

```bash
docker compose up --build
```

- Interfaz web: [http://localhost:5000](http://localhost:5000)
- Los PDFs del directorio `documentos/` están disponibles en `/app/documentos` dentro del contenedor.
- Los archivos firmados se guardan en `output/`.
- Para firmar por lotes desde la interfaz web, subir un archivo ZIP con los PDFs.

### Flujo de uso

| Paso | Descripción |
|---|---|
| **1. Firma** | Subir la imagen de firma (PNG/JPG). Obligatorio. |
| **2. Texto** | Ingresar texto opcional bajo la firma. Se puede omitir. |
| **3. Documento** | Subir un PDF individual o un archivo ZIP con PDFs. Seleccionar la página destino. |
| **4. Posición** | Vista previa de la página con cajas arrastrables para firma (verde) y texto (azul). Se pueden redimensionar. Las coordenadas se muestran en cm en tiempo real. |
| **5. Resultado** | Procesamiento con resumen y enlaces de descarga individual o ZIP. |

### Modos de selección de documentos

- **Archivo PDF**: Se sube un archivo. Se muestra selector de página.
- **Archivo ZIP**: Se sube un ZIP con PDFs. Se descomprime automáticamente, se listan los PDFs encontrados y se usa el primero como vista previa. Todos los PDFs se firman con la misma posición. El resultado se ofrece como descarga en ZIP.

### Estructura del proyecto

```
firma-pdf/
├── firma_pdf.py          # CLI (línea de comandos)
├── web_app.py            # Flask backend
├── templates/
│   └── index.html        # Wizard UI
├── static/
│   ├── css/style.css     # Estilos
│   └── js/app.js         # Lógica frontend (drag & drop)
├── uploads/              # Archivos temporales (gitignored)
├── output/               # PDFs firmados (gitignored)
├── Dockerfile
├── docker-compose.yml
└── requirements.txt
```

---

## Línea de Comandos (CLI)

Uso alternativo directamente desde terminal.

```bash
# Firmar un solo PDF
python firma_pdf.py "documento.pdf" -x 12 -y 2.5

# Firmar un PDF con texto bajo la firma
python firma_pdf.py "documento.pdf" -x 12 -y 2.5 -t "Nombre Apellido"

# Firmar todos los PDFs de un directorio
python firma_pdf.py documentos/ -x 12 -y 2.5 --output-dir firmados/
```

### Parámetros

| Parámetro | Descripción | Default |
|---|---|---|
| `input` | Ruta a un archivo PDF o directorio con PDFs | (requerido) |
| `-i, --imagen` | Ruta de la imagen de firma | `firma_ejemplo.png` |
| `-p, --pagina` | Número de página (0-indexado, `-1` = última) | `-1` |
| `-x, --pos-x` | Posición horizontal en cm desde borde izquierdo | (requerido) |
| `-y, --pos-y` | Posición vertical en cm desde borde inferior | (requerido) |
| `--ancho` | Ancho de la imagen en cm | `5.0` |
| `--alto` | Alto de la imagen en cm | `2.0` |
| `-t, --texto` | Texto bajo la firma | (sin texto) |
| `--texto-x` | Posición X del texto en cm | misma que imagen |
| `--texto-y` | Posición Y del texto en cm | `pos_y - alto - gap` |
| `--texto-gap` | Separación imagen-texto en cm | `0.2` |
| `--texto-tamano` | Tamaño de fuente del texto en pt | `10` |
| `--prefijo` | Prefijo para archivos de salida | `firmado_` |
| `--output-dir` | Directorio de salida | mismo que original |

### Sistema de coordenadas

El origen `(0, 0)` está en la **esquina inferior izquierda** de la página. Ambos ejes crecen positivamente: X hacia la derecha, Y hacia arriba.

Ejemplo para una página A4 (21.0 x 29.7 cm):

```
(0, 29.7)                        (21.0, 29.7)
    ┌─────────────────────────────┐
    │                             │
    │                             │
    │               ┌────────┐    │  ← y=5.0, alto=2.0
    │               │ firma  │    │
    │               └────────┘    │  ← y=3.0
    │                 texto       │  ← y≈2.8
    │                             │
    └─────────────────────────────┘
(0, 0)                            (21.0, 0)
```

- `-x 12 -y 3.0` coloca la esquina inferior izquierda de la firma a 12 cm del borde izquierdo y 3 cm del borde inferior.
- Si se indica `-t "texto"`, el texto aparece debajo de la imagen por defecto.

### Ejemplos

#### Firma simple con valores por defecto

```bash
python firma_pdf.py "documento.pdf" -x 12 -y 2.5
```

Inserta `firma_ejemplo.png` (5 x 2 cm) en la última página del PDF, a 12 cm del borde izquierdo y 2.5 cm del borde inferior.

#### Firma con texto personalizado

```bash
python firma_pdf.py "documento.pdf" -x 12 -y 3.0 \
  -t "Firmado digitalmente" \
  --texto-tamano 12 \
  --texto-gap 0.3
```

#### Firma con imagen y tamaño personalizado

```bash
python firma_pdf.py "documento.pdf" \
  -i mi_firma.png \
  -x 10 -y 4.0 \
  --ancho 6 --alto 2.5
```

#### Procesamiento por lotes

```bash
python firma_pdf.py documentos/ \
  -x 12 -y 2.5 \
  -t "Firmado digitalmente" \
  --output-dir firmados/
```

Firma todos los PDFs del directorio `documentos/` y guarda las copias con prefijo `firmado_` en el directorio `firmados/`.

#### Firma en una página específica

```bash
python firma_pdf.py "documento.pdf" -p 0 -x 12 -y 2.5
```

Firma la primera página (índice 0).

---

## Comportamiento general

- Los archivos originales **nunca se modifican**. Siempre se genera una copia con el prefijo configurado.
- Si se proporciona un directorio como entrada, se procesan todos los archivos `.pdf` que contenga.
- Si las coordenadas caen fuera de los márgenes de la página, se muestra una **advertencia** pero el archivo se genera igualmente.
- Al finalizar se muestra un resumen con la cantidad de archivos firmados y errores.
