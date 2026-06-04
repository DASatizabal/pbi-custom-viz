# Region & Pin Map: Dead-Simple Setup Guide

This walks you from a fresh machine to a working map. Do the parts in order.
You do not need to know coding or the command line. Just copy what it says to type.

Time: about 30 to 45 minutes the first time.

What you need before starting:
- A Windows PC (Power BI Desktop only runs on Windows).
- Power BI Desktop installed.
- The two files I gave you: `region-pin-map.zip` and `FL_Counties_WKT.csv`.

---

## PART 1: Install the build tools (one time only)

Think of this like installing a printer driver before you can print. You do it once.

### 1.1 Install Node.js
1. Go to **https://nodejs.org**.
2. Click the big button that says **LTS** (the recommended version).
3. Run the downloaded file. Click **Next** through every screen, accept the license, keep all defaults, click **Install**, then **Finish**.

### 1.2 Open a command window (PowerShell)
1. Press the **Windows key**, type **powershell**, press **Enter**. A dark blue window opens. This is where you type commands.
2. Test that Node installed. Type this and press Enter:
   ```
   node -v
   ```
   You should see something like `v20.11.1`. A version number means success. If it says "not recognized," close the window, restart your PC, and try again.

### 1.3 Install the Power BI visual tool
1. In the same PowerShell window, type this and press Enter:
   ```
   npm install -g powerbi-visuals-tools
   ```
2. Wait about a minute. Lots of text scrolls. When you get your prompt back (a blinking cursor), it is done.
3. Test it. Type:
   ```
   pbiviz --version
   ```
   A version number (like `5.6.0`) means success.

(You can skip the dev certificate. It is only needed for live preview, which we are not using.)

---

## PART 2: Build the visual file

This turns the project folder into a single `.pbiviz` file that Power BI can import.
Think of it as zipping a bunch of ingredients into one ready-to-use package.

### 2.1 Unzip the project
1. Find `region-pin-map.zip`.
2. Right-click it, choose **Extract All**, and extract it somewhere easy to find (your Documents or your projects folder).
3. Open the extracted **region-pin-map** folder. You should see files like `package.json`, `pbiviz.json`, and folders `src` and `assets`.

### 2.2 Open PowerShell INSIDE that folder
This is the trick that saves headaches.
1. In File Explorer, open the **region-pin-map** folder (the one with `package.json` in it).
2. Click once in the **address bar** at the top (where the folder path is shown).
3. Type **powershell** and press **Enter**.
4. A blue window opens, already pointing at your project folder. (You can confirm: the text before the cursor should end in `...\region-pin-map>`.)

### 2.3 Install the project's parts
1. In that window, type and press Enter:
   ```
   npm install
   ```
2. Wait 1 to 3 minutes. A folder called `node_modules` appears. Yellow "warning" text is fine. Red "ERR" text is a problem (see Troubleshooting).

### 2.4 Build the package
1. Type and press Enter:
   ```
   pbiviz package
   ```
2. When it finishes you will see a message about the visual package being created, and a new folder called **dist** appears inside your project.
3. Open **dist**. Inside is your file: **regionPinMap.1.0.0.pbiviz**. That is the visual.

---

## PART 3: Import the visual into Power BI

### 3.1 Turn on custom visuals (if needed)
1. Open Power BI Desktop.
2. Go to **File > Options and settings > Options**.
3. In the left list click **Security**.
4. Make sure custom visuals are allowed. If you see a warning that your organization blocks visuals from files, stop and read the Troubleshooting note at the bottom. You may need your IT/BI admin.

### 3.2 Import it
1. In the **Visualizations** pane (the icons on the right), click the **three dots (...)** at the bottom of the icons.
2. Choose **Import a visual from a file**.
3. The first time, a caution box appears about custom visuals. Click **Import**.
4. Browse to your **dist** folder, pick **regionPinMap.1.0.0.pbiviz**, click **Open**.
5. A new icon appears in the Visualizations pane: a small blue square with a red dot. That is your map.

---

## PART 4: Smoke test (prove it works before touching real data)

This is the most important checkpoint. We load only the county file and a fake number,
just to confirm the visual builds and your tenant allows it. Five minutes now saves hours later.

### 4.1 Load the county file
1. **Home > Get data > Text/CSV**.
2. Pick **FL_Counties_WKT.csv**. Click **Open**, then **Load**.
3. On the right you now have a table named **FL_Counties_WKT** with columns: id, name, region, wkt.

### 4.2 Add a fake "color" number
1. **Home > Transform data** (this opens the Power Query Editor, a separate window).
2. With FL_Counties_WKT selected on the left, go to **Add Column > Index Column > From 1**. This adds a column of numbers 1 to 67. We will use it as a stand-in for member count.
3. Click **Home > Close & Apply**. Wait for it to finish.

### 4.3 Draw the map
1. Click an empty spot on your report canvas.
2. Click the **Region & Pin Map** icon (blue square, red dot) in the Visualizations pane. An empty box appears.
3. Drag fields into the wells (the boxes that appeared under the icon):
   - drag **id** into **ID / Category**
   - drag **wkt** into **Shape (WKT)**
   - drag **Index** into **Color value**
4. Florida should appear, with counties shaded light to dark. If you see that, **everything works**. Celebrate, then continue.

If Florida does NOT appear, see Troubleshooting.

---

## PART 5: Wire up your real data

Now we replace the fake number with real member counts and add the PCP pins.
This part depends on your own data, so the safest move is described at the end:
**send me your member table details and I will write the exact code for you to paste.**

Here is the plan so you understand the shape of it.

You will end up with one table, call it **MapItems**, that has one row per thing on the map:
- one row per **county** (has id, name, wkt; lat/lon blank)
- one row per **PCP office** (has id, name, lat, lon; wkt blank)

And two measures:
- **MembersInCounty** colors the counties.
- **MembersAtOffice** sizes the pins.

### 5.1 Make sure your member data is loaded
If your member table (with PRAD_LAT, PRAD_LON, the member's county, and the assigned PCP)
is already in this report, good. If not: **Home > Get data**, pick your source (SQL Server,
Snowflake, SharePoint, Excel, etc.), and load it.

### 5.2 Build the Offices table (one row per PCP)
In Power Query (Transform data), you will reference your member table and group it down to
one row per PCP, keeping the PCP name, PRAD_LAT, and PRAD_LON, plus a count of members.

### 5.3 Build MapItems (the union)
Shape the county file to columns id, name, wkt. Shape Offices to columns id, name, lat, lon.
Make the column names match, then **Home > Append Queries** to stack them into MapItems.

Important: every id must be unique across both. County ids are FIPS like 12095. If your PCP
ids could ever equal a FIPS number, prefix them (for example "P-" on offices and "C-" on
counties) and apply the same prefix in your member columns so the links still match.

### 5.4 Create the two links (Model view)
1. Click the **Model** view icon on the far left (looks like connected boxes).
2. Drag from your member table's **county field** onto **MapItems[id]**. This makes the first link.
3. Drag from your member table's **assigned PCP field** onto **MapItems[id]**. Power BI will make this second link **inactive** (a dotted line). That is expected.

### 5.5 Create the two measures
1. Right-click MapItems > **New measure**. Paste:
   ```
   MembersInCounty = COUNTROWS('YourMemberTable')
   ```
2. New measure again. Paste (this one uses the dotted link):
   ```
   MembersAtOffice =
   CALCULATE(
       COUNTROWS('YourMemberTable'),
       USERELATIONSHIP('YourMemberTable'[AssignedPCPField], MapItems[id])
   )
   ```
   Replace `'YourMemberTable'` and the field names with your real names.

### 5.6 Map the final field wells
On the Region & Pin Map visual:
- **ID / Category** = MapItems[id]
- **Shape (WKT)** = MapItems[wkt]
- **Latitude** = MapItems[lat]  (click the dropdown on it, choose **Don't summarize**)
- **Longitude** = MapItems[lon]  (also **Don't summarize**)
- **Color value** = MembersInCounty
- **Size value** = MembersAtOffice
- **Tooltips** = MapItems[name], MapItems[region], and anything else useful

Counties now shade by member count and pins appear at each office, both updating when you
add slicers. That dynamic behavior is the whole reason we built this instead of using Azure Maps.

---

## PART 6: Make it look good

Click the visual, then the **paint roller** icon to open formatting.
- **Choropleth (regions):** set Low color (light) and High color (dark), fill opacity, border color/width.
- **Pins:** set pin color (pick something that pops against your gradient, like bright orange), base radius, opacity.
- **Basemap:** "Streets (OpenStreetMap)" shows roads underneath. "None" shows just your counties on a plain background (use this if your org blocks outside map tiles).

---

## TROUBLESHOOTING

**"node is not recognized"** after installing Node: close PowerShell, restart your PC, open a fresh PowerShell, try again. The installer needs a restart to register.

**Red ERR text during `npm install`:** usually a network/proxy issue on a work machine. Try from a non-restricted network, or ask IT about npm proxy settings. You can also try `npm install --no-optional`.

**`pbiviz package` errors about TypeScript:** note the file name and line number it complains about and send it to me. Strict checks are off, so this is rare, but the formatting code in `src/settings.ts` is the usual suspect if a tool version moved.

**Import is blocked / "your organization does not allow":** your Power BI tenant forbids visuals imported from a file. This is set by your admin, not on your PC. Options: ask your BI admin to allow imported visuals for you, or to publish this visual through the company's **Organizational Visuals** list (you hand them the .pbiviz, they vet and add it). This is the normal enterprise path.

**Florida does not appear in the smoke test, but no error:** check that **id** is in ID/Category and **wkt** is in Shape (WKT). Then check the wkt column actually contains text starting with `POLYGON` or `MULTIPOLYGON` (click the table, look at the column). If wkt is blank, the CSV did not load fully.

**The map is blank/gray with no roads:** your network may be blocking the OpenStreetMap tiles. Set Basemap to "None" in the paint roller. Your counties will still draw.

**Pins are missing but counties work:** confirm Latitude and Longitude are set to **Don't summarize** (click the dropdown arrow on each field in the well). If they say "Average of..." the pins collapse and vanish.

---

## The fastest path through Part 5

Send me:
1. The name of your member table.
2. Its exact column names for: the member's county FIPS, the assigned PCP id, the PCP name, PRAD_LAT, PRAD_LON.
3. Where it comes from (SQL Server, Snowflake, SharePoint, Excel).

I will write the exact Power Query steps and the two measures with your real names filled in,
so Part 5 becomes copy and paste instead of guesswork.
