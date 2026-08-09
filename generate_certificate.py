#!/usr/bin/env python3
"""Create a printable test PDF from the approved SAOA template."""

from pathlib import Path
from shutil import copyfile


TEMPLATE = Path(__file__).with_name("SAOA_FINAL_cleaned.pdf")
OUTPUT = Path(__file__).with_name("SAOA_Print_Test.pdf")


def build_pdf(output_path: Path = OUTPUT) -> Path:
    """Copy the approved template without altering its print alignment."""
    if not TEMPLATE.is_file():
        raise FileNotFoundError(f"Certificate template not found: {TEMPLATE}")
    if TEMPLATE.read_bytes()[:5] != b"%PDF-":
        raise ValueError(f"Certificate template is not a PDF: {TEMPLATE}")

    output_path = Path(output_path)
    if output_path.resolve() == TEMPLATE.resolve():
        raise ValueError("Output path must not overwrite the certificate template")

    copyfile(TEMPLATE, output_path)
    return output_path


if __name__ == "__main__":
    generated = build_pdf()
    print(f"Generated {generated}")
