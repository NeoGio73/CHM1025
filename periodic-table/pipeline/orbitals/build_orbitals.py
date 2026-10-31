"""Build per-atom orbital data for the atom view (Stage 2a: H–Ar) from Bunge et al. 1993.

Run after fetch.py:   python -I orbitals/build_orbitals.py
Writes ../site/data/atoms/<Z>.json and out/orbitals.md. Exits non-zero if any check fails.

Units: calculations in bohr; values for display in pm, using the CODATA 2022 Bohr radius.
"""
import json
import math
import pathlib
import sys

import numpy as np

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import bunge  # noqa: E402

PIPE = HERE.parent
RAW = PIPE / "raw"
OUT = PIPE / "out"
DATA = PIPE.parent / "site" / "data"
BOHR_PM = 52.9177210544  # CODATA 2022 (NIST): a0 = 5.29177210544e-11 m
Z_MAX = 18  # Stage 2a
MAX_ANGULAR_L = 1  # s and p only in Stage 2a

failures, report = [], []


def angular_weight(l, u):
    """|Y|^2 for the real orbital along z (s; p_z), as a function of u = cos(theta). p_x, p_y are rotations of p_z."""
    if l == 0:
        return np.full_like(u, 1 / (4 * math.pi))
    if l == 1:
        return 3 / (4 * math.pi) * u ** 2
    raise ValueError("d and f orbitals come in Stage 2b")


def radial_grid(basis):
    r = np.geomspace(1e-6, 200.0, 40001)
    P = r * r * bunge.radial(basis, r) ** 2
    cum = np.concatenate([[0], np.cumsum(0.5 * (P[1:] + P[:-1]) * np.diff(r))])
    return r, P, cum / cum[-1]


def r_at(r, cum, q):
    return float(np.interp(q, cum, r))


def enclosed_fraction(rr, w, R2, l, c):
    """Fraction of the probability where |psi|^2 > c. The angular part is integrated exactly:
    s: the whole shell counts when R^2/(4 pi) > c.
    p_z: |psi|^2 = R^2 (3/4pi) u^2 > c  <=>  |u| > u0 = sqrt(c / (R^2 3/4pi)); that part of the shell holds 1 - u0^3."""
    if l == 0:
        return float(w[R2 / (4 * math.pi) > c].sum())
    u0 = np.sqrt(np.clip(c / (np.maximum(R2, 1e-300) * 3 / (4 * math.pi)), 0, 1))
    return float((w * (1 - u0 ** 3)).sum())


def c90(basis, l):
    """Density value c such that the region where |psi|^2 > c holds 90% of the probability (bisection).
    Returns c, the radial grid, R^2, and (for s) the radial intervals of that region."""
    r, P, cum = radial_grid(basis)
    r_hi = r_at(r, cum, 1 - 1e-8)
    rr = np.geomspace(1e-6, r_hi, 400001)
    R2 = bunge.radial(basis, rr) ** 2
    w = rr ** 2 * R2 * np.gradient(rr)
    w /= w.sum()
    lo, hi = 1e-14, float(R2.max())
    for _ in range(200):
        mid = math.sqrt(lo * hi)
        if enclosed_fraction(rr, w, R2, l, mid) > 0.9:
            lo = mid
        else:
            hi = mid
    c = math.sqrt(lo * hi)
    shells = []
    if l == 0:  # the 90% region of an s orbital is a set of concentric shells: [inner radius, outer radius]
        inside = R2 / (4 * math.pi) > c
        edges = np.flatnonzero(np.diff(inside.astype(int)))
        bounds = [0.0] if inside[0] else []
        bounds += [float(rr[i]) for i in edges]
        shells = [bounds[i:i + 2] for i in range(0, len(bounds), 2)]
    return c, shells


def nist_occupations():
    els = json.loads((DATA / "elements.json").read_text(encoding="utf-8"))["elements"]
    out = {}
    for e in els:
        if "full" not in e["config"]:  # Z >= 109 (not in NIST)
            continue
        occ = {}
        for part in e["config"]["full"].split():
            occ[part[:2]] = int(part[2:])
        out[e["Z"]] = occ
    return out


def main():
    atoms = {a["Z"]: a for a in bunge.parse(RAW / "bunge1993_rhf_tables.txt")}
    atoms[1] = bunge.hydrogen()
    nist = nist_occupations()
    (DATA / "atoms").mkdir(parents=True, exist_ok=True)
    report.append("# Orbital data checks (Stage 2a)\n")
    report.append("| Z | Atom | Orbital | Norm − 1 | ⟨r⟩ pm | ⟨r⟩ vs file | Nodes | r90 (radial) pm | 90% surface c (bohr⁻³) |")
    report.append("|---|---|---|---|---|---|---|---|---|")

    for Z in range(1, Z_MAX + 1):
        a = atoms[Z]
        if sum(a["occ"].values()) != Z:
            failures.append(f"Z={Z}: occupations sum to {sum(a['occ'].values())}")
        if a["occ"] != nist[Z]:
            failures.append(f"Z={Z}: Bunge configuration {a['occ']} differs from NIST {nist[Z]}")
        orbitals = []
        tot_r = None
        for name, o in a["orbs"].items():
            n, l = int(name[0]), bunge.L_LETTERS.index(name[1])
            if l > MAX_ANGULAR_L:
                failures.append(f"Z={Z} {name}: l={l} not handled in Stage 2a")
                continue
            b = o["basis"]
            nrm = bunge.moment(b, 0)
            if abs(nrm - 1) > 1e-5:
                failures.append(f"Z={Z} {name}: normalization {nrm}")
            checks = []
            for lab, k in (("<R>", 1), ("<1/R>", -1), ("<1/R**2>", -2)):
                if lab in o["exp"]:
                    calc = bunge.moment(b, k) / nrm
                    rel = abs(calc - o["exp"][lab]) / abs(o["exp"][lab])
                    checks.append(rel)
                    if rel > 1e-4:
                        failures.append(f"Z={Z} {name} {lab}: computed {calc:.6f}, file {o['exp'][lab]}")
            r, P, cum = radial_grid(b)
            r_cut = r_at(r, cum, 1 - 1e-5)  # nodes counted inside the radius holding 99.999%
            R = bunge.radial(b, r)
            inside = r < r_cut
            s = np.sign(R[inside])
            idx = np.where(s[1:] != s[:-1])[0]
            nodes = [float(r[i]) for i in idx]
            if len(nodes) != n - l - 1:
                failures.append(f"Z={Z} {name}: {len(nodes)} radial nodes inside 99.999% radius, expected {n - l - 1}")
            c, shells = c90(b, l)
            r_mean = bunge.moment(b, 1)
            orbitals.append({
                "name": name, "n": n, "l": l, "occ": a["occ"][name],
                "basis": [[nb, z, cc] for nb, z, cc in b],
                "r_mean_pm": round(r_mean * BOHR_PM, 2),
                "r_peak_pm": round(float(r[np.argmax(P)]) * BOHR_PM, 2),
                "r90_pm": round(r_at(r, cum, 0.9) * BOHR_PM, 2),
                "r999_pm": round(r_at(r, cum, 0.999) * BOHR_PM, 2),
                "nodes_pm": [round(x * BOHR_PM, 2) for x in nodes],
                "c90": c,
                **({"shells90_pm": [[round(x * BOHR_PM, 3) for x in s] for s in shells]} if l == 0 else {}),
            })
            report.append(f"| {Z} | {a['name']} | {name} | {nrm - 1:.1e} | {r_mean * BOHR_PM:.2f} | "
                          f"{max(checks) if checks else 0:.1e} | {len(nodes)} | {r_at(r, cum, 0.9) * BOHR_PM:.1f} | {c:.4e} |")
        # total electron density: spherical average over each sublevel
        rr = np.geomspace(1e-6, 200.0, 40001)
        D = sum(o["occ"] * rr ** 2 * bunge.radial([tuple(x) for x in o["basis"]], rr) ** 2 for o in orbitals)
        cum = np.concatenate([[0], np.cumsum(0.5 * (D[1:] + D[:-1]) * np.diff(rr))])
        if abs(cum[-1] - Z) > 1e-3:
            failures.append(f"Z={Z}: total density integrates to {cum[-1]:.5f}")
        cum /= cum[-1]
        # Outer (valence) electrons: the electrons in the highest energy level. The sphere holding 90% of them is
        # used for size comparisons; the all-electron 90% sphere is dominated by the core for larger atoms.
        nmax = max(o["n"] for o in orbitals)
        Dv = sum(o["occ"] * rr ** 2 * bunge.radial([tuple(x) for x in o["basis"]], rr) ** 2
                 for o in orbitals if o["n"] == nmax)
        cumv = np.concatenate([[0], np.cumsum(0.5 * (Dv[1:] + Dv[:-1]) * np.diff(rr))])
        nval = sum(o["occ"] for o in orbitals if o["n"] == nmax)
        cumv /= cumv[-1]
        out = {
            "Z": Z, "name": a["name"], "config": a["config"], "term": a["term"],
            "src": "bunge1993" if Z > 1 else "hydrogen_exact", "status": "computed",
            "total_hf_energy_hartree": a["etot"],
            "bohr_pm": BOHR_PM,
            "total": {"r90_pm": round(r_at(rr, cum, 0.9) * BOHR_PM, 2),
                      "r999_pm": round(r_at(rr, cum, 0.999) * BOHR_PM, 2)},
            "valence": {"level": nmax, "electrons": nval, "r90_pm": round(r_at(rr, cumv, 0.9) * BOHR_PM, 2)},
            "orbitals": orbitals,
        }
        (DATA / "atoms" / f"{Z}.json").write_text(json.dumps(out, separators=(",", ":")), encoding="utf-8")

    # Known check: hydrogen 1s, 90% of the probability lies within r = 2.6612 bohr (from 1 - e^-2r (1 + 2r + 2r^2) = 0.9)
    h = json.loads((DATA / "atoms" / "1.json").read_text())
    r90_exact = 2.6612 * BOHR_PM
    if abs(h["orbitals"][0]["r90_pm"] - r90_exact) > 0.2:
        failures.append(f"H 1s r90 {h['orbitals'][0]['r90_pm']} pm vs exact {r90_exact:.2f}")
    report.append(f"\nHydrogen 1s 90% radius: {h['orbitals'][0]['r90_pm']} pm (exact {r90_exact:.2f} pm).")
    # Hydrogen 1s 90% surface: exact c = R(r90)^2 / 4pi = e^(-2 r90) / pi
    c_exact = math.exp(-2 * 2.661160) / math.pi
    c_h = h["orbitals"][0]["c90"]
    if abs(c_h - c_exact) / c_exact > 1e-4:
        failures.append(f"H 1s c90 {c_h} vs exact {c_exact}")
    report.append(f"Hydrogen 1s 90% surface density: {c_h:.6e} bohr⁻³ (exact {c_exact:.6e}).")

    # Outer-electron 90% radius vs the covalent-radius trend (period 2 and 3 across, groups 1, 2, 13–18 down)
    v = {z: json.loads((DATA / "atoms" / f"{z}.json").read_text())["valence"]["r90_pm"] for z in range(1, Z_MAX + 1)}
    report.append("\n## Outer-electron 90% radius (pm)\n")
    report.append("| Z | " + " | ".join(str(z) for z in v) + " |")
    report.append("|---|" + "---|" * len(v))
    report.append("| r90 | " + " | ".join(f"{x:.0f}" for x in v.values()) + " |")
    trend = []
    for a_, b_ in zip(range(3, 10), range(4, 11)):
        if v[b_] >= v[a_]:
            trend.append(f"period 2: {a_}→{b_}")
    for a_, b_ in zip(range(11, 18), range(12, 19)):
        if v[b_] >= v[a_]:
            trend.append(f"period 3: {a_}→{b_}")
    for z in range(3, 11):
        if v[z + 8] <= v[z]:
            trend.append(f"down group: {z}→{z + 8}")
    report.append("\nTrend breaks (across: should shrink; down: should grow): " + (", ".join(trend) or "none"))
    print("valence trend breaks:", trend or "none")

    OUT.mkdir(exist_ok=True)
    (OUT / "orbitals.md").write_text("\n".join(report) + "\n", encoding="utf-8")
    if failures:
        print("FAILED:\n  " + "\n  ".join(failures))
        return 1
    print(f"OK: atoms 1–{Z_MAX} written to site/data/atoms/; see out/orbitals.md")
    return 0


if __name__ == "__main__":
    sys.exit(main())
