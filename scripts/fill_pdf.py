#!/usr/bin/env python3
"""Fill vendor intake PDF form fields from a JSON mapping.

Usage:
    python3 scripts/fill_pdf.py <template_path> <output_path> <json_fields>

Prints the output path on success, exits 1 with error message on failure.
"""

import json
import sys

import pypdf
from pypdf import PdfWriter


def fill_pdf(template_path: str, output_path: str, fields: dict) -> None:
    reader = pypdf.PdfReader(template_path)
    writer = PdfWriter()
    writer.append(reader)

    for page in writer.pages:
        writer.update_page_form_field_values(page, fields, auto_regenerate=False)

    with open(output_path, "wb") as fh:
        writer.write(fh)

    print(output_path)


if __name__ == "__main__":
    if len(sys.argv) != 4:
        print("Usage: fill_pdf.py <template> <output> <json_fields>", file=sys.stderr)
        sys.exit(1)

    template_path = sys.argv[1]
    output_path = sys.argv[2]

    try:
        fields = json.loads(sys.argv[3])
    except json.JSONDecodeError as exc:
        print(f"Invalid JSON: {exc}", file=sys.stderr)
        sys.exit(1)

    fill_pdf(template_path, output_path, fields)
