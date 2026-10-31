"""Read Koga, Kanayama, Watanabe & Thakkar (1999) Hartree-Fock orbitals (.slater / .cat / .an files) and
compute checks. Same conventions as bunge.py: R(r) = sum c N r^(n-1) exp(-zeta r), atomic units.
"""
import math
import re

import bunge

L_LETTERS = "spdf"


def parse(path):
    lines = open(path, encoding="utf-8", errors="replace").read().splitlines()
    head = next(l for l in lines if l.strip())
    m = re.match(r"\s*([A-Z]+)([+-]?)\s+(\S+),\s*(\S+)", head)
    name, sign, conf, term = m.group(1).title(), m.group(2), m.group(3), m.group(4)
    # shell shorthand used in the files: K(2) = 1s2, L(8) = 2s2 2p6, M(18) = 3s2 3p6 3d10
    full = conf.replace("K(2)", "1S(2)").replace("L(8)", "2S(2)2P(6)").replace("M(18)", "3S(2)3P(6)3D(10)")
    cores = {"HE": "1S(2)", "NE": "1S(2)2S(2)2P(6)", "AR": "1S(2)2S(2)2P(6)3S(2)3P(6)"}
    cores["KR"] = cores["AR"] + "3D(10)4S(2)4P(6)"
    cores["XE"] = cores["KR"] + "4D(10)5S(2)5P(6)"
    cores["RN"] = cores["XE"] + "4F(14)5D(10)6S(2)6P(6)"
    full = re.sub(r"\[([A-Z]+)\]", lambda m: cores[m.group(1)], full)
    occ = {f"{a}{b.lower()}": int(c) for a, b, c in re.findall(r"(\d)([SPDF])\((\d+)\)", full)}
    vals = {}
    for l in lines:
        for k, v in re.findall(r"\b(E|T|V)\s*=\s*(-?\d+\.\d+)", l):
            vals.setdefault(k, float(v))
    orbs = {}
    i = 0
    while i < len(lines):
        t = lines[i].split()
        # symmetry block header: "S   1S  2S"  (letter, then orbital names)
        if t and t[0] in ("S", "P", "D", "F") and len(t) > 1 and all(re.fullmatch(r"\d[SPDF]", x) for x in t[1:]):
            names = [x.lower() for x in t[1:]]
            for n in names:
                orbs[n] = {"basis": [], "energy": None, "cusp": None}
            i += 1
            while i < len(lines):
                t = lines[i].split()
                if not t:
                    break
                if t[0].startswith("BASIS"):
                    for n, v in zip(names, t[1:]):
                        orbs[n]["energy"] = float(v)
                elif t[0] == "CUSP":
                    for n, v in zip(names, t[1:]):
                        orbs[n]["cusp"] = float(v)
                elif re.fullmatch(r"\d[SPDF]", t[0]):
                    nb, zeta = int(t[0][0]), float(t[1])
                    for n, c in zip(names, t[2:]):
                        orbs[n]["basis"].append((nb, zeta, float(c)))
                else:
                    break
                i += 1
            continue
        i += 1
    charge = {"+": 1, "-": -1, "": 0}[sign]
    return {"name": name, "charge": charge, "config": conf, "term": term, "occ": occ,
            "E": vals.get("E"), "T": vals.get("T"), "V": vals.get("V"), "orbs": orbs}


def kinetic(basis, l):
    """<R| -1/2 (d2/dr2 + 2/r d/dr - l(l+1)/r^2) |R> with r^2 dr, exact for STOs.
    For f = r^(n-1) e^(-z r):  -1/2 nabla^2 f = -1/2 [ (n(n-1) - l(l+1)) / r^2 - 2 z n / r + z^2 ] f."""
    s = 0.0
    for na, za, ca in basis:
        for nb, zb, cb in basis:
            A, B, C = nb * (nb - 1) - l * (l + 1), -2 * zb * nb, zb ** 2
            z = za + zb
            k = na + nb  # power of r in r^(na-1) r^(nb-1) r^2
            integ = (A * math.factorial(k - 2) / z ** (k - 1) + B * math.factorial(k - 1) / z ** k
                     + C * math.factorial(k) / z ** (k + 1))
            s += ca * cb * bunge.norm_sto(na, za) * bunge.norm_sto(nb, zb) * (-0.5) * integ
    return s
