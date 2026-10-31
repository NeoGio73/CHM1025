# Review decisions

Every disagreement in `out/crosscheck.md` and every model choice gets a decision here. Items marked **Instructor** need your call.

## Model choices

| Item | Decision | Why |
|---|---|---|
| Default "atomic size" | Cordero et al. 2008 covalent radii | One consistent set for Z = 1–96, noble gases included. **Instructor:** compare with Timberlake's atomic-size figure. |
| Carbon covalent radius | 76 pm (sp³, single bond) | Cordero lists sp³ 76, sp² 73, sp 69 (per two transcriptions). Single-bond value matches the other elements. mendeleev stored 73 (sp²). |
| Mn, Fe, Co covalent radius | Low-spin values (139, 132, 126 pm); high-spin values in the note | Cordero lists both. mendeleev stored the average, which is not a published value. **Instructor:** low-spin or high-spin. |
| Cordero numbers in parentheses | Shown as "spread (standard deviation)", not "± uncertainty" | They are the spread of the bond-length data. Values with no spread (He, Ne, At, Rn, Fr, Pm, Ac, Pa…) are tagged "estimate". |
| Atomic weight shown | CIAAW 2024 abridged value (e.g., C 12.011) | Matches textbook usage. Full standard value/interval kept in the data. |
| Table layout | La and Ac in group 3; Ce–Lu and Th–Lr in the f rows | **Instructor:** confirm this matches Timberlake's table. |
| Ionic radii | Shannon "effective ionic radius" (IR), not "crystal radius"; all spin states | IR is the set textbooks use (based on O²⁻ = 140 pm). The atom-vs-ion picture uses high spin where there is a choice. Radii Shannon marks estimated/calculated are tagged "estimate". Zero or negative radii (H⁺, C⁴⁺ CN 3, N⁵⁺ CN 3) are not shown. |
| Allen values | Labeled "Configuration energy (Allen), eV" | They are configuration energies, not Pauling-scale electronegativities. |

## Disagreements between sources

| Property | Rows | Decision |
|---|---|---|
| Electron configuration | Lr (PubChem 6d¹ vs NIST 7p¹) | Keep NIST, tagged "calculated": no Lr energy levels have been measured; the 2015 ionization energy agrees with the calculations predicting 7p. |
| Electron configuration | Ds, Rg (mendeleev 7s¹) | Keep NIST; both are predicted and drawn as predicted. |
| Ionization energy | 24 elements, PubChem differs from NIST | Keep NIST ASD (evaluated, newer). PubChem's value is shown as "another source lists…". |
| Pauling electronegativity | W, Pb, Au, Pt, Hg, Tl, Bi, U, Lu, Tc, Np, Pu differ between PubChem and CRC (via mendeleev) | PubChem shown, CRC value shown alongside. Several PubChem values (e.g., Pb 2.33, W 2.36) are for higher oxidation states. **Instructor:** if Timberlake's electronegativity figure uses the CRC values, switch. Not a course topic (Explore more only). |
| Pauling electronegativity | Am–Lr = 1.3, no second source | Shown as "predicted" (estimate). |
| Melting point | He, C, As | Not shown: none of them melts at 1 atm. Labeled gap with an explanation. |
| Melting / boiling point, density | Bk, Ba, Am, Cs, C (graphite) differ by 2–15% | Keep PubChem, show the CRC value alongside. Explore more only. |
| Density of gases | PubChem at 0 °C, CRC at 25 °C | Not a disagreement; compared after converting to the same temperature. |
| Ionic radius | Ce⁴⁺, CN 10: mendeleev 97 pm vs pymatgen 107 pm | Reviewer checked Shannon Table 1 (p. 752): 107 pm. Fixed in `ION_OVERRIDE`. |
| van der Waals radius | Ar, Kr, Xe, Rn don't match Alvarez 2013 Table 1 | They come from Vogt & Alvarez 2014; source relabeled. Not yet checked against that paper. |
| van der Waals radius | He, Ne, Ac, Pa, Cm, Bk, Cf, Es | In brackets in Alvarez Table 1 (rough estimates); tagged "estimate". |

## Independent spot-check (2026-10-30)

30 values chosen at random (seed 1025) and looked up in the original sources: 25 match, 0 mismatch, 5 could not be accessed (Cordero 2008 and Mann/Allen 2000 are paywalled). All 103 NIST ionization energies and ground terms (H–Lr) were also compared line by line: all identical. Shannon (Table 1) and Alvarez (Table 1) table numbers confirmed.

## Still open

- Cordero 2008, Vogt & Alvarez 2014 and Mann/Allen 2000 not yet checked against the papers themselves (two independent transcriptions agree for Cordero). Someone with library access should check a sample.
- PubChem element data license: U.S. Government work per the NLM copyright page; confirm before launch.
- Timberlake comparison sheet: needs the textbook's atomic-size figure.
