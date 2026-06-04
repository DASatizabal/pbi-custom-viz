# Region & Pin Map (Power BI custom visual)

A single Power BI visual that renders **choropleth regions** (filled polygons colored by a
measure) **and** an **interactive pin layer** (points from lat/lon) on the same MapLibre map.
This is the thing Azure Maps can't do: dynamic measure-driven fill *and* granular points
together, with tooltips and click-to-cross-filter.

## How it decides polygons vs pins
The visual reads one rowset. For each row:
- if the **Shape (WKT)** field is filled, it draws a **region polygon**;
- otherwise, if **Latitude** + **Longitude** are filled, it drops a **pin**.

So you feed it one table that is the union of your county rows and your office rows.

## Prerequisites
- Node.js LTS (18 or 20).
- Power BI Visuals tools: `npm i -g powerbi-visuals-tools`
- A one-time dev cert for live preview: `pbiviz --install-cert`

## Build
```bash
cd region-pin-map
npm install
pbiviz package        # produces dist/regionPinMap.<version>.pbiviz
```
For live development against Power BI Desktop/Service:
```bash
pbiviz start          # then use the "Developer Visual" in the Visualizations pane
```

## Import into Power BI
Visualizations pane -> "..." -> **Import a visual from a file** -> pick the `.pbiviz` from `dist/`.

## Field wells
- **ID / Category**  -> FIPS for counties, PCP ID for offices (drives cross-filter).
- **Shape (WKT)**    -> the `wkt` column from `FL_Counties_WKT.csv` (counties only).
- **Latitude / Longitude** -> PRAD_LAT / PRAD_LON (offices only; set both to *Don't summarize*).
- **Color value**    -> measure for the region gradient (e.g. member count).
- **Size value**     -> optional measure to scale pin radius.
- **Tooltips**       -> county name, region, PCP name, etc.

## Data model (the union)
1. Load `FL_Counties_WKT.csv` as table `Regions` (columns: id, name, region, wkt).
2. From your member data, build an `Offices` query: id (PCP id), name, lat, lon.
3. Append them into one query `MapItems`. County rows leave lat/lon null; office rows
   leave wkt null. Add a `type` column ("region"/"pin") if you want to slice them.
4. Point the visual's field wells at `MapItems` columns + your measures.

`scripts/geojson_to_wkt.py` regenerates the WKT CSV from a GeoJSON if your boundaries change.

## Basemap / tiles
Defaults to OpenStreetMap raster tiles, declared under the `WebAccess` privilege in
`capabilities.json`. If your tenant blocks outbound tile calls, set Basemap = "None" in the
format pane (regions render on a plain background) or swap the tile URL for an approved source.

## Enterprise deployment note
Importing a `.pbiviz` and outbound tile access are both governed by your Power BI tenant
admin. For a 100-person rollout, the clean path is to hand the packaged visual to your BI
admin to publish via **Organizational visuals**, and to confirm the tile domain is allowed.

## Notes / next steps
- Strict TypeScript is off to keep the scaffold forgiving; tighten `tsconfig` once it builds.
- Selection currently filters other visuals on click but does not dim unselected shapes.
  Add opacity-on-selection in `render()` using `selectionManager.getSelectionIds()` if wanted.
- Package versions in `package.json` are recent-known-good; `npm install` may resolve newer
  patches. If a PBI util API shifts, the formatting model (`settings.ts`) is the likely spot.
