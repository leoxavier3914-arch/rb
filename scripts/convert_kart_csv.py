"""Convert a Kiwify abandoned carts export to the Supabase import format."""
from __future__ import annotations

import csv
import json
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Iterable, Optional

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INPUT_CANDIDATES = ("cart.csv", "cart", "carts_ksw77d_1758516482400.csv")
INPUT_PATH = next((REPO_ROOT / candidate for candidate in DEFAULT_INPUT_CANDIDATES if (REPO_ROOT / candidate).exists()), None)
OUTPUT_PATH = REPO_ROOT / "supabase_abandoned_emails_import.csv"

COLUMNS = [
    "id",
    "email",
    "customer_email",
    "customer_name",
    "product_id",
    "product_name",
    "product_title",
    "checkout_url",
    "checkout_id",
    "status",
    "discount_code",
    "expires_at",
    "schedule_at",
    "sent_at",
    "last_event",
    "last_reminder_at",
    "payload",
    "source",
    "traffic_source",
    "paid",
    "paid_at",
    "created_at",
    "updated_at",
]


def _ensure_input_path() -> Path:
    if INPUT_PATH is None:
        candidates = ", ".join(repr(name) for name in DEFAULT_INPUT_CANDIDATES)
        raise FileNotFoundError(
            "Nenhum arquivo de carrinhos encontrado. Coloque o CSV exportado da Kiwify "
            f"na raiz do projeto com um dos seguintes nomes: {candidates}."
        )
    return INPUT_PATH


def _normalize_datetime(value: str) -> Optional[str]:
    value = (value or "").strip()
    if not value:
        return None

    normalized = " ".join(value.replace("\n", " ").split())
    for fmt in ("%d/%m/%Y, %H:%M", "%Y-%m-%d %H:%M:%S"):
        try:
            naive = datetime.strptime(normalized, fmt)
            break
        except ValueError:
            continue
    else:
        raise ValueError(f"Não foi possível interpretar a data: {value!r}")

    aware = naive.replace(tzinfo=timezone(timedelta(hours=-3)))
    return aware.isoformat()


def _build_payload(row: dict, creation_iso: Optional[str]) -> str:
    payload: dict[str, str] = {}

    document = (row.get("Customer Document Number") or "").strip()
    if document:
        payload["customer_document_number"] = document

    phone = (row.get("Customer Phone") or "").strip()
    if phone:
        payload["customer_phone"] = phone

    source_type = (row.get("Type") or "").strip()
    if source_type:
        payload["source_type"] = source_type

    if creation_iso:
        payload["kiwify_creation_at"] = creation_iso

    return json.dumps(payload, ensure_ascii=False) if payload else "{}"


def _format_timestamp(value: datetime) -> str:
    """Format datetimes for Postgres timestamp with time zone columns."""

    # Supabase CSV importer espera o formato "YYYY-MM-DD HH:MM:SS+00".
    # `strftime` com `%z` gera o deslocamento sem dois-pontos ("+0000"),
    # que também é aceito pelo Postgres.
    return value.strftime("%Y-%m-%d %H:%M:%S%z")


def _generate_rows(reader: Iterable[dict[str, str]]) -> list[list[str]]:
    now_formatted = _format_timestamp(datetime.now(timezone.utc))

    rows: list[list[str]] = []

    for row in reader:
        customer_email = (row.get("Customer Email") or "").strip()
        if not customer_email:
            # We cannot import rows sem email, então pulamos.
            continue

        cart_id = (row.get("Cart Id") or "").strip()
        checkout_url = (row.get("Checkout Link") or "").strip()
        customer_name = (row.get("Customer Name") or "").strip()
        product_name = (row.get("Product name") or "").strip()

        creation_iso = _normalize_datetime(row.get("Creation Date", "")) if row.get("Creation Date") else None
        payload = _build_payload(row, creation_iso)

        row_uuid = uuid.uuid5(uuid.NAMESPACE_URL, f"kiwify-cart:{cart_id}") if cart_id else uuid.uuid4()

        rows.append(
            [
                str(row_uuid),
                customer_email,
                customer_email,
                customer_name,
                "",
                product_name,
                product_name,
                checkout_url,
                cart_id,
                "pending",
                "",
                "",
                "",
                "",
                "kiwify_cart_import",
                "",
                payload,
                "kiwify",
                "unknown",
                "false",
                "",
                now_formatted,
                now_formatted,
            ]
        )

    return rows


def convert() -> None:
    input_path = _ensure_input_path()

    with input_path.open("r", newline="", encoding="utf-8") as source:
        reader = csv.DictReader(source)
        rows = _generate_rows(reader)

    with OUTPUT_PATH.open("w", newline="", encoding="utf-8") as target:
        writer = csv.writer(target)
        writer.writerow(COLUMNS)
        writer.writerows(rows)

    print(f"Arquivo gerado com sucesso: {OUTPUT_PATH}")


if __name__ == "__main__":
    convert()
