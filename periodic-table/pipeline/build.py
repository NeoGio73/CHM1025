"""Build site/data/elements.json and sources.json from the raw source files.

Run after fetch.py:   python -I build.py
Writes:
  ../site/data/elements.json   per-element values, each with source, status and cross-check result
  ../site/data/sources.json    full citations
  out/crosscheck.md            every comparison with a second source, and every science check
Exits non-zero if a value lacks source/status, or a science check fails.
"""
import csv
import html
import json
import pathlib
import re
import sqlite3
import sys

HERE = pathlib.Path(__file__).resolve().parent
RAW = HERE / "raw"
OUT = HERE / "out"
DATA = HERE.parent / "site" / "data"
MANIFEST = json.loads((HERE / "manifest.json").read_text())

L_LETTERS = "spdfghi"
NOBLE = [(2, "He"), (10, "Ne"), (18, "Ar"), (36, "Kr"), (54, "Xe"), (86, "Rn")]
NIST_CORES = {  # from the notes at the end of the NIST ASD output
    "He": "1s2",
    "Ne": "1s2.2s2.2p6",
    "Ar": "1s2.2s2.2p6.3s2.3p6",
    "Kr": "1s2.2s2.2p6.3s2.3p6.3d10.4s2.4p6",
    "Cd": "1s2.2s2.2p6.3s2.3p6.3d10.4s2.4p6.4d10.5s2",
    "Xe": "1s2.2s2.2p6.3s2.3p6.3d10.4s2.4p6.4d10.5s2.5p6",
    "Hg": "1s2.2s2.2p6.3s2.3p6.3d10.4s2.4p6.4d10.5s2.5p6.4f14.5d10.6s2",
    "Rn": "1s2.2s2.2p6.3s2.3p6.3d10.4s2.4p6.4d10.5s2.5p6.4f14.5d10.6s2.6p6",
}

report = []  # lines of crosscheck.md
failures = []


def retrieved(raw_name):
    return MANIFEST[raw_name]["retrieved"]


# ---------------------------------------------------------------- sources
SOURCES = {
    "nist_asd": {
        "short": "NIST ASD v5.12",
        "citation": "Kramida, A., Ralchenko, Yu., Reader, J. and NIST ASD Team (2024). NIST Atomic Spectra Database "
        "(version 5.12). National Institute of Standards and Technology, Gaithersburg, MD.",
        "doi": "10.18434/T4W30F",
        "url": "https://physics.nist.gov/asd",
        "table": "Ionization energies of neutral atoms (H I–Hs I): ground shells, ground level, ionization energy",
        "license": "NIST Standard Reference Data. Copyright protection on this compilation of data has been secured by the "
        "Secretary of the U.S. Department of Commerce on behalf of the United States, pursuant to 15 U.S.C. § 290e. "
        "Only the individual values used are reproduced here, with attribution.",
        "retrieved": retrieved("nist_ie.csv"),
    },
    "ciaaw_2024": {
        "short": "CIAAW 2024",
        "citation": "IUPAC Commission on Isotopic Abundances and Atomic Weights (CIAAW). Standard Atomic Weights 2024 "
        "and Abridged Standard Atomic Weights 2024.",
        "url": "https://www.ciaaw.org/atomic-weights.htm",
        "table": "Standard atomic weights 2024 (intervals and values); abridged standard atomic weights 2024",
        "license": "Published reference values, cited with attribution.",
        "retrieved": retrieved("ciaaw_standard.htm"),
    },
    "cordero2008": {
        "short": "Cordero et al. 2008",
        "citation": "Cordero, B.; Gómez, V.; Platero-Prats, A. E.; Revés, M.; Echeverría, J.; Cremades, E.; Barragán, F.; "
        "Alvarez, S. Covalent radii revisited. Dalton Trans. 2008, (21), 2832–2838.",
        "doi": "10.1039/b801115j",
        "table": "Covalent radii table (pm), Z = 1–96 (table number to be confirmed against the paper)",
        "via": "mendeleev",
        "license": "Published values, cited with attribution.",
        "retrieved": retrieved("mendeleev-1.3.0.whl"),
    },
    "alvarez2013": {
        "short": "Alvarez 2013",
        "citation": "Alvarez, S. A cartography of the van der Waals territories. Dalton Trans. 2013, 42, 8617–8636.",
        "doi": "10.1039/c3dt50599e",
        "table": "Table 1, van der Waals radii (Å, shown in pm); values in brackets are rough estimates",
        "via": "mendeleev",
        "license": "Published values, cited with attribution.",
        "retrieved": retrieved("mendeleev-1.3.0.whl"),
    },
    "vogt2014": {
        "short": "Vogt & Alvarez 2014",
        "citation": "Vogt, J.; Alvarez, S. van der Waals radii of noble gases. Inorg. Chem. 2014, 53, 9260–9266.",
        "doi": "10.1021/ic501364h",
        "table": "van der Waals radii of Ar, Kr, Xe, Rn (not yet checked against the paper; paywalled)",
        "via": "mendeleev",
        "license": "Published values, cited with attribution.",
        "retrieved": retrieved("mendeleev-1.3.0.whl"),
    },
    "shannon1976": {
        "short": "Shannon 1976",
        "citation": "Shannon, R. D. Revised effective ionic radii and systematic studies of interatomic distances in "
        "halides and chalcogenides. Acta Crystallogr. A 1976, 32, 751–767.",
        "doi": "10.1107/S0567739476001551",
        "table": "Table 1, effective ionic radii (IR, Å, shown in pm), by charge, coordination number and spin",
        "via": "mendeleev",
        "license": "Published values, cited with attribution.",
        "retrieved": retrieved("mendeleev-1.3.0.whl"),
    },
    "allen2000": {
        "short": "Mann, Meek & Allen 2000",
        "citation": "Mann, J. B.; Meek, T. L.; Allen, L. C. Configuration energies of the main group elements. "
        "J. Am. Chem. Soc. 2000, 122, 2780–2783; Mann, J. B.; Meek, T. L.; Knight, E. T.; Capitani, J. F.; Allen, L. C. "
        "Configuration energies of the d-block elements. J. Am. Chem. Soc. 2000, 122, 5132–5137 (doi 10.1021/ja9928677).",
        "doi": "10.1021/ja992866e",
        "table": "Configuration energies (eV), the basis of Allen's electronegativity scale (not yet checked against "
        "the paper; paywalled)",
        "via": "mendeleev",
        "license": "Published values, cited with attribution.",
        "retrieved": retrieved("mendeleev-1.3.0.whl"),
    },
    "pubchem": {
        "short": "PubChem Periodic Table",
        "citation": "National Center for Biotechnology Information. PubChem Periodic Table of Elements. PubChem element "
        "records credit Jefferson Lab and Los Alamos National Laboratory (U.S. DOE) for melting point, boiling point and "
        "density, and PubChem Elements for Pauling electronegativity.",
        "url": "https://pubchem.ncbi.nlm.nih.gov/periodic-table/",
        "table": "PUG REST periodictable/JSON: Electronegativity, MeltingPoint (K), BoilingPoint (K), Density (g/cm³), "
        "ElectronConfiguration",
        "license": "U.S. Government work (NLM; DOE laboratories); see https://www.nlm.nih.gov/copyright.html.",
        "retrieved": retrieved("pubchem_periodictable.json"),
    },
    "mendeleev": {
        "short": "mendeleev 1.3.0",
        "citation": "Mentel, Ł. mendeleev – A Python resource for properties of chemical elements, ions and isotopes, "
        "version 1.3.0. Used as a machine-readable transcription of the original papers named in each source entry.",
        "url": "https://github.com/lmmentel/mendeleev",
        "license": "MIT License",
        "retrieved": retrieved("mendeleev-1.3.0.whl"),
    },
}
CHECK_SOURCES = {
    "pubchem": "PubChem Periodic Table (NCBI)",
    "mendeleev": "mendeleev 1.3.0 database",
    "wikipedia_cordero": "Wikipedia, 'Covalent radius' table (independent transcription of Cordero et al. 2008)",
    "pymatgen_shannon": "pymatgen Shannon_Radii.csv (independent transcription of Shannon 1976)",
    "pymatgen_radii": "pymatgen radii.csv",
}


# ---------------------------------------------------------------- helpers
def table_rows(htm):
    rows = []
    for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", htm, re.S):
        cells = [re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", c))).strip()
                 for c in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", tr, re.S)]
        rows.append(cells)
    return rows


def parse_shells(text):
    """'[Xe].4f3.6s2' or '1s2.2s2.2p' -> list of (n, l, occ) in the order given, cores expanded."""
    out = []
    for part in text.split("."):
        part = part.strip()
        if not part:
            continue
        m = re.fullmatch(r"\[(\w+)\]", part)
        if m:
            out += parse_shells(NIST_CORES[m.group(1)])
            continue
        m = re.fullmatch(r"(\d+)([spdfg])(\d*)", part)
        if not m:
            raise ValueError(f"cannot parse shell {part!r} in {text!r}")
        out.append((int(m.group(1)), L_LETTERS.index(m.group(2)), int(m.group(3) or 1)))
    return out


def parse_loose_config(text):
    """PubChem/mendeleev style '[He]2s2 2p2 (calculated)' -> dict {(n,l): occ}."""
    text = re.sub(r"\(.*?\)", "", text)
    occ = {}
    for core in re.findall(r"\[(\w+)\]", text):
        for n, l, o in parse_shells(NIST_CORES[core]):
            occ[(n, l)] = occ.get((n, l), 0) + o
    for n, l, o in re.findall(r"(\d+)([spdfg])(\d*)", re.sub(r"\[\w+\]", "", text)):
        occ[(int(n), L_LETTERS.index(l))] = occ.get((int(n), L_LETTERS.index(l)), 0) + int(o or 1)
    return occ


def short_config(subshells, Z):
    """Noble-gas abbreviation, remaining subshells in filling (Madelung) order, as Timberlake writes them."""
    occ = {(n, l): o for n, l, o in subshells}
    core_sym, core_set = None, {}
    for zc, sym in NOBLE:
        if zc >= Z:
            break
        cs = {(n, l): o for n, l, o in parse_shells(NIST_CORES[sym])}
        if all(occ.get(k) == v for k, v in cs.items()):
            core_sym, core_set = sym, cs
    rest = [(n, l, o) for (n, l), o in occ.items() if (n, l) not in core_set]
    rest.sort(key=lambda t: (t[0] + t[1], t[0]))
    parts = ([f"[{core_sym}]"] if core_sym else []) + [f"{n}{L_LETTERS[l]}{o}" for n, l, o in rest]
    return " ".join(parts)


def num(s):
    try:
        return float(s)
    except (TypeError, ValueError):
        return None


def layout(Z):
    """Period, group (1–18, None for the f rows), f-row column, block. La/Ac sit in group 3."""
    bounds = [2, 10, 18, 36, 54, 86, 118]
    period = next(i + 1 for i, b in enumerate(bounds) if Z <= b)
    start = [0, 2, 10, 18, 36, 54, 86][period - 1]
    k = Z - start  # position within period, 1-based
    if period == 1:
        return period, (1 if Z == 1 else 18), None, "s"
    if period <= 3:
        g = k if k <= 2 else k + 10
    elif period <= 5:
        g = k
    else:
        if k <= 3:
            g = k
        elif k <= 17:
            return period, None, k - 3, "f"
        else:
            g = k - 14
    block = "s" if g <= 2 else ("d" if g <= 12 else "p")
    if Z == 2:
        block = "s"
    return period, g, None, block


def value(v, unit, src, status, **extra):
    d = {"v": v, "u": unit, "src": src, "status": status}
    d.update({k: x for k, x in extra.items() if x is not None})
    return d


# ---------------------------------------------------------------- load raw
def load_nist():
    rows = list(csv.reader(open(RAW / "nist_ie.csv", encoding="latin-1")))
    clean = lambda s: s.strip().lstrip("=").strip('"')
    out = {}
    for r in rows[1:]:
        r = [clean(c) for c in r]
        if len(r) < 14 or not r[0].isdigit():
            continue
        out[int(r[0])] = {
            "name": r[3], "shells": r[5], "level": r[7], "prefix": r[9], "ie": num(r[10]),
            "unc": num(r[12]), "ref": r[13],
        }
    return out


def load_pubchem():
    d = json.loads((RAW / "pubchem_periodictable.json").read_text(encoding="utf-8"))["Table"]
    cols = d["Columns"]["Column"]
    return {int(r["Cell"][0]): dict(zip(cols, r["Cell"])) for r in d["Row"]}


def load_ciaaw():
    std = {}
    for c in table_rows((RAW / "ciaaw_standard.htm").read_text(encoding="utf-8", errors="replace")):
        if len(c) >= 4 and c[0].isdigit():
            std[int(c[0])] = {"symbol": c[1], "text": c[3].replace(" ", " ").strip(), "notes": c[4] if len(c) > 4 else ""}
    abr = {}
    for c in table_rows((RAW / "ciaaw_abridged.htm").read_text(encoding="utf-8", errors="replace")):
        if len(c) >= 4 and c[0].isdigit():
            m = re.match(r"([\d.]+)\s*±\s*([\d.]+)", c[3].replace(" ", " "))
            abr[int(c[0])] = (m.group(1), m.group(2)) if m else None
    return std, abr


def load_mendeleev():
    con = sqlite3.connect(RAW / "mendeleev_elements.db")
    con.row_factory = sqlite3.Row
    el = {r["atomic_number"]: dict(r) for r in con.execute("select * from elements")}
    ions = {}
    for r in con.execute("select atomic_number, charge, coordination, spin, ionic_radius, crystal_radius, origin "
                         "from ionicradii"):
        ions.setdefault(r["atomic_number"], []).append(dict(r))
    pt = {}
    for r in con.execute("select atomic_number, melting_point, boiling_point, allotrope from phasetransitions"):
        pt.setdefault(r["atomic_number"], []).append(dict(r))
    return el, ions, pt


def load_wiki_cordero():
    """Parse the Wikipedia covalent-radius grid: a symbol row, a Z row, then a value row."""
    txt = (RAW / "wikipedia_covalent_radius.txt").read_text(encoding="utf-8")
    start = txt.find("{|")
    end = txt.find("|}", start)
    rows, cur = [], []
    for line in txt[start:end].splitlines():
        if line.startswith("|-"):
            if cur:
                rows.append(cur)
            cur = []
        elif line.startswith("|") and not line.startswith("|+"):
            for cell in line[1:].split("||"):
                if "colspan" in cell:
                    continue
                cell = cell.split("|", 1)[1] if re.match(r"\s*style=", cell) else cell
                if cell.strip() in ("", "&nbsp;", "*", "**"):  # blanks and the f-block placeholders
                    continue
                cur.append(cell.strip())
    if cur:
        rows.append(cur)
    out = {}
    for i in range(len(rows) - 2):
        syms, zs, vals = rows[i], rows[i + 1], rows[i + 2]
        if syms and all(re.fullmatch(r"[A-Z][a-z]?", s) for s in syms) and len(zs) == len(syms) and len(vals) == len(syms) \
                and all(z.isdigit() for z in zs):
            for z, v in zip(zs, vals):
                txt_v = re.sub(r"<sup>(.*?)</sup>", r"\1", v).replace("<br>", "; ").replace("&nbsp;", " ")
                pairs = {int(a): int(b) for a, b in re.findall(r"(\d+)\((\d+)\)", txt_v)}
                if not pairs:
                    pairs = {int(x): None for x in re.findall(r"^\s*(\d+)\s*$", txt_v)}
                out[int(z)] = {"text": re.sub(r"\s+", " ", txt_v).strip(), "nums": list(pairs), "sd": pairs}
    return out


def load_pmg_shannon():
    out = {}
    with open(RAW / "pymatgen_shannon_radii.csv", encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            if not r["Charge"].strip():  # one Eu row has no charge; skip rather than guess
                continue
            out.setdefault((r["Element"], int(r["Charge"]), r["Coordination"], r["Spin State"]), num(r["Ionic Radius"]))
    return out


def load_pmg_radii():
    with open(RAW / "pymatgen_radii.csv", encoding="utf-8-sig") as f:
        return {r["element"]: r for r in csv.DictReader(f)}


# ---------------------------------------------------------------- main
def main():
    nist = load_nist()
    pc = load_pubchem()
    std, abr = load_ciaaw()
    mel, mions, mpt = load_mendeleev()
    wcor = load_wiki_cordero()
    pmg_sh = load_pmg_shannon()
    pmg_r = load_pmg_radii()

    xc = {k: [] for k in ["config", "atomic_weight", "ionization_energy", "covalent_radius", "ionic_radius",
                          "electronegativity", "melting_point", "boiling_point", "density", "vdw_radius"]}
    elements = []

    for Z in range(1, 119):
        p = pc[Z]
        sym = p["Symbol"]
        period, group, fcol, block = layout(Z)
        e = {"Z": Z, "sym": sym, "name": p["Name"], "period": period, "group": group, "fcol": fcol, "block": block,
             "props": {}, "ions": []}

        # --- configuration and term symbol
        if Z in nist:
            n = nist[Z]
            e["name"] = n["name"]
            sub = parse_shells(n["shells"])
            st = "predicted" if Z >= 104 else "recommended"
            e["config"] = value(short_config(sub, Z), None, "nist_asd", st, full=" ".join(
                f"{a}{L_LETTERS[b]}{c}" for a, b, c in sub))
            e["term"] = value(n["level"], None, "nist_asd", st)
            if Z == 103:  # no Lr energy levels have been measured; NIST's 7p ground state comes from calculations
                for d in (e["config"], e["term"]):
                    d["status"] = "computed"
                    d["note"] = ("Calculated ground state. No energy levels of lawrencium have been measured; the measured "
                                 "ionization energy (2015) agrees with the calculations that predict 7p.")
        else:
            sub_d = parse_loose_config(p["ElectronConfiguration"])
            sub = [(a, b, c) for (a, b), c in sub_d.items()]
            e["config"] = value(short_config(sub, Z), None, "pubchem", "predicted",
                                note="Not in NIST ASD; theoretical configuration reported by PubChem.")
        count = sum(c for _, _, c in sub)
        if count != Z:
            failures.append(f"{sym}: configuration has {count} electrons, expected {Z}")
        mine = {(a, b): c for a, b, c in sub}
        for label, other in (("PubChem", p["ElectronConfiguration"]), ("mendeleev", mel[Z]["electronic_configuration"])):
            if other and parse_loose_config(other) != mine:
                xc["config"].append(f"| {Z} {sym} | {e['config']['v']} | {label}: `{other}` |")
        e["config"]["check"] = "differs" if any(f"| {Z} {sym} |" in l for l in xc["config"]) else "agrees"

        # --- atomic weight
        s = std.get(Z)
        if abr.get(Z):
            v, unc = abr[Z]
            e["props"]["atomic_weight"] = value(float(v), "", "ciaaw_2024", "recommended", unc=float(unc), digits=v,
                                                standard=s["text"] if s else None)
            pv = num(p["AtomicMass"])
            dp = len(p["AtomicMass"].split(".")[1]) if "." in p["AtomicMass"] else 0
            # PubChem prints fewer digits for some elements; compare at PubChem's precision.
            ok = pv is not None and (abs(pv - float(v)) <= float(unc) + 1e-9 or round(float(v), dp) == pv)
            e["props"]["atomic_weight"]["check"] = "agrees" if ok else "differs"
            if not ok:
                xc["atomic_weight"].append(f"| {Z} {sym} | {v} ± {unc} | PubChem {p['AtomicMass']} |")

        # --- ionization energy
        if Z in nist and nist[Z]["ie"] is not None:
            n = nist[Z]
            if n["prefix"] == "(":
                st, note = ("computed", "Theoretical value (NIST parentheses).") if Z < 104 else \
                    ("predicted", "Theoretical value (NIST parentheses).")
            elif n["prefix"] == "[":
                st, note = ("recommended", "Semi-empirical value (NIST brackets).") if Z < 104 else \
                    ("predicted", "Semi-empirical value (NIST brackets).")
            else:
                st, note = "measured", None
            d = value(n["ie"], "eV", "nist_asd", st, unc=n["unc"], note=note, ref=n["ref"])
            pv = num(p["IonizationEnergy"])
            if pv is None:
                d["check"] = "single-source"
            elif abs(pv - n["ie"]) <= max(0.0011, (n["unc"] or 0)):
                d["check"] = "agrees"
            else:
                d["check"] = "differs"
                d["other"] = {"src": "pubchem", "v": pv}
                xc["ionization_energy"].append(f"| {Z} {sym} | {n['ie']} | PubChem {pv} |")
            e["props"]["ionization_energy"] = d

        # --- covalent radius (default "atomic size")
        cv = mel[Z]["covalent_radius_cordero"]
        if cv is not None:
            cv = int(round(cv))
            w = wcor.get(Z)
            note = None
            if Z in COVALENT_CHOICE:
                label, cv = COVALENT_CHOICE[Z]
                note = f"Cordero et al. list several values ({w['text']} pm); the {label} value is shown."
            d = value(cv, "pm", "cordero2008", "measured", note=note)
            if not w:
                d["check"] = "single-source"
                xc["covalent_radius"].append(f"| {Z} {sym} | {cv} | not found in Wikipedia table |")
            elif cv in w["nums"]:
                d["check"] = "agrees"
                if w["sd"].get(cv) is not None:
                    # Cordero's number in parentheses is the standard deviation of the bond-length data (a spread,
                    # not a measurement uncertainty). Taken from the Wikipedia transcription.
                    d["spread"] = w["sd"][cv]
                else:
                    d["status"] = "estimated"
                    d["note"] = ((note + " ") if note else "") + \
                        "No spread is reported for this value: it rests on very few or no crystal structures."
            else:
                d["check"] = "differs"
                xc["covalent_radius"].append(f"| {Z} {sym} | {cv} | Wikipedia `{w['text']}` |")
            e["props"]["covalent_radius"] = d

        # --- van der Waals radius (Alvarez 2013; Ar, Kr, Xe, Rn from Vogt & Alvarez 2014)
        vv = mel[Z]["vdw_radius_alvarez"]
        if vv is not None:
            src = "vogt2014" if Z in (18, 36, 54, 86) else "alvarez2013"
            d = value(int(round(vv)), "pm", src, "measured", check="single-source")
            if Z in ALVAREZ_BRACKETED:
                d["status"] = "estimated"
                d["note"] = "Rough estimate (shown in brackets in Alvarez's Table 1): based on very little data."
            e["props"]["vdw_radius"] = d

        # --- electronegativity
        en = num(p["Electronegativity"])
        if en is not None:
            m = mel[Z]["en_pauling"]
            if Z >= 95 and m is None:
                d = value(en, "", "pubchem", "predicted",
                          note="Estimated value; the source gives no measured basis for this element.")
            else:
                d = value(en, "", "pubchem", "recommended")
            if m is None:
                d["check"] = "single-source"
                xc["electronegativity"].append(f"| {Z} {sym} | {en} | no second value (mendeleev/CRC has none) |")
            elif abs(m - en) <= 0.011:
                d["check"] = "agrees"
            else:
                d["check"] = "differs"
                d["other"] = {"src": "mendeleev", "v": m}
                xc["electronegativity"].append(f"| {Z} {sym} | {en} | mendeleev (CRC) {m} |")
            e["props"]["electronegativity"] = d
        al = mel[Z]["en_allen"]  # configuration energy in eV (labelled as such in the UI)
        if al is not None:
            e["props"]["electronegativity_allen"] = value(round(al, 3), "eV", "allen2000", "computed",
                                                         check="single-source")

        # --- melting point, boiling point, density
        never_bulk = Z in (85, 87) or Z >= 100
        for key, col, unit, mcol in (("melting_point", "MeltingPoint", "K", "melting_point"),
                                     ("boiling_point", "BoilingPoint", "K", "boiling_point"),
                                     ("density", "Density", "g/cm³", None)):
            pv = num(p[col])
            if pv is None:
                continue
            special = PHASE_SPECIAL.get((Z, key))
            if special and special[0] == "gap":
                e.setdefault("gaps", {})[key] = special[1]
                xc[key].append(f"| {Z} {sym} | not shown | PubChem {pv}: {special[1]} |")
                continue
            st = "predicted" if never_bulk else "measured"
            note = "Element never made in weighable amounts; value is an estimate." if never_bulk else None
            gas = key == "density" and "Gas" in p["StandardState"]
            if gas:
                note = "Gas at 0 °C and 1 atm."
            if (Z, key) == (6, "density"):
                note = "Graphite."
            if special:
                note = special[1]
            d = value(pv, unit, "pubchem", st, note=note)
            if mcol:
                others = [r[mcol] for r in mpt.get(Z, []) if r[mcol] is not None]
            else:
                md = mel[Z]["density"]
                # CRC gives gas densities at 25 °C; PubChem at 0 °C. Convert CRC's to 0 °C (ideal gas) to compare.
                others = [md * 298.15 / 273.15 if gas else md] if md is not None else []
            if not others:
                d["check"] = "single-source"
                xc[key].append(f"| {Z} {sym} | {pv} | no second value |")
            elif any(abs(o - pv) <= max(0.02 * abs(pv), 0.5 if unit == "K" else 0) for o in others):
                d["check"] = "agrees"
            else:
                d["check"] = "differs"
                d["other"] = {"src": "mendeleev", "v": round(others[0], 6)}
                xc[key].append(f"| {Z} {sym} | {pv} | mendeleev (CRC) {', '.join(f'{o:g}' for o in others)} |")
            e["props"][key] = d

        # --- ionic radii (Shannon): every charge, coordination number and spin state listed
        for r in sorted(mions.get(Z, []), key=lambda r: (r["charge"], ROMAN.get(r["coordination"], 99), r["spin"] or "")):
            ir = ION_OVERRIDE.get((sym, r["charge"], r["coordination"]), r["ionic_radius"])
            if ir is None:
                continue
            if ir <= 0:  # e.g. C4+ CN III is -8 pm in Shannon: a fitting artifact, meaningless to students
                xc["ionic_radius"].append(f"| {Z} {sym}{r['charge']:+d} CN {r['coordination']} | not shown | "
                                          f"Shannon lists {ir} pm (zero or negative) |")
                continue
            origin = (r["origin"] or "").lower()
            flagged = [w for w in ("estimated", "calculated") if w in origin]
            ion = {"charge": r["charge"], "cn": r["coordination"], "spin": r["spin"] or None,
                   "v": round(ir, 1), "u": "pm", "src": "shannon1976",
                   "status": "estimated" if flagged else "measured"}
            if flagged:
                ion["note"] = f"Shannon marks this radius as {' and '.join(flagged)}."
            e["ions"].append(ion)
        for ion in e["ions"]:
            if (sym, ion["charge"], ion["cn"]) in ION_OVERRIDE:
                ion["check"] = "agrees"
                ion["note"] = "Checked against Shannon (1976) Table 1 by the reviewer; one transcription had this wrong."
                continue
            spin = {"HS": "High Spin", "LS": "Low Spin"}.get(ion["spin"] or "", "")
            pm = pmg_sh.get((sym, ion["charge"], ion["cn"], spin))
            if pm is None:
                ion["check"] = "single-source"
            elif abs(pm * 100 - ion["v"]) <= 0.51:
                ion["check"] = "agrees"
            else:
                ion["check"] = "differs"
                xc["ionic_radius"].append(f"| {Z} {sym}{ion['charge']:+d} CN {ion['cn']} | {ion['v']} | pymatgen {pm * 100:g}"
                                          " (two transcriptions disagree; not shipped until checked against Shannon) |")
        e["ions"] = [i for i in e["ions"] if i["check"] != "differs"]

        elements.append(e)

    science_checks(elements)
    meta = property_meta()
    for e in elements:
        for k, d in list(e["props"].items()) + [("config", e["config"])]:
            if not d.get("src") or not d.get("status"):
                failures.append(f"{e['sym']} {k}: missing source or status")
            if d.get("src") not in SOURCES:
                failures.append(f"{e['sym']} {k}: unknown source {d.get('src')}")

    DATA.mkdir(parents=True, exist_ok=True)
    (DATA / "elements.json").write_text(json.dumps({"properties": meta, "elements": elements},
                                                   ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    (DATA / "sources.json").write_text(json.dumps({"sources": SOURCES, "check_sources": CHECK_SOURCES},
                                                  ensure_ascii=False, indent=1), encoding="utf-8")
    write_report(xc, elements)
    if failures:
        print("FAILED:\n  " + "\n  ".join(failures))
        return 1
    print(f"OK: {len(elements)} elements written; see out/crosscheck.md")
    return 0


# ---------------------------------------------------------------- model choices (each listed in REVIEW.md)
# Cordero et al. give more than one covalent radius for these elements. mendeleev stores carbon's sp2 value
# and the average of the low- and high-spin values for Mn, Fe, Co (an average is not in the paper).
# We show one published value and name it; all values appear in the note.
COVALENT_CHOICE = {
    6: ("sp³ (single-bond)", 76),
    25: ("low-spin", 139),
    26: ("low-spin", 132),
    27: ("low-spin", 126),
}

ROMAN = {"I": 1, "II": 2, "III": 3, "IIIPY": 3, "IV": 4, "IVSQ": 4, "V": 5, "VI": 6, "VII": 7, "VIII": 8, "IX": 9,
         "X": 10, "XI": 11, "XII": 12, "XIV": 14}

# Alvarez 2013 Table 1 puts these values in brackets ("rough estimates"); per the independent review.
ALVAREZ_BRACKETED = {2, 10, 89, 91, 96, 97, 98, 99}

# Transcription errors fixed against the original paper (reviewer checked Shannon 1976 Table 1, p. 752).
ION_OVERRIDE = {("Ce", 4, "X"): 107.0}

# Values that don't mean what the column says (the column is "at 1 atm").
# ("gap", note) hides the value and shows the note; ("note", note) keeps the value with the note.
PHASE_SPECIAL = {
    (2, "melting_point"): ("gap", "Helium does not freeze at 1 atm, so it has no normal melting point. "
                                  "It solidifies only under about 25 atm."),
    (6, "melting_point"): ("gap", "Carbon does not melt at 1 atm; it sublimes (solid turns directly to gas)."),
    (6, "boiling_point"): ("note", "Sublimation point: carbon goes straight from solid to gas at 1 atm."),
    (33, "melting_point"): ("gap", "Arsenic does not melt at 1 atm; it sublimes. It melts only under pressure."),
    (33, "boiling_point"): ("note", "Sublimation point: arsenic goes straight from solid to gas at 1 atm."),
}

# ---------------------------------------------------------------- science checks
# Trend exceptions found in the data. Each was confirmed against the source value and has a known cause.
KNOWN_EXCEPTIONS = {
    ("covalent_radius", "As", "Se"): "Rise of 1 pm, well inside the spread (standard deviation, 4 pm) Cordero reports.",
    ("covalent_radius", "Te", "I"): "Rise of 1 pm, inside the spread Cordero reports.",
    ("covalent_radius", "Tl", "Pb"): "Rise of 1 pm, inside the spread Cordero reports.",
    ("covalent_radius", "Pb", "Bi"): "Rise of 2 pm, inside the spread Cordero reports.",
    ("covalent_radius", "Po", "At"): "Cordero reports no spread for At (very little data); shown as an estimate.",
    ("ionization_energy", "Be", "B"): "Electron removed from the higher-energy p sublevel.",
    ("ionization_energy", "Mg", "Al"): "Electron removed from the higher-energy p sublevel.",
    ("ionization_energy", "Ca", "Ga"): "Electron removed from the higher-energy p sublevel.",
    ("ionization_energy", "N", "O"): "Removing a paired electron from the p sublevel (pairing repulsion).",
    ("ionization_energy", "P", "S"): "Removing a paired electron from the p sublevel (pairing repulsion).",
    ("ionization_energy", "As", "Se"): "Removing a paired electron from the p sublevel (pairing repulsion).",
    ("ionization_energy", "Pb", "Bi"): "Relativistic splitting of the 6p sublevel.",
    ("ionization_energy", "Al", "Ga"): "Filled 3d sublevel shields poorly (d-block contraction).",
    ("ionization_energy", "In", "Tl"): "Filled 4f/5d sublevels shield poorly, plus relativistic effects.",
    ("ionization_energy", "Sn", "Pb"): "Filled 4f/5d sublevels shield poorly, plus relativistic effects.",
}


def science_checks(elements):
    by = {e["sym"]: e for e in elements}
    grid = {}
    for e in elements:
        if e["group"]:
            grid[(e["period"], e["group"])] = e
    mains = [1, 2, 13, 14, 15, 16, 17]

    def val(e, k):
        d = e["props"].get(k)
        return d["v"] if d and d["status"] != "predicted" else None

    found = []
    for k, across, down in (("covalent_radius", -1, +1), ("ionization_energy", +1, -1)):
        for period in range(2, 7):
            seq = [grid.get((period, g)) for g in mains]
            seq = [e for e in seq if e and val(e, k) is not None]
            for a, b in zip(seq, seq[1:]):
                if (val(b, k) - val(a, k)) * across < 0:
                    found.append((k, a["sym"], b["sym"], "across"))
        for g in mains + [18]:
            seq = [grid.get((p, g)) for p in range(1, 7)]
            seq = [e for e in seq if e and val(e, k) is not None]
            for a, b in zip(seq, seq[1:]):
                if (val(b, k) - val(a, k)) * down < 0:
                    found.append((k, a["sym"], b["sym"], "down"))
    science_checks.found = found
    for k, a, b, how in found:
        if (k, a, b) not in KNOWN_EXCEPTIONS:
            failures.append(f"trend: {k} {how} {a}→{b} breaks the expected trend and is not a listed exception")

    for e in elements:
        for k, lo, hi in (("covalent_radius", 25, 260), ("ionization_energy", 3.5, 25), ("vdw_radius", 120, 360),
                          ("electronegativity", 0.6, 4.0)):
            d = e["props"].get(k)
            if d and not lo <= d["v"] <= hi:
                failures.append(f"range: {e['sym']} {k} = {d['v']} outside {lo}–{hi}")


def property_meta():
    return {
        "covalent_radius": {"label": "Atomic size", "detail": "Covalent radius", "unit": "pm", "default": True,
                            "explain": "Half the distance between two bonded atoms of the element. Bigger means a larger atom."},
        "ionization_energy": {"label": "Ionization energy", "unit": "eV", "explore": True,
                              "explain": "Energy needed to remove one electron from a neutral gas-phase atom."},
        "electronegativity": {"label": "Electronegativity (Pauling)", "unit": "", "explore": True,
                              "explain": "How strongly an atom pulls on shared electrons in a bond."},
        "electronegativity_allen": {"label": "Configuration energy (Allen)", "unit": "eV", "explore": True,
                                    "explain": "Average energy of the valence electrons in the free atom. Allen's "
                                               "electronegativity scale is based on it; it is not on the Pauling scale."},
        "vdw_radius": {"label": "van der Waals radius", "unit": "pm", "explore": True,
                       "explain": "Half the closest distance between two atoms that are touching but not bonded."},
        "melting_point": {"label": "Melting point", "unit": "K", "explore": True,
                          "explain": "Temperature at which the solid melts at 1 atm."},
        "boiling_point": {"label": "Boiling point", "unit": "K", "explore": True,
                          "explain": "Temperature at which the liquid boils at 1 atm."},
        "density": {"label": "Density", "unit": "g/cm³", "explore": True,
                    "explain": "Mass per volume of the element at room temperature (gases at 0 °C, 1 atm)."},
        "atomic_weight": {"label": "Atomic mass", "unit": "", "explore": True,
                          "explain": "Average mass of the element's atoms, relative to 1/12 of carbon-12."},
    }


def write_report(xc, elements):
    OUT.mkdir(exist_ok=True)
    titles = {"config": "Electron configuration (NIST vs PubChem / mendeleev)",
              "atomic_weight": "Atomic weight (CIAAW abridged vs PubChem)",
              "ionization_energy": "Ionization energy (NIST vs PubChem)",
              "covalent_radius": "Covalent radius (mendeleev vs Wikipedia transcription of Cordero 2008)",
              "ionic_radius": "Ionic radius (mendeleev vs pymatgen transcription of Shannon 1976)",
              "electronegativity": "Pauling electronegativity (PubChem vs mendeleev/CRC)",
              "melting_point": "Melting point (PubChem vs mendeleev/CRC)",
              "boiling_point": "Boiling point (PubChem vs mendeleev/CRC)",
              "density": "Density (PubChem vs mendeleev/CRC)",
              "vdw_radius": "van der Waals radius (context only; no independent transcription found)"}
    lines = ["# Cross-check report", "", "Generated by build.py. Every row is a value that differs from, or could not be "
             "confirmed by, a second source. Each needs a human decision, recorded in REVIEW.md.", ""]
    counts = {}
    for e in elements:
        for d in list(e["props"].values()) + [e["config"]] + e["ions"]:
            c = d.get("check", "none")
            counts[c] = counts.get(c, 0) + 1
    lines += ["## Summary", ""] + [f"- {k}: {v}" for k, v in sorted(counts.items())] + [""]
    for k, rows in xc.items():
        lines += [f"## {titles[k]} — {len(rows)} rows", ""]
        if rows:
            lines += ["| Element | Our value | Other source |", "|---|---|---|"] + rows
        lines.append("")
    lines += ["## Trend exceptions found", ""] + [
        f"- {k} {how}: {a} → {b} — {KNOWN_EXCEPTIONS.get((k, a, b), 'NOT LISTED')}"
        for k, a, b, how in getattr(science_checks, "found", [])] + [""]
    lines += ["## Single-source values", "",
              "van der Waals radii (Alvarez 2013) and Allen electronegativities have no independent machine-readable "
              "copy; they are covered by the reviewer spot-check instead.", ""]
    (OUT / "crosscheck.md").write_text("\n".join(lines), encoding="utf-8")

    src = ["# Sources", "", "Generated by build.py from the same entries the site shows.", ""]
    for k, s in SOURCES.items():
        src += [f"## {s['short']} (`{k}`)", "", s["citation"], ""]
        for f in ("doi", "url", "table", "via", "license", "retrieved"):
            if s.get(f):
                src.append(f"- **{f}:** {s[f]}")
        src.append("")
    src += ["## Second sources used only for cross-checking", ""] + [f"- `{k}`: {v}" for k, v in CHECK_SOURCES.items()]
    (HERE / "SOURCES.md").write_text("\n".join(src) + "\n", encoding="utf-8")


if __name__ == "__main__":
    sys.exit(main())
