"""
Descarga la planilla de entregas desde Google Drive y regenera data.json
para el dashboard de Acopio San José.

Variable de entorno requerida:
  SOURCE_CSV_URL  -> link "Publicar en la web" (CSV) del Google Sheet,
                      o link directo de descarga de un archivo .xlsx en Drive.

Columnas esperadas en la planilla de origen (no importa el orden,
sí importan los nombres, en minúsculas):
  fecha, productor, cultivo, contrato,
  cantidad_recibida_tn, cantidad_liquidada_tn, cantidad_facturada_tn,
  precio_liquidacion_usd_tn, monto_liquidado_usd, estado_contrato
"""

import io
import json
import os
import sys
from datetime import datetime, timezone

import pandas as pd
import requests

OUT_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data.json")

REQUIRED_COLUMNS = [
    "fecha", "productor", "cultivo", "contrato",
    "cantidad_recibida_tn", "cantidad_liquidada_tn", "cantidad_facturada_tn",
    "precio_liquidacion_usd_tn", "monto_liquidado_usd", "estado_contrato",
]


def fetch_bytes(url: str) -> bytes:
    resp = requests.get(url, timeout=60)
    resp.raise_for_status()
    return resp.content


def load_dataframe(content: bytes, url: str) -> pd.DataFrame:
    lower = url.lower()
    looks_like_csv = "output=csv" in lower or "format=csv" in lower or lower.endswith(".csv")
    if looks_like_csv:
        return pd.read_csv(io.BytesIO(content))
    return pd.read_excel(io.BytesIO(content))


def main() -> int:
    source_url = os.environ.get("SOURCE_CSV_URL", "").strip()
    if not source_url:
        print("ERROR: falta la variable de entorno SOURCE_CSV_URL", file=sys.stderr)
        return 1

    print(f"Descargando datos desde: {source_url[:80]}...")
    content = fetch_bytes(source_url)
    df = load_dataframe(content, source_url)

    df.columns = [str(c).strip().lower() for c in df.columns]
    missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing:
        print(f"ERROR: faltan columnas en la planilla de origen: {missing}", file=sys.stderr)
        print(f"Columnas encontradas: {list(df.columns)}", file=sys.stderr)
        return 1

    df["fecha"] = pd.to_datetime(df["fecha"], errors="coerce")
    if df["fecha"].isna().any():
        n_bad = int(df["fecha"].isna().sum())
        print(f"AVISO: se descartaron {n_bad} filas con fecha inválida.")
        df = df[df["fecha"].notna()]

    rows = []
    for _, r in df.iterrows():
        rows.append({
            "fecha": r["fecha"].strftime("%Y-%m-%d"),
            "productor": str(r["productor"]).strip(),
            "cultivo": str(r["cultivo"]).strip(),
            "contrato": str(r["contrato"]).strip(),
            "recibida": float(r["cantidad_recibida_tn"] or 0),
            "liquidada": float(r["cantidad_liquidada_tn"] or 0),
            "facturada": float(r["cantidad_facturada_tn"] or 0),
            "precio": float(r["precio_liquidacion_usd_tn"] or 0),
            "monto": float(r["monto_liquidado_usd"] or 0),
            "estado": str(r["estado_contrato"]).strip(),
        })

    if not rows:
        print("ERROR: no quedaron filas válidas para publicar.", file=sys.stderr)
        return 1

    payload = {
        "rows": rows,
        "updated": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
    }

    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False)

    print(f"OK: {len(rows)} contratos escritos en {OUT_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
