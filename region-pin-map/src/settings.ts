"use strict";

import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";

import Card = formattingSettings.SimpleCard;
import Model = formattingSettings.Model;
import ColorPicker = formattingSettings.ColorPicker;
import NumUpDown = formattingSettings.NumUpDown;
import ItemDropdown = formattingSettings.ItemDropdown;

// Basemap choices. Add more (e.g. a hosted vector style) as needed.
const basemapItems = [
    { value: "osm", displayName: "Streets (OpenStreetMap)" },
    { value: "none", displayName: "None (regions only)" }
];

class ChoroplethCard extends Card {
    lowColor = new ColorPicker({
        name: "lowColor",
        displayName: "Low color",
        value: { value: "#deebf7" }
    });
    highColor = new ColorPicker({
        name: "highColor",
        displayName: "High color",
        value: { value: "#08306b" }
    });
    fillOpacity = new NumUpDown({
        name: "fillOpacity",
        displayName: "Fill opacity (%)",
        value: 70
    });
    strokeColor = new ColorPicker({
        name: "strokeColor",
        displayName: "Border color",
        value: { value: "#ffffff" }
    });
    strokeWidth = new NumUpDown({
        name: "strokeWidth",
        displayName: "Border width",
        value: 1
    });

    name: string = "choropleth";
    displayName: string = "Choropleth (regions)";
    slices = [this.lowColor, this.highColor, this.fillOpacity, this.strokeColor, this.strokeWidth];
}

class PinsCard extends Card {
    color = new ColorPicker({
        name: "color",
        displayName: "Pin color",
        value: { value: "#d7191c" }
    });
    radius = new NumUpDown({
        name: "radius",
        displayName: "Base radius",
        value: 6
    });
    strokeColor = new ColorPicker({
        name: "strokeColor",
        displayName: "Border color",
        value: { value: "#ffffff" }
    });
    strokeWidth = new NumUpDown({
        name: "strokeWidth",
        displayName: "Border width",
        value: 1
    });
    opacity = new NumUpDown({
        name: "opacity",
        displayName: "Opacity (%)",
        value: 90
    });

    name: string = "pins";
    displayName: string = "Pins";
    slices = [this.color, this.radius, this.strokeColor, this.strokeWidth, this.opacity];
}

class BasemapCard extends Card {
    style = new ItemDropdown({
        name: "style",
        displayName: "Basemap",
        items: basemapItems,
        value: basemapItems[0]
    });

    name: string = "basemap";
    displayName: string = "Basemap";
    slices = [this.style];
}

export class VisualSettingsModel extends Model {
    choropleth = new ChoroplethCard();
    pins = new PinsCard();
    basemap = new BasemapCard();
    cards = [this.choropleth, this.pins, this.basemap];
}
