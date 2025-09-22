import csv
import json
from datetime import datetime, timezone, timedelta
from pathlib import Path

INPUT_PATH = Path(__file__).resolve().parent.parent / "carts_ksw77d_1758516482400.csv"
OUTPUT_PATH = Path(__file__).resolve().parent.parent / "supabase_abandoned_emails_import.csv"

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
    "paid",
    "paid_at",
    "created_at",
    "updated_at",
]


def parse_datetime(value: str) -> str:
    value = value.strip()
    if not value:
        return ""

    normalized = " ".join(value.split())
    try:
        naive = datetime.strptime(normalized, "%d/%m/%Y, %H:%M")
    except ValueError as exc:  # pragma: no cover - defensive branch
        raise ValueError(f"Failed to parse datetime value: {value!r}") from exc

    aware = naive.replace(tzinfo=timezone(timedelta(hours=-3)))
    return aware.isoformat()


def build_payload(row: dict) -> str:
    payload = {}

    document = row.get("Customer Document Number", "").strip()
    if document:
        payload["customer_document_number"] = document

    phone = row.get("Customer Phone", "").strip()
    if phone:
        payload["customer_phone"] = phone

    source_type = row.get("Type", "").strip()
    if source_type:
        payload["source_type"] = source_type

    if not payload:
        return "{}"

    return json.dumps(payload, ensure_ascii=False)


def convert() -> None:
    with INPUT_PATH.open("r", newline="", encoding="utf-8") as source:
        reader = csv.DictReader(source)
        rows = []
        for row in reader:
            cart_id = row.get("Cart Id", "").strip()
            customer_email = row.get("Customer Email", "").strip()
            customer_name = row.get("Customer Name", "").strip()
            product_name = row.get("Product name", "").strip()
            checkout_url = row.get("Checkout Link", "").strip()
            created_iso = parse_datetime(row.get("Creation Date", ""))

            rows.append([
                cart_id,
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
                created_iso,
                "",
                "",
                "",
                build_payload(row),
                "kiwify",
                "false",
                "",
                created_iso,
                created_iso,
            ])

    with OUTPUT_PATH.open("w", newline="", encoding="utf-8") as target:
        writer = csv.writer(target)
        writer.writerow(COLUMNS)
        writer.writerows(rows)


if __name__ == "__main__":
    convert()
