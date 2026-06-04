"use strict";

import "maplibre-gl/dist/maplibre-gl.css";
import "./../style/visual.less";

import powerbi from "powerbi-visuals-api";
import maplibregl from "maplibre-gl";
import { parse as parseWkt } from "wellknown";
import { scaleLinear } from "d3-scale";
import { interpolateRgb } from "d3-interpolate";

import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import { VisualSettingsModel } from "./settings";

import DataView = powerbi.DataView;
import IVisual = powerbi.extensibility.visual.IVisual;
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import ISelectionManager = powerbi.extensibility.ISelectionManager;
import ISelectionId = powerbi.visuals.ISelectionId;
import DataViewCategoryColumn = powerbi.DataViewCategoryColumn;
import PrimitiveValue = powerbi.PrimitiveValue;
import FormattingModel = powerbi.visuals.FormattingModel;

interface MapItem {
    index: number;
    id: string;
    selectionId: ISelectionId;
    colorValue: number | null;
    sizeValue: number | null;
    tooltips: powerbi.extensibility.VisualTooltipDataItem[];
    geometry?: GeoJSON.Geometry;   // present => region
    lat?: number;                  // present (with lon) => pin
    lon?: number;
}

export class Visual implements IVisual {
    private host: IVisualHost;
    private target: HTMLElement;
    private mapContainer: HTMLElement;
    private map: maplibregl.Map;
    private mapLoaded = false;
    private selectionManager: ISelectionManager;
    private formattingService: FormattingSettingsService;
    private settings: VisualSettingsModel;

    private items: MapItem[] = [];
    private currentBasemap = "osm";

    constructor(options: VisualConstructorOptions) {
        this.host = options.host;
        this.target = options.element;
        this.selectionManager = this.host.createSelectionManager();
        this.formattingService = new FormattingSettingsService();

        this.target.style.position = "relative";
        this.mapContainer = document.createElement("div");
        this.mapContainer.className = "rpm-map";
        this.target.appendChild(this.mapContainer);

        this.initMap(this.currentBasemap);
    }

    // ---------- Map setup ----------

    private baseStyle(kind: string): maplibregl.StyleSpecification {
        if (kind === "none") {
            return {
                version: 8,
                sources: {},
                layers: [
                    { id: "bg", type: "background", paint: { "background-color": "#f5f5f5" } }
                ]
            } as maplibregl.StyleSpecification;
        }
        return {
            version: 8,
            sources: {
                osm: {
                    type: "raster",
                    tiles: [
                        "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
                        "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
                        "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    ],
                    tileSize: 256,
                    attribution: "© OpenStreetMap contributors"
                }
            },
            layers: [{ id: "osm", type: "raster", source: "osm" }]
        } as maplibregl.StyleSpecification;
    }

    private initMap(kind: string): void {
        this.mapLoaded = false;
        this.map = new maplibregl.Map({
            container: this.mapContainer,
            style: this.baseStyle(kind),
            center: [-81.7, 27.8],   // Florida-ish default; auto-fits to data on first render
            zoom: 5.5,
            attributionControl: {}
        });
        this.map.on("load", () => {
            this.mapLoaded = true;
            this.addLayers();
            this.render();
        });
    }

    private emptyFC(): GeoJSON.FeatureCollection {
        return { type: "FeatureCollection", features: [] };
    }

    private addLayers(): void {
        if (!this.map.getSource("regions")) {
            this.map.addSource("regions", { type: "geojson", data: this.emptyFC() });
            this.map.addLayer({
                id: "regions-fill",
                type: "fill",
                source: "regions",
                paint: {
                    "fill-color": ["coalesce", ["get", "color"], "#cccccc"],
                    "fill-opacity": 0.7
                }
            });
            this.map.addLayer({
                id: "regions-line",
                type: "line",
                source: "regions",
                paint: { "line-color": "#ffffff", "line-width": 1 }
            });
        }
        if (!this.map.getSource("pins")) {
            this.map.addSource("pins", { type: "geojson", data: this.emptyFC() });
            this.map.addLayer({
                id: "pins-circle",
                type: "circle",
                source: "pins",
                paint: {
                    "circle-radius": ["coalesce", ["get", "radius"], 6],
                    "circle-color": "#d7191c",
                    "circle-stroke-color": "#ffffff",
                    "circle-stroke-width": 1,
                    "circle-opacity": 0.9
                }
            });
        }
        this.wireInteractions();
    }

    // ---------- Interactions ----------

    private wireInteractions(): void {
        const hoverLayers = ["regions-fill", "pins-circle"];

        for (const layer of hoverLayers) {
            this.map.on("mousemove", layer, (e) => {
                const f = e.features && e.features[0];
                if (!f) { return; }
                const idx = (f.properties as any).index as number;
                const item = this.items[idx];
                if (!item) { return; }
                this.map.getCanvas().style.cursor = "pointer";
                this.host.tooltipService.show({
                    coordinates: [e.point.x, e.point.y],
                    isTouchEvent: false,
                    dataItems: item.tooltips,
                    identities: [item.selectionId]
                });
            });
            this.map.on("mouseleave", layer, () => {
                this.map.getCanvas().style.cursor = "";
                this.host.tooltipService.hide({ isTouchEvent: false, immediately: false });
            });
            this.map.on("click", layer, (e) => {
                const f = e.features && e.features[0];
                if (!f) { return; }
                const idx = (f.properties as any).index as number;
                const item = this.items[idx];
                if (!item) { return; }
                const multi = e.originalEvent.ctrlKey || e.originalEvent.metaKey;
                this.selectionManager.select(item.selectionId, multi);
                e.originalEvent.stopPropagation();
            });
        }

        // Click on empty map clears the selection.
        this.map.on("click", (e) => {
            const feats = this.map.queryRenderedFeatures(e.point, { layers: hoverLayers });
            if (!feats || feats.length === 0) {
                this.selectionManager.clear();
            }
        });
    }

    // ---------- Data parsing ----------

    private colByRole(cats: DataViewCategoryColumn[], role: string): DataViewCategoryColumn | undefined {
        return cats.find(c => c.source.roles && (c.source.roles as any)[role]);
    }

    private buildItems(dataView: DataView): MapItem[] {
        const out: MapItem[] = [];
        const cat = dataView && dataView.categorical;
        if (!cat || !cat.categories) { return out; }

        const cats = cat.categories;
        const idCol = this.colByRole(cats, "id");
        const wktCol = this.colByRole(cats, "wkt");
        const latCol = this.colByRole(cats, "latitude");
        const lonCol = this.colByRole(cats, "longitude");
        const tipCols = cats.filter(c => c.source.roles && (c.source.roles as any)["tooltips"]);

        // Measures
        let colorVals: PrimitiveValue[] | undefined;
        let sizeVals: PrimitiveValue[] | undefined;
        if (cat.values) {
            for (const v of cat.values) {
                if (v.source.roles && (v.source.roles as any)["colorValue"]) { colorVals = v.values; }
                if (v.source.roles && (v.source.roles as any)["sizeValue"]) { sizeVals = v.values; }
            }
        }

        const rowCount = idCol ? idCol.values.length
            : (wktCol ? wktCol.values.length
                : (latCol ? latCol.values.length : 0));

        for (let i = 0; i < rowCount; i++) {
            const idVal = idCol ? `${idCol.values[i]}` : `${i}`;

            // Selection identity: prefer the ID column so clicks cross-filter on it.
            const idBuilder = this.host.createSelectionIdBuilder();
            if (idCol) { idBuilder.withCategory(idCol, i); }
            else if (wktCol) { idBuilder.withCategory(wktCol, i); }
            const selectionId = idBuilder.createSelectionId();

            const tooltips: powerbi.extensibility.VisualTooltipDataItem[] = [];
            if (idCol) {
                tooltips.push({ displayName: idCol.source.displayName, value: idVal });
            }
            for (const t of tipCols) {
                tooltips.push({ displayName: t.source.displayName, value: `${t.values[i] ?? ""}` });
            }

            const colorValue = colorVals ? this.toNum(colorVals[i]) : null;
            const sizeValue = sizeVals ? this.toNum(sizeVals[i]) : null;
            if (colorVals) {
                tooltips.push({
                    displayName: this.measureName(cat, "colorValue"),
                    value: colorValue == null ? "" : colorValue.toLocaleString()
                });
            }

            const item: MapItem = { index: i, id: idVal, selectionId, colorValue, sizeValue, tooltips };

            const wktStr = wktCol ? wktCol.values[i] : null;
            if (wktStr) {
                const geom = parseWkt(`${wktStr}`) as GeoJSON.Geometry | null;
                if (geom) { item.geometry = geom; }
            }
            if (!item.geometry && latCol && lonCol) {
                const lat = this.toNum(latCol.values[i]);
                const lon = this.toNum(lonCol.values[i]);
                if (lat != null && lon != null) { item.lat = lat; item.lon = lon; }
            }

            // Only keep rows that resolve to a shape or a point.
            if (item.geometry || (item.lat != null && item.lon != null)) {
                out.push(item);
            }
        }
        return out;
    }

    private measureName(cat: powerbi.DataViewCategorical, role: string): string {
        if (cat.values) {
            for (const v of cat.values) {
                if (v.source.roles && (v.source.roles as any)[role]) { return v.source.displayName; }
            }
        }
        return "Value";
    }

    private toNum(v: PrimitiveValue): number | null {
        if (v === null || v === undefined || v === "") { return null; }
        const n = Number(v);
        return isNaN(n) ? null : n;
    }

    // ---------- Render ----------

    public update(options: VisualUpdateOptions): void {
        const dataView = options.dataViews && options.dataViews[0];
        this.settings = this.formattingService.populateFormattingSettingsModel(VisualSettingsModel, dataView);

        // Basemap switch (recreates the map only when changed).
        const desired = this.settings.basemap.style.value.value as string;
        if (desired !== this.currentBasemap) {
            this.currentBasemap = desired;
            this.map.remove();
            this.initMap(desired);
        }

        this.items = dataView ? this.buildItems(dataView) : [];
        if (this.mapLoaded) { this.render(); }
    }

    private render(): void {
        if (!this.mapLoaded) { return; }

        const c = this.settings.choropleth;
        const p = this.settings.pins;

        // ----- regions -----
        const regions = this.items.filter(it => !!it.geometry);
        const colorNums = regions.map(r => r.colorValue).filter(v => v != null) as number[];
        const min = colorNums.length ? Math.min(...colorNums) : 0;
        const max = colorNums.length ? Math.max(...colorNums) : 1;
        const colorScale = scaleLinear<string>()
            .domain(min === max ? [min, min + 1] : [min, max])
            .range([c.lowColor.value.value, c.highColor.value.value])
            .interpolate(interpolateRgb);

        const regionFeatures: GeoJSON.Feature[] = regions.map(r => ({
            type: "Feature",
            geometry: r.geometry as GeoJSON.Geometry,
            properties: {
                index: r.index,
                color: r.colorValue == null ? "#cccccc" : colorScale(r.colorValue)
            }
        }));

        // ----- pins -----
        const pins = this.items.filter(it => it.lat != null && it.lon != null);
        const sizeNums = pins.map(pt => pt.sizeValue).filter(v => v != null) as number[];
        const sMin = sizeNums.length ? Math.min(...sizeNums) : 0;
        const sMax = sizeNums.length ? Math.max(...sizeNums) : 1;
        const base = p.radius.value;
        const radiusScale = scaleLinear()
            .domain(sMin === sMax ? [sMin, sMin + 1] : [sMin, sMax])
            .range([base, base * 3]);

        const pinFeatures: GeoJSON.Feature[] = pins.map(pt => ({
            type: "Feature",
            geometry: { type: "Point", coordinates: [pt.lon as number, pt.lat as number] },
            properties: {
                index: pt.index,
                radius: pt.sizeValue == null ? base : radiusScale(pt.sizeValue)
            }
        }));

        (this.map.getSource("regions") as maplibregl.GeoJSONSource)
            ?.setData({ type: "FeatureCollection", features: regionFeatures });
        (this.map.getSource("pins") as maplibregl.GeoJSONSource)
            ?.setData({ type: "FeatureCollection", features: pinFeatures });

        // ----- paint from settings -----
        if (this.map.getLayer("regions-fill")) {
            this.map.setPaintProperty("regions-fill", "fill-opacity", c.fillOpacity.value / 100);
        }
        if (this.map.getLayer("regions-line")) {
            this.map.setPaintProperty("regions-line", "line-color", c.strokeColor.value.value);
            this.map.setPaintProperty("regions-line", "line-width", c.strokeWidth.value);
        }
        if (this.map.getLayer("pins-circle")) {
            this.map.setPaintProperty("pins-circle", "circle-color", p.color.value.value);
            this.map.setPaintProperty("pins-circle", "circle-stroke-color", p.strokeColor.value.value);
            this.map.setPaintProperty("pins-circle", "circle-stroke-width", p.strokeWidth.value);
            this.map.setPaintProperty("pins-circle", "circle-opacity", p.opacity.value / 100);
        }

        this.fitToData(regionFeatures, pinFeatures);
    }

    private fitToData(regions: GeoJSON.Feature[], pins: GeoJSON.Feature[]): void {
        const b = new maplibregl.LngLatBounds();
        let any = false;
        const extend = (coords: any) => {
            if (typeof coords[0] === "number") { b.extend(coords as [number, number]); any = true; }
            else { for (const c of coords) { extend(c); } }
        };
        for (const f of regions) { if (f.geometry && (f.geometry as any).coordinates) { extend((f.geometry as any).coordinates); } }
        for (const f of pins) { if (f.geometry && (f.geometry as any).coordinates) { extend((f.geometry as any).coordinates); } }
        if (any) {
            try { this.map.fitBounds(b, { padding: 24, maxZoom: 11, duration: 0 }); } catch { /* ignore */ }
        }
    }

    public getFormattingModel(): FormattingModel {
        return this.formattingService.buildFormattingModel(this.settings);
    }
}
