#!/usr/bin/env python3
import argparse
import os
import sys
from pathlib import Path

import fitz

CM_TO_PT = 28.35


def cm_to_pt(cm):
    return cm * CM_TO_PT


def procesar_pdf(ruta_pdf, imagen_path, pagina_idx, pos_x_cm, pos_y_cm,
                 ancho_cm, alto_cm, texto, texto_x_cm, texto_y_cm,
                 texto_gap_cm, texto_tamano, prefijo, output_dir):
    doc = fitz.open(ruta_pdf)

    total_paginas = len(doc)
    if pagina_idx == -1:
        pagina_idx = total_paginas - 1
    elif pagina_idx < 0 or pagina_idx >= total_paginas:
        print(f"  [ERROR] Página {pagina_idx} fuera de rango (1-{total_paginas}) en {ruta_pdf.name}")
        doc.close()
        return False

    page = doc[pagina_idx]
    rect = page.rect
    ancho_pag_pt = rect.width
    alto_pag_pt = rect.height

    img_x = cm_to_pt(pos_x_cm)
    img_y = cm_to_pt(pos_y_cm)
    img_w = cm_to_pt(ancho_cm)
    img_h = cm_to_pt(alto_cm)

    fitz_y = alto_pag_pt - img_y - img_h

    if img_x < 0 or fitz_y < 0 or (img_x + img_w) > ancho_pag_pt or (fitz_y + img_h) > alto_pag_pt:
        print(f"  [ADVERTENCIA] Coordenadas fuera de márgenes en {ruta_pdf.name}")
        print(f"    Imagen: ({pos_x_cm:.1f}, {pos_y_cm:.1f}) cm, tamaño {ancho_cm:.1f}x{alto_cm:.1f} cm")
        print(f"    Página: {ancho_pag_pt / CM_TO_PT:.1f}x{alto_pag_pt / CM_TO_PT:.1f} cm")

    img_rect = fitz.Rect(img_x, fitz_y, img_x + img_w, fitz_y + img_h)
    page.insert_image(img_rect, filename=imagen_path)

    if texto:
        txt_x = cm_to_pt(texto_x_cm)
        gap_pt = cm_to_pt(texto_gap_cm)
        txt_y_cm = texto_y_cm if texto_y_cm is not None else pos_y_cm - texto_gap_cm
        txt_y_pt = cm_to_pt(txt_y_cm)
        fitz_txt_y = alto_pag_pt - txt_y_pt

        page.insert_text(
            fitz.Point(txt_x, fitz_txt_y),
            texto,
            fontsize=texto_tamano,
            fontname="helv",
        )

    if output_dir:
        salida = Path(output_dir)
    else:
        salida = ruta_pdf.parent
    salida.mkdir(parents=True, exist_ok=True)

    nombre_salida = f"{prefijo}{ruta_pdf.name}"
    ruta_salida = salida / nombre_salida

    doc.save(str(ruta_salida))
    doc.close()
    print(f"  [OK] {ruta_salida}")
    return True


def main():
    parser = argparse.ArgumentParser(
        description="Firma documentos PDF con imagen y texto opcional"
    )
    parser.add_argument(
        "input",
        help="Ruta a un archivo PDF o directorio con PDFs",
    )
    parser.add_argument(
        "-i", "--imagen",
        default="firma_ejemplo.png",
        help="Ruta de la imagen de firma (default: firma_ejemplo.png)",
    )
    parser.add_argument(
        "-p", "--pagina",
        type=int,
        default=-1,
        help="Número de página (0-indexado, -1 = última, default: -1)",
    )
    parser.add_argument(
        "-x", "--pos-x",
        type=float,
        required=True,
        help="Posición horizontal en cm desde el borde izquierdo",
    )
    parser.add_argument(
        "-y", "--pos-y",
        type=float,
        required=True,
        help="Posición vertical en cm desde el borde inferior",
    )
    parser.add_argument(
        "--ancho",
        type=float,
        default=5.0,
        help="Ancho de la imagen en cm (default: 5.0)",
    )
    parser.add_argument(
        "--alto",
        type=float,
        default=2.0,
        help="Alto de la imagen en cm (default: 2.0)",
    )
    parser.add_argument(
        "-t", "--texto",
        default=None,
        help="Texto opcional bajo la firma",
    )
    parser.add_argument(
        "--texto-x",
        type=float,
        default=None,
        help="Posición X del texto en cm (default: misma que imagen)",
    )
    parser.add_argument(
        "--texto-y",
        type=float,
        default=None,
        help="Posición Y del texto en cm (default: pos_y - alto - gap)",
    )
    parser.add_argument(
        "--texto-gap",
        type=float,
        default=0.2,
        help="Separación entre imagen y texto en cm (default: 0.2)",
    )
    parser.add_argument(
        "--texto-tamano",
        type=float,
        default=10,
        help="Tamaño de fuente del texto en pt (default: 10)",
    )
    parser.add_argument(
        "--prefijo",
        default="firmado_",
        help="Prefijo para archivos de salida (default: firmado_)",
    )
    parser.add_argument(
        "--output-dir",
        default=None,
        help="Directorio de salida (default: mismo directorio que el original)",
    )

    args = parser.parse_args()

    ruta_input = Path(args.input)
    imagen_path = Path(args.imagen)

    if not imagen_path.exists():
        print(f"[ERROR] Imagen no encontrada: {imagen_path}")
        sys.exit(1)

    texto_x = args.texto_x if args.texto_x is not None else args.pos_x
    texto_y = args.texto_y

    if ruta_input.is_dir():
        pdfs = sorted(ruta_input.glob("*.pdf"))
        if not pdfs:
            print(f"[ERROR] No se encontraron PDFs en {ruta_input}")
            sys.exit(1)
    elif ruta_input.is_file():
        pdfs = [ruta_input]
    else:
        print(f"[ERROR] Ruta no encontrada: {ruta_input}")
        sys.exit(1)

    print(f"Procesando {len(pdfs)} archivo(s)...")
    print(f"  Imagen: {imagen_path}")
    print(f"  Posición: ({args.pos_x}, {args.pos_y}) cm")
    print(f"  Tamaño imagen: {args.ancho}x{args.alto} cm")
    print(f"  Página: {'última' if args.pagina == -1 else args.pagina}")
    if args.texto:
        print(f"  Texto: \"{args.texto}\"")
    print()

    exitosos = 0
    errores = 0
    for pdf in pdfs:
        try:
            if procesar_pdf(
                pdf, str(imagen_path), args.pagina,
                args.pos_x, args.pos_y,
                args.ancho, args.alto,
                args.texto, texto_x, texto_y,
                args.texto_gap, args.texto_tamano,
                args.prefijo, args.output_dir,
            ):
                exitosos += 1
            else:
                errores += 1
        except Exception as e:
            print(f"  [ERROR] {pdf.name}: {e}")
            errores += 1

    print()
    print(f"Resultado: {exitosos} firmado(s), {errores} error(es) de {len(pdfs)} total")


if __name__ == "__main__":
    main()
