const state = {
    step: 1,
    imagenPath: null,
    imagenUrl: null,
    imagenWidth: 0,
    imagenHeight: 0,
    texto: '',
    textoTamano: 10,
    textoGap: 0.2,
    mode: 'file',
    pdfPath: null,
    extractDir: null,
    pdfList: [],
    totalPages: 0,
    selectedPage: -1,
    pageWidthCm: 0,
    pageHeightCm: 0,
    firmaX: 12,
    firmaY: 3,
    firmaAncho: 5,
    firmaAlto: 2,
    textoX: 12,
    textoY: 2.6,
    textoManuallyMoved: false,
};

function init() {
    setupStepperClicks();
    setupImageUpload();
    setupPdfUpload();
    setupZipUpload();
    setupModeTabs();
    setupPageSelector();
    setupDimensionInputs();
    setupNavButtons();
}

function setupStepperClicks() {
    document.querySelectorAll('.step-item').forEach(item => {
        item.style.cursor = 'pointer';
        item.addEventListener('click', () => {
            const targetStep = parseInt(item.dataset.step);
            if (targetStep < state.step) {
                goToStep(targetStep);
            }
        });
    });
}

function updateStepper() {
    document.querySelectorAll('.step-item').forEach(item => {
        const s = parseInt(item.dataset.step);
        item.classList.remove('active', 'completed');
        if (s === state.step) item.classList.add('active');
        if (s < state.step) item.classList.add('completed');
    });
}

function goToStep(n) {
    state.step = n;
    document.querySelectorAll('.step-content').forEach(el => {
        el.classList.remove('active');
    });
    const target = document.getElementById('step-' + n);
    if (target) target.classList.add('active');
    updateStepper();
    updateNavButtons();

    if (n === 4) {
        loadPreview();
    }
}

function updateNavButtons() {
    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');
    const btnProcess = document.getElementById('btn-process');
    const btnSkip = document.getElementById('btn-skip');

    btnPrev.disabled = state.step <= 1;
    btnPrev.style.display = state.step > 1 ? '' : 'none';

    btnSkip.style.display = state.step === 2 ? '' : 'none';

    if (state.step === 4) {
        btnNext.style.display = 'none';
        btnProcess.style.display = '';
    } else if (state.step === 5) {
        btnNext.style.display = 'none';
        btnProcess.style.display = 'none';
    } else {
        btnNext.style.display = '';
        btnProcess.style.display = 'none';
    }
}

function setupNavButtons() {
    document.getElementById('btn-prev').addEventListener('click', () => {
        if (state.step > 1) goToStep(state.step - 1);
    });

    document.getElementById('btn-next').addEventListener('click', () => {
        if (validateStep(state.step)) {
            if (state.step === 2 && !state.texto) {
                state.texto = '';
            }
            if (state.step === 3) {
                if (state.mode === 'file' && !state.pdfPath) {
                    showToast('Selecciona un archivo PDF', 'warning');
                    return;
                }
                if (state.mode === 'zip' && !state.extractDir) {
                    showToast('Selecciona un archivo ZIP', 'warning');
                    return;
                }
            }
            goToStep(state.step + 1);
        }
    });

    document.getElementById('btn-skip').addEventListener('click', () => {
        state.texto = '';
        goToStep(3);
    });

    document.getElementById('btn-process').addEventListener('click', processFiles);
}

function validateStep(step) {
    if (step === 1) {
        if (!state.imagenPath) {
            showToast('Selecciona una imagen de firma', 'warning');
            return false;
        }
        return true;
    }
    if (step === 2) {
        return true;
    }
    if (step === 3) {
        return true;
    }
    return true;
}

function setupImageUpload() {
    const drop = document.getElementById('imagen-drop');
    const input = document.getElementById('imagen-input');
    const previewCard = document.getElementById('imagen-preview-card');
    const previewImg = document.getElementById('imagen-preview');
    const btnRemove = document.getElementById('btn-remove-imagen');

    setupDropZone(drop, input);

    input.addEventListener('change', () => {
        if (input.files.length) handleImageUpload(input.files[0]);
    });

    btnRemove.addEventListener('click', () => {
        state.imagenPath = null;
        state.imagenUrl = null;
        drop.style.display = '';
        previewCard.style.display = 'none';
        input.value = '';
    });
}

function handleImageUpload(file) {
    const formData = new FormData();
    formData.append('imagen', file);

    fetch('/api/upload-imagen', { method: 'POST', body: formData })
        .then(r => r.json())
        .then(data => {
            if (data.error) {
                showToast(data.error, 'error');
                return;
            }
            state.imagenPath = data.path;
            state.imagenUrl = data.url;
            state.imagenWidth = data.width;
            state.imagenHeight = data.height;

            const ratio = data.width / data.height;
            state.firmaAlto = parseFloat((state.firmaAncho / ratio).toFixed(2));
            document.getElementById('firma-alto').value = state.firmaAlto;

            const previewImg = document.getElementById('imagen-preview');
            previewImg.src = data.url;
            document.getElementById('imagen-drop').style.display = 'none';
            document.getElementById('imagen-preview-card').style.display = 'flex';
            showToast('Imagen cargada correctamente', 'success');
        })
        .catch(() => showToast('Error al subir imagen', 'error'));
}

function setupPdfUpload() {
    const drop = document.getElementById('pdf-drop');
    const input = document.getElementById('pdf-input');
    const btnRemove = document.getElementById('btn-remove-pdf');

    setupDropZone(drop, input);

    input.addEventListener('change', () => {
        if (input.files.length) handlePdfUpload(input.files[0]);
    });

    btnRemove.addEventListener('click', () => {
        state.pdfPath = null;
        state.totalPages = 0;
        document.getElementById('pdf-file-info').style.display = 'none';
        document.getElementById('page-selector').style.display = 'none';
        document.getElementById('pdf-drop').style.display = '';
        input.value = '';
    });
}

function handlePdfUpload(file) {
    const formData = new FormData();
    formData.append('pdf', file);

    fetch('/api/upload-pdf', { method: 'POST', body: formData })
        .then(r => r.json())
        .then(data => {
            if (data.error) {
                showToast(data.error, 'error');
                return;
            }
            state.pdfPath = data.path;
            state.totalPages = data.pages;
            state.pageWidthCm = data.page_width_cm;
            state.pageHeightCm = data.page_height_cm;

            document.getElementById('pdf-file-name').textContent = data.original_name + ' (' + data.pages + ' p\u00e1ginas)';
            document.getElementById('pdf-drop').style.display = 'none';
            document.getElementById('pdf-file-info').style.display = 'flex';

            showPageSelector(data.pages);
            showToast('PDF cargado: ' + data.pages + ' p\u00e1ginas', 'success');
        })
        .catch(() => showToast('Error al subir PDF', 'error'));
}

function setupZipUpload() {
    const drop = document.getElementById('zip-drop');
    const input = document.getElementById('zip-input');
    const btnRemove = document.getElementById('btn-remove-zip');

    setupDropZone(drop, input);

    input.addEventListener('change', () => {
        if (input.files.length) handleZipUpload(input.files[0]);
    });

    btnRemove.addEventListener('click', () => {
        state.extractDir = null;
        state.pdfList = [];
        state.pdfPath = null;
        state.totalPages = 0;
        document.getElementById('zip-file-info').style.display = 'none';
        document.getElementById('zip-results').style.display = 'none';
        document.getElementById('zip-drop').style.display = '';
        document.getElementById('page-selector').style.display = 'none';
        input.value = '';
    });
}

function handleZipUpload(file) {
    const formData = new FormData();
    formData.append('zip', file);

    fetch('/api/upload-zip', { method: 'POST', body: formData })
        .then(r => r.json())
        .then(data => {
            if (data.error) {
                showToast(data.error, 'error');
                return;
            }

            state.extractDir = data.extract_dir;
            state.pdfList = data.pdfs;

            document.getElementById('zip-file-name').textContent = data.original_name;
            document.getElementById('zip-drop').style.display = 'none';
            document.getElementById('zip-file-info').style.display = 'flex';

            const zipResults = document.getElementById('zip-results');
            document.getElementById('zip-count').textContent = data.count + ' archivo(s) PDF encontrado(s):';
            const list = document.getElementById('zip-pdf-list');
            list.innerHTML = '';
            data.pdfs.forEach(f => {
                const li = document.createElement('li');
                li.textContent = f;
                list.appendChild(li);
            });
            zipResults.style.display = '';

            if (data.first_pdf) {
                state.pdfPath = data.first_pdf.path;
                state.totalPages = data.first_pdf.pages;
                state.pageWidthCm = data.first_pdf.page_width_cm;
                state.pageHeightCm = data.first_pdf.page_height_cm;
                showPageSelector(data.first_pdf.pages);
            }

            showToast(data.count + ' PDFs encontrados en el ZIP', 'success');
        })
        .catch(() => showToast('Error al subir ZIP', 'error'));
}

function setupModeTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const mode = btn.dataset.mode;
            state.mode = mode;

            document.querySelectorAll('.mode-panel').forEach(p => p.classList.remove('active'));
            document.getElementById('panel-' + mode).classList.add('active');
        });
    });
}

function showPageSelector(totalPages) {
    const selector = document.getElementById('page-selector');
    const select = document.getElementById('page-select');

    select.innerHTML = '';

    const lastOpt = document.createElement('option');
    lastOpt.value = '-1';
    lastOpt.textContent = '\u00daltima p\u00e1gina';
    select.appendChild(lastOpt);

    for (let i = 0; i < totalPages; i++) {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = 'P\u00e1gina ' + (i + 1);
        select.appendChild(opt);
    }

    select.value = '-1';
    state.selectedPage = -1;
    selector.style.display = '';
}

function setupPageSelector() {
    document.getElementById('page-select').addEventListener('change', function () {
        state.selectedPage = parseInt(this.value);
    });
}

function setupDimensionInputs() {
    document.getElementById('firma-ancho').addEventListener('change', function () {
        const val = parseFloat(this.value);
        if (val > 0) {
            state.firmaAncho = val;
            if (state.imagenWidth && state.imagenHeight) {
                const ratio = state.imagenWidth / state.imagenHeight;
                state.firmaAlto = parseFloat((val / ratio).toFixed(2));
                document.getElementById('firma-alto').value = state.firmaAlto;
            }
            positionBoxes();
        }
    });

    document.getElementById('firma-alto').addEventListener('change', function () {
        const val = parseFloat(this.value);
        if (val > 0) {
            state.firmaAlto = val;
            positionBoxes();
        }
    });

    document.getElementById('texto-tamano').addEventListener('change', function () {
        state.textoTamano = parseFloat(this.value);
    });

    document.getElementById('texto-gap').addEventListener('change', function () {
        state.textoGap = parseFloat(this.value);
    });

    document.getElementById('texto-input').addEventListener('input', function () {
        state.texto = this.value.trim();
    });
}

function loadPreview() {
    if (!state.pdfPath) {
        showToast('No hay PDF seleccionado', 'warning');
        return;
    }

    const page = state.selectedPage;
    const url = '/api/vista-previa?path=' + encodeURIComponent(state.pdfPath) + '&page=' + page;

    fetch(url)
        .then(r => r.json())
        .then(data => {
            if (data.error) {
                showToast(data.error, 'error');
                return;
            }

            state.pageWidthCm = data.page_width_cm;
            state.pageHeightCm = data.page_height_cm;

            const img = document.getElementById('page-preview');
            img.onload = () => {
                positionBoxes();
                initDraggable();
                updatePositionDisplay();
            };
            img.src = data.preview_url;

            const firmaThumb = document.getElementById('firma-thumb');
            if (state.imagenUrl) {
                firmaThumb.src = state.imagenUrl;
            }

            const textoBox = document.getElementById('texto-box');
            const textoLabel = document.getElementById('texto-preview-label');
            const textoInfo = document.getElementById('pos-texto-info');
            state.texto = document.getElementById('texto-input').value.trim();
            state.textoTamano = parseFloat(document.getElementById('texto-tamano').value);
            state.textoGap = parseFloat(document.getElementById('texto-gap').value);

            if (state.texto) {
                textoLabel.textContent = state.texto;
                textoBox.style.display = 'flex';
                textoInfo.style.display = '';
                if (!state.textoManuallyMoved) {
                    state.textoX = state.firmaX;
                    state.textoY = state.firmaY - state.textoGap;
                }
            } else {
                textoBox.style.display = 'none';
                textoInfo.style.display = 'none';
            }

            document.getElementById('pos-page-size').textContent =
                data.page_width_cm + ' x ' + data.page_height_cm + ' cm';
        })
        .catch(() => showToast('Error al cargar vista previa', 'error'));
}

function getScale() {
    const img = document.getElementById('page-preview');
    if (!img.clientWidth || !state.pageWidthCm) return { x: 1, y: 1 };
    return {
        x: img.clientWidth / state.pageWidthCm,
        y: img.clientHeight / state.pageHeightCm,
    };
}

function positionBoxes() {
    const scale = getScale();
    const img = document.getElementById('page-preview');
    if (!img.clientWidth) return;

    const firmaBox = document.getElementById('firma-box');
    const left = state.firmaX * scale.x;
    const top = (state.pageHeightCm - state.firmaY - state.firmaAlto) * scale.y;
    const width = state.firmaAncho * scale.x;
    const height = state.firmaAlto * scale.y;

    firmaBox.style.left = left + 'px';
    firmaBox.style.top = top + 'px';
    firmaBox.style.width = width + 'px';
    firmaBox.style.height = height + 'px';

    if (state.texto) {
        const textoBox = document.getElementById('texto-box');
        const textVisualHeightCm = state.textoTamano * 0.0353;
        const tLeft = state.textoX * scale.x;
        const tTop = (state.pageHeightCm - state.textoY - textVisualHeightCm) * scale.y;

        textoBox.style.left = tLeft + 'px';
        textoBox.style.top = tTop + 'px';
    }

    updatePositionDisplay();
}

function updatePositionDisplay() {
    document.getElementById('pos-firma-x').textContent = state.firmaX.toFixed(1);
    document.getElementById('pos-firma-y').textContent = state.firmaY.toFixed(1);

    if (state.texto) {
        document.getElementById('pos-texto-x').textContent = state.textoX.toFixed(1);
        document.getElementById('pos-texto-y').textContent = state.textoY.toFixed(1);
    }
}

function initDraggable() {
    const wrapper = document.getElementById('preview-wrapper');
    const firmaBox = document.getElementById('firma-box');
    const textoBox = document.getElementById('texto-box');
    const resizeHandle = document.getElementById('firma-resize');

    makeDraggable(firmaBox, wrapper, (left, top) => {
        const scale = getScale();
        state.firmaX = parseFloat((left / scale.x).toFixed(2));
        state.firmaY = parseFloat((state.pageHeightCm - (top + firmaBox.clientHeight) / scale.y).toFixed(2));
        if (state.texto && !state.textoManuallyMoved) {
            state.textoX = state.firmaX;
            state.textoY = state.firmaY - state.textoGap;
            const textVisualHeightCm = state.textoTamano * 0.0353;
            const tLeft = state.textoX * scale.x;
            const tTop = (state.pageHeightCm - state.textoY - textVisualHeightCm) * scale.y;
            textoBox.style.left = tLeft + 'px';
            textoBox.style.top = tTop + 'px';
        }
        updatePositionDisplay();
    });

    if (state.texto) {
        makeDraggable(textoBox, wrapper, (left, top) => {
            const scale = getScale();
            state.textoX = parseFloat((left / scale.x).toFixed(2));
            const textVisualHeightCm = state.textoTamano * 0.0353;
            state.textoY = parseFloat((state.pageHeightCm - (top / scale.y) - textVisualHeightCm).toFixed(2));
            state.textoManuallyMoved = true;
            updatePositionDisplay();
        });
    }

    makeResizable(firmaBox, resizeHandle, wrapper, (width, height) => {
        const scale = getScale();
        state.firmaAncho = parseFloat((width / scale.x).toFixed(2));
        state.firmaAlto = parseFloat((height / scale.y).toFixed(2));
        document.getElementById('firma-ancho').value = state.firmaAncho;
        document.getElementById('firma-alto').value = state.firmaAlto;
        state.firmaY = parseFloat((state.pageHeightCm - (parseFloat(firmaBox.style.top) + height) / scale.y).toFixed(2));
        updatePositionDisplay();
    });
}

function makeDraggable(element, container, onMove) {
    let dragging = false;
    let startX, startY, startLeft, startTop;

    element.addEventListener('pointerdown', (e) => {
        if (e.target.classList.contains('resize-handle')) return;
        dragging = true;
        element.classList.add('dragging');
        element.setPointerCapture(e.pointerId);
        startX = e.clientX;
        startY = e.clientY;
        startLeft = parseInt(element.style.left) || 0;
        startTop = parseInt(element.style.top) || 0;
        e.preventDefault();
    });

    element.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        const containerRect = container.getBoundingClientRect();
        const imgEl = container.querySelector('img#page-preview');
        const maxX = imgEl.clientWidth - element.clientWidth;
        const maxY = imgEl.clientHeight - element.clientHeight;

        let newLeft = Math.max(0, Math.min(startLeft + dx, maxX));
        let newTop = Math.max(0, Math.min(startTop + dy, maxY));

        element.style.left = newLeft + 'px';
        element.style.top = newTop + 'px';

        if (onMove) onMove(newLeft, newTop);
    });

    element.addEventListener('pointerup', (e) => {
        dragging = false;
        element.classList.remove('dragging');
    });

    element.addEventListener('pointercancel', () => {
        dragging = false;
        element.classList.remove('dragging');
    });
}

function makeResizable(element, handle, container, onResize) {
    let resizing = false;
    let startX, startY, startWidth, startHeight;

    handle.addEventListener('pointerdown', (e) => {
        resizing = true;
        handle.setPointerCapture(e.pointerId);
        startX = e.clientX;
        startY = e.clientY;
        startWidth = element.clientWidth;
        startHeight = element.clientHeight;
        e.preventDefault();
        e.stopPropagation();
    });

    handle.addEventListener('pointermove', (e) => {
        if (!resizing) return;
        const imgEl = container.querySelector('img#page-preview');
        const left = parseInt(element.style.left) || 0;
        const top = parseInt(element.style.top) || 0;

        let newWidth = Math.max(20, startWidth + (e.clientX - startX));
        let newHeight = Math.max(10, startHeight + (e.clientY - startY));

        newWidth = Math.min(newWidth, imgEl.clientWidth - left);
        newHeight = Math.min(newHeight, imgEl.clientHeight - top);

        element.style.width = newWidth + 'px';
        element.style.height = newHeight + 'px';

        if (onResize) onResize(newWidth, newHeight);
    });

    handle.addEventListener('pointerup', () => { resizing = false; });
    handle.addEventListener('pointercancel', () => { resizing = false; });
}

function processFiles() {
    goToStep(5);
    document.getElementById('results-loading').style.display = '';
    document.getElementById('results-summary').style.display = 'none';
    document.getElementById('results-list').style.display = 'none';
    document.getElementById('results-actions').style.display = 'none';

    state.texto = document.getElementById('texto-input').value.trim();
    state.textoTamano = parseFloat(document.getElementById('texto-tamano').value);
    state.textoGap = parseFloat(document.getElementById('texto-gap').value);

    const payload = {
        imagen_path: state.imagenPath,
        texto: state.texto || null,
        texto_tamano: state.textoTamano,
        texto_gap: state.textoGap,
        firma_x: state.firmaX,
        firma_y: state.firmaY,
        firma_ancho: state.firmaAncho,
        firma_alto: state.firmaAlto,
        texto_x: state.textoX,
        texto_y: state.textoY,
        pagina: state.selectedPage,
        mode: state.mode,
        pdf_path: state.pdfPath,
        extract_dir: state.extractDir,
    };

    fetch('/api/procesar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    })
        .then(r => r.json())
        .then(data => {
            document.getElementById('results-loading').style.display = 'none';
            showResults(data);
        })
        .catch((err) => {
            document.getElementById('results-loading').style.display = 'none';
            showToast('Error al procesar: ' + err.message, 'error');
        });
}

function showResults(data) {
    if (data.error) {
        showToast(data.error, 'error');
        return;
    }

    const summary = document.getElementById('results-summary');
    const total = data.total || 0;
    const ok = (data.exitosos || []).length;
    const err = (data.errores || []).length;

    summary.style.display = '';
    if (err === 0) {
        summary.style.background = 'var(--success-light)';
        summary.innerHTML = '&#10004; ' + ok + ' de ' + total + ' archivo(s) firmado(s) correctamente.';
    } else {
        summary.style.background = 'var(--warning-light)';
        summary.innerHTML = ok + ' firmado(s), ' + err + ' error(es) de ' + total + ' total.';
    }

    const list = document.getElementById('results-list');
    list.style.display = '';
    list.innerHTML = '';

    (data.exitosos || []).forEach(item => {
        const div = document.createElement('div');
        div.className = 'result-item success';
        div.innerHTML = '<span>&#10004; ' + escapeHtml(item.original) + '</span>' +
            '<a href="/api/descargar/' + encodeURIComponent(item.output) + '" class="btn btn-secondary" style="padding:4px 10px;font-size:0.8rem;">Descargar</a>';
        list.appendChild(div);
    });

    (data.errores || []).forEach(item => {
        const div = document.createElement('div');
        div.className = 'result-item error';
        div.innerHTML = '<span>&#10008; ' + escapeHtml(item.file) + ': ' + escapeHtml(item.error) + '</span>';
        list.appendChild(div);
    });

    if (ok > 0) {
        document.getElementById('results-actions').style.display = '';
    }

    showToast(ok + ' archivo(s) firmado(s)', 'success');
}

function setupDropZone(zone, input) {
    zone.addEventListener('click', () => input.click());

    zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        zone.classList.add('dragover');
    });

    zone.addEventListener('dragleave', () => {
        zone.classList.remove('dragover');
    });

    zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.classList.remove('dragover');
        if (e.dataTransfer.files.length) {
            const dt = new DataTransfer();
            dt.items.add(e.dataTransfer.files[0]);
            input.files = dt.files;
            input.dispatchEvent(new Event('change'));
        }
    });
}

function showToast(message, type) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast ' + (type || 'success');
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', init);
