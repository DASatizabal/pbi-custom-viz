#!/usr/bin/env python3
"""
Convert a GeoJSON of polygons into a CSV table with a WKT column,
ready to load into Power BI as the "regions" rows for the Region & Pin Map visual.

Usage:
    python geojson_to_wkt.py input.geojson output.csv

Output columns: id, name, region, wkt
  - id   -> use as the visual's "ID / Category"
  - wkt  -> use as the visual's "Shape (WKT)"
No external deps; emits WKT POLYGON / MULTIPOLYGON by hand.
"""
import json
import sys


def ring_to_wkt(ring):
    return "(" + ", ".join(f"{x} {y}" for x, y, *_ in ring) + ")"


def polygon_to_wkt(coords):
    return "POLYGON (" + ", ".join(ring_to_wkt(r) for r in coords) + ")"


def multipolygon_to_wkt(coords):
    polys = []
    for poly in coords:
        polys.append("(" + ", ".join(ring_to_wkt(r) for r in poly) + ")")
    return "MULTIPOLYGON (" + ", ".join(polys) + ")"


def geom_to_wkt(geom):
    t = geom.get("type")
    if t == "Polygon":
        return polygon_to_wkt(geom["coordinates"])
    if t == "MultiPolygon":
        return multipolygon_to_wkt(geom["coordinates"])
    raise ValueError(f"Unsupported geometry type: {t}")


def main(in_path, out_path):
    with open(in_path) as f:
        gj = json.load(f)

    import csv
    rows = []
    for feat in gj["features"]:
        props = feat.get("properties", {})
        wkt = geom_to_wkt(feat["geometry"])
        rows.append({
            "id": props.get("FIPS", ""),
            "name": props.get("CountyName", ""),
            "region": props.get("AHCA_Region", ""),
            "wkt": wkt,
        })

    with open(out_path, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["id", "name", "region", "wkt"])
        w.writeheader()
        w.writerows(rows)

    print(f"Wrote {len(rows)} region rows to {out_path}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(1)
    main(sys.argv[1], sys.argv[2])
