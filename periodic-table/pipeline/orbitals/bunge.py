"""Read Bunge, Barrientos & Bunge (1993) Roothaan-Hartree-Fock orbitals from the authors' RHF.TABLES file
and evaluate them. Atomic units throughout (lengths in bohr).

Each radial function is R(r) = sum_k c_k N_k r^(n_k - 1) exp(-zeta_k r), with N_k = (2 zeta)^(n + 1/2) / sqrt((2n)!).
"""
import math
import re

import numpy as np

L_LETTERS = "spdf"
CORES = {"He": "1s(2)", "Ne": "1s(2)2s(2)2p(6)", "Ar": "1s(2)2s(2)2p(6)3s(2)3p(6)",
         "Kr": "1s(2)2s(2)2p(6)3s(2)3p(6)3d(10)4s(2)4p(6)"}
NUM = re.compile(r"-?\d+\.\d+")
EXP_LABELS = ("ORB.ENERGY", "<R>", "<R**2>", "<1/R>", "<1/R**2>", "<1/R**3>")


def parse(path):
    """Return a list of atoms: {name, Z, config, term, occ{'2p': 2}, etot, rho0_file, orbs{'2p': {basis, exp}}}."""
    text = open(path, encoding="utf-8", errors="replace").read()
    # The heading stays on one line; Mn has no term printed.
    heads = list(re.finditer(r"^([A-Z]+), Z=(\d+)[ \t]+(\S+)[ \t]*(\S*)", text, re.M))
    atoms = []
    for i, h in enumerate(heads):
        block = text[h.end(): heads[i + 1].start() if i + 1 < len(heads) else len(text)]
        conf = h.group(3)
        full = conf
        for k, v in CORES.items():
            full = full.replace(f"[{k}]", v)
        occ = {m.group(1): int(m.group(2)) for m in re.finditer(r"(\d[spdf])\((\d+)\)", full)}
        lines = block.splitlines()
        e_line = next(j for j, l in enumerate(lines) if l.startswith("TOTAL ENERGY"))
        etot = float(NUM.findall(lines[e_line + 1])[0])
        rho0 = float(re.search(r"RHOat0 =\s*([\d.]+)", block).group(1))
        orbs, names = {}, []
        for ln in lines:
            toks = ln.split()
            if toks and all(re.fullmatch(r"\d[spdf]", t) for t in toks):
                names = toks
                for t in toks:
                    orbs[t] = {"basis": [], "exp": {}}
                continue
            if not names or not toks:
                continue
            if toks[0] in EXP_LABELS:
                label, pairs = None, []
                for t in toks:
                    if NUM.fullmatch(t):
                        pairs.append((label, float(t)))
                    else:
                        label = t
                if toks[0] == "<1/R**3>":  # only l > 0 orbitals have this line
                    targets = [n for n in names if n[1] != "s"][-len(pairs):]
                else:
                    targets = names[:len(pairs)]
                for n, (lab, v) in zip(targets, pairs):
                    orbs[n]["exp"][lab] = v
                continue
            if re.fullmatch(r"\d[SPDF]", toks[0]):
                groups = []
                for t in toks:
                    if re.fullmatch(r"\d[SPDF]", t):
                        groups.append([t])
                    else:
                        groups[-1].append(float(t))
                for g in groups:
                    nb, lsym = int(g[0][0]), g[0][1].lower()
                    targets = [n for n in names if n[1] == lsym]
                    for n, c in zip(targets, g[2:]):
                        orbs[n]["basis"].append((nb, g[1], c))
        atoms.append({"name": h.group(1).title(), "Z": int(h.group(2)), "config": conf, "term": h.group(4) or None,
                      "occ": occ, "etot": etot, "rho0_file": rho0, "orbs": orbs})
    return atoms


def hydrogen():
    """Exact nonrelativistic hydrogen 1s: R(r) = 2 exp(-r) (bohr units), written as one normalized STO (n=1, zeta=1)."""
    return {"name": "Hydrogen", "Z": 1, "config": "1s(1)", "term": "2S", "occ": {"1s": 1}, "etot": -0.5,
            "rho0_file": None, "orbs": {"1s": {"basis": [(1, 1.0, 1.0)], "exp": {"<R>": 1.5, "<R**2>": 3.0,
                                                                                "<1/R>": 1.0, "<1/R**2>": 2.0}}}}


def norm_sto(n, z):
    return (2 * z) ** (n + 0.5) / math.sqrt(math.factorial(2 * n))


def moment(basis, k, basis2=None):
    """Integral of R1 R2 r^(k+2) dr from 0 to infinity (exact for STOs)."""
    s = 0.0
    for na, za, ca in basis:
        for nb, zb, cb in (basis2 or basis):
            p = na + nb + k
            s += ca * cb * norm_sto(na, za) * norm_sto(nb, zb) * math.factorial(p) / (za + zb) ** (p + 1)
    return s


def radial(basis, r):
    r = np.asarray(r, dtype=float)
    return sum(c * norm_sto(n, z) * r ** (n - 1) * np.exp(-z * r) for n, z, c in basis)
