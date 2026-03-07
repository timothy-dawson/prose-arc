"""
CLI script to generate and insert invite codes into the database.

Usage:
    python scripts/generate_invite_codes.py --count 10
    python scripts/generate_invite_codes.py --count 5 --prefix BETA
"""

import argparse
import asyncio
import os
import sys

# Ensure app is on the path when running from src/backend/
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import asyncpg

from app.modules.identity.service import generate_invite_codes


async def insert_codes(codes: list[str], database_url: str) -> None:
    # asyncpg uses plain postgres:// URL, not postgresql+asyncpg://
    url = database_url.replace("postgresql+asyncpg://", "postgresql://").replace(
        "postgresql+psycopg2://", "postgresql://"
    )
    conn = await asyncpg.connect(url)
    try:
        inserted = 0
        skipped = 0
        for code in codes:
            try:
                await conn.execute(
                    "INSERT INTO invite_codes (id, code, is_active, created_at) "
                    "VALUES (gen_random_uuid(), $1, true, now())",
                    code,
                )
                inserted += 1
            except asyncpg.UniqueViolationError:
                skipped += 1
        print(f"Inserted {inserted} codes, skipped {skipped} duplicates.")
    finally:
        await conn.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate invite codes for Prose Arc beta.")
    parser.add_argument("--count", type=int, default=10, help="Number of codes to generate")
    parser.add_argument("--prefix", type=str, default="", help="Optional prefix for codes")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print codes without inserting into DB",
    )
    args = parser.parse_args()

    codes = generate_invite_codes(args.count, prefix=args.prefix)

    if args.dry_run:
        for code in codes:
            print(code)
        return

    database_url = os.environ.get("DATABASE_URL", "")
    if not database_url:
        print("ERROR: DATABASE_URL environment variable is not set.", file=sys.stderr)
        sys.exit(1)

    print(f"Generated {len(codes)} codes:")
    for code in codes:
        print(f"  {code}")

    asyncio.run(insert_codes(codes, database_url))


if __name__ == "__main__":
    main()
