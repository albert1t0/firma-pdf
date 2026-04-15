import os
import uuid
import zipfile
from pathlib import Path

import fitz
from flask import Flask, jsonify, render_template, request, send_file, send_from_directory
from PIL import Image

app = Flask(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
app.config['UPLOAD_FOLDER'] = os.path.join(BASE_DIR, 'uploads')
app.config['OUTPUT_FOLDER'] = os.path.join(BASE_DIR, 'output')

os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['OUTPUT_FOLDER'], exist_ok=True)

CM_TO_PT = 28.35


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/upload-imagen', methods=['POST'])
def upload_imagen():
    if 'imagen' not in request.files:
        return jsonify({'error': 'No se envio archivo'}), 400
    file = request.files['imagen']
    if file.filename == '':
        return jsonify({'error': 'No se selecciono archivo'}), 400

    ext = Path(file.filename).suffix or '.png'
    filename = f"firma_{uuid.uuid4().hex[:8]}{ext}"
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    file.save(filepath)

    img = Image.open(filepath)
    width, height = img.size
    img.close()

    return jsonify({
        'filename': filename,
        'path': filepath,
        'url': f'/uploads/{filename}',
        'width': width,
        'height': height,
    })


@app.route('/api/upload-pdf', methods=['POST'])
def upload_pdf():
    if 'pdf' not in request.files:
        return jsonify({'error': 'No se envio archivo'}), 400
    file = request.files['pdf']
    if file.filename == '':
        return jsonify({'error': 'No se selecciono archivo'}), 400

    filename = f"doc_{uuid.uuid4().hex[:8]}.pdf"
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    file.save(filepath)

    try:
        doc = fitz.open(filepath)
        pages = len(doc)
        page = doc[0]
        page_width_cm = round(page.rect.width / CM_TO_PT, 2)
        page_height_cm = round(page.rect.height / CM_TO_PT, 2)
        doc.close()
    except Exception as e:
        os.remove(filepath)
        return jsonify({'error': f'Error al abrir PDF: {e}'}), 400

    return jsonify({
        'filename': filename,
        'path': filepath,
        'pages': pages,
        'original_name': file.filename,
        'page_width_cm': page_width_cm,
        'page_height_cm': page_height_cm,
    })


@app.route('/api/upload-zip', methods=['POST'])
def upload_zip():
    if 'zip' not in request.files:
        return jsonify({'error': 'No se envio archivo'}), 400
    file = request.files['zip']
    if file.filename == '':
        return jsonify({'error': 'No se selecciono archivo'}), 400

    session_id = uuid.uuid4().hex[:8]
    extract_dir = os.path.join(app.config['UPLOAD_FOLDER'], f'zip_{session_id}')
    os.makedirs(extract_dir, exist_ok=True)

    zip_path = os.path.join(app.config['UPLOAD_FOLDER'], f'upload_{session_id}.zip')
    file.save(zip_path)

    try:
        with zipfile.ZipFile(zip_path, 'r') as zf:
            zf.extractall(extract_dir)
    except Exception as e:
        os.remove(zip_path)
        return jsonify({'error': f'Error al descomprimir ZIP: {e}'}), 400
    finally:
        if os.path.exists(zip_path):
            os.remove(zip_path)

    pdfs = []
    for root, _dirs, files in os.walk(extract_dir):
        for f in sorted(files):
            if f.lower().endswith('.pdf'):
                pdfs.append(os.path.join(root, f))

    if not pdfs:
        import shutil
        shutil.rmtree(extract_dir, ignore_errors=True)
        return jsonify({'error': 'No se encontraron archivos PDF en el ZIP'}), 400

    first_pdf_info = None
    try:
        doc = fitz.open(pdfs[0])
        page = doc[0]
        first_pdf_info = {
            'path': pdfs[0],
            'name': os.path.basename(pdfs[0]),
            'pages': len(doc),
            'page_width_cm': round(page.rect.width / CM_TO_PT, 2),
            'page_height_cm': round(page.rect.height / CM_TO_PT, 2),
        }
        doc.close()
    except Exception:
        pass

    pdf_names = [os.path.basename(p) for p in pdfs]

    return jsonify({
        'extract_dir': extract_dir,
        'pdfs': pdf_names,
        'count': len(pdfs),
        'first_pdf': first_pdf_info,
        'original_name': file.filename,
    })


@app.route('/api/vista-previa', methods=['GET'])
def vista_previa():
    pdf_path = request.args.get('path')
    page_num = int(request.args.get('page', '-1'))

    if not pdf_path or not os.path.exists(pdf_path):
        return jsonify({'error': 'PDF no encontrado'}), 404

    try:
        doc = fitz.open(pdf_path)
    except Exception as e:
        return jsonify({'error': f'Error al abrir PDF: {e}'}), 400

    if page_num == -1:
        page_num = len(doc) - 1

    if page_num < 0 or page_num >= len(doc):
        doc.close()
        return jsonify({'error': 'Pagina fuera de rango'}), 400

    page = doc[page_num]

    zoom = 150 / 72
    mat = fitz.Matrix(zoom, zoom)
    pix = page.get_pixmap(matrix=mat)

    preview_filename = f"preview_{uuid.uuid4().hex[:8]}.png"
    preview_path = os.path.join(app.config['UPLOAD_FOLDER'], preview_filename)
    pix.save(preview_path)

    page_width_cm = round(page.rect.width / CM_TO_PT, 2)
    page_height_cm = round(page.rect.height / CM_TO_PT, 2)

    doc.close()

    return jsonify({
        'preview_url': f'/uploads/{preview_filename}',
        'width': pix.width,
        'height': pix.height,
        'page_width_cm': page_width_cm,
        'page_height_cm': page_height_cm,
    })


@app.route('/api/procesar', methods=['POST'])
def procesar():
    data = request.get_json()

    imagen_path = data.get('imagen_path')
    texto = data.get('texto')
    texto_tamano = float(data.get('texto_tamano', 10))
    texto_gap = float(data.get('texto_gap', 0.2))

    firma_x = float(data.get('firma_x', 0))
    firma_y = float(data.get('firma_y', 0))
    firma_ancho = float(data.get('firma_ancho', 5.0))
    firma_alto = float(data.get('firma_alto', 2.0))

    pagina = int(data.get('pagina', -1))

    mode = data.get('mode')
    pdf_path = data.get('pdf_path')
    extract_dir = data.get('extract_dir')

    output_dir = app.config['OUTPUT_FOLDER']

    if not imagen_path or not os.path.exists(imagen_path):
        return jsonify({'error': 'Imagen de firma no encontrada'}), 400

    if mode == 'file':
        if not pdf_path or not os.path.exists(pdf_path):
            return jsonify({'error': 'PDF no encontrado'}), 404
        pdfs = [Path(pdf_path)]
    elif mode == 'zip':
        if not extract_dir or not os.path.isdir(extract_dir):
            return jsonify({'error': 'Directorio de extraccion no encontrado'}), 404
        pdfs = sorted([
            Path(root) / f
            for root, _dirs, files in os.walk(extract_dir)
            for f in sorted(files)
            if f.lower().endswith('.pdf')
        ])
        if not pdfs:
            return jsonify({'error': 'No se encontraron PDFs en el ZIP'}), 404
    else:
        return jsonify({'error': 'Modo no valido'}), 400

    texto_x = float(data.get('texto_x', firma_x)) if texto else firma_x
    texto_y = float(data.get('texto_y', 0)) if texto else None

    exitosos = []
    errores = []

    for pdf in pdfs:
        try:
            doc = fitz.open(str(pdf))
            total_pages = len(doc)

            page_idx = pagina
            if page_idx == -1:
                page_idx = total_pages - 1

            if page_idx < 0 or page_idx >= total_pages:
                errores.append({'file': pdf.name, 'error': f'Pagina {page_idx} fuera de rango'})
                doc.close()
                continue

            page = doc[page_idx]

            img_x = firma_x * CM_TO_PT
            img_y = firma_y * CM_TO_PT
            img_w = firma_ancho * CM_TO_PT
            img_h = firma_alto * CM_TO_PT

            fitz_y = page.rect.height - img_y - img_h

            img_rect = fitz.Rect(img_x, fitz_y, img_x + img_w, fitz_y + img_h)
            page.insert_image(img_rect, filename=imagen_path)

            if texto:
                txt_x_pt = texto_x * CM_TO_PT
                txt_y_cm = texto_y if texto_y is not None else firma_y - texto_gap
                txt_y_pt = txt_y_cm * CM_TO_PT
                fitz_txt_y = page.rect.height - txt_y_pt

                page.insert_text(
                    fitz.Point(txt_x_pt, fitz_txt_y),
                    texto,
                    fontsize=texto_tamano,
                    fontname="helv",
                )

            output_path = Path(output_dir) / f"firmado_{pdf.name}"
            doc.save(str(output_path))
            doc.close()

            exitosos.append({
                'original': pdf.name,
                'output': output_path.name,
            })
        except Exception as e:
            errores.append({'file': pdf.name, 'error': str(e)})

    return jsonify({
        'exitosos': exitosos,
        'errores': errores,
        'total': len(pdfs),
    })


@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)


@app.route('/api/descargar/<filename>')
def descargar(filename):
    filepath = os.path.join(app.config['OUTPUT_FOLDER'], filename)
    if not os.path.exists(filepath):
        return jsonify({'error': 'Archivo no encontrado'}), 404
    return send_file(filepath, as_attachment=True)


@app.route('/api/descargar-zip')
def descargar_zip():
    output_dir = app.config['OUTPUT_FOLDER']
    zip_path = os.path.join(output_dir, 'firmados.zip')

    pdf_files = [f for f in os.listdir(output_dir) if f.lower().endswith('.pdf')]
    if not pdf_files:
        return jsonify({'error': 'No hay archivos para descargar'}), 404

    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
        for f in pdf_files:
            zf.write(os.path.join(output_dir, f), f)

    return send_file(zip_path, as_attachment=True, download_name='firmados.zip')


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
