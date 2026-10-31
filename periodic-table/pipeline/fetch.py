"""Download every Stage 1 source file into pipeline/raw/ and record it in manifest.json.

Run:  python -I fetch.py
Raw files are not committed (some sources, such as NIST SRD, are copyrighted).
The manifest (URL, SHA-256, date) is committed, so a rerun shows whether a source changed.
"""
import datetime
import hashlib
import json
import pathlib
import sys
import urllib.request
import zipfile

HERE = pathlib.Path(__file__).resolve().parent
RAW = HERE / "raw"
MANIFEST = HERE / "manifest.json"

NIST_IE = (
    "https://physics.nist.gov/cgi-bin/ASD/ie.pl?spectra=H-Og+I&submit=Retrieve+Data"
    "&units=1&format=2&order=0&at_num_out=on&sp_name_out=on&ion_charge_out=on&el_name_out=on"
    "&seq_out=on&shells_out=on&conf_out=on&level_out=on&ion_conf_out=on&e_out=0&unc_out=on&biblio=on"
)
PMG = "https://raw.githubusercontent.com/materialsproject/pymatgen/main/dev_scripts/periodic_table_resources/"
MENDELEEV_WHL = (
    "https://files.pythonhosted.org/packages/77/c0/c6fe26d8eda3b6eb1c4e3265ced9879dd95f0ca51d3569b042781f98ea76/"
    "mendeleev-1.3.0-py3-none-any.whl"
)

SOURCES = {
    "nist_ie.csv": NIST_IE,
    "ciaaw_standard.htm": "https://www.ciaaw.org/atomic-weights.htm",
    "ciaaw_abridged.htm": "https://www.ciaaw.org/abridged-atomic-weights.htm",
    "pubchem_periodictable.json": "https://pubchem.ncbi.nlm.nih.gov/rest/pug/periodictable/JSON",
    "mendeleev-1.3.0.whl": MENDELEEV_WHL,
    "pymatgen_shannon_radii.csv": PMG + "Shannon_Radii.csv",
    "pymatgen_radii.csv": PMG + "radii.csv",
    "wikipedia_covalent_radius.txt": "https://en.wikipedia.org/w/index.php?title=Covalent_radius&action=raw",
}


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    RAW.mkdir(exist_ok=True)
    old = json.loads(MANIFEST.read_text()) if MANIFEST.exists() else {}
    new = {}
    for name, url in SOURCES.items():
        req = urllib.request.Request(url, headers={"User-Agent": "CHM1025-periodic-table-pipeline"})
        with urllib.request.urlopen(req, timeout=120) as r:
            data = r.read()
        path = RAW / name
        path.write_bytes(data)
        h = sha256(path)
        changed = name in old and old[name]["sha256"] != h
        new[name] = {
            "url": url,
            "sha256": h,
            "bytes": len(data),
            "retrieved": datetime.date.today().isoformat() if changed or name not in old else old[name]["retrieved"],
        }
        print(f"{'CHANGED ' if changed else ''}{name}: {len(data)} bytes")
    # Unpack the mendeleev SQLite database (data only; no code from the wheel is run).
    with zipfile.ZipFile(RAW / "mendeleev-1.3.0.whl") as z:
        (RAW / "mendeleev_elements.db").write_bytes(z.read("mendeleev/elements.db"))
    MANIFEST.write_text(json.dumps(new, indent=2) + "\n")


if __name__ == "__main__":
    sys.exit(main())
