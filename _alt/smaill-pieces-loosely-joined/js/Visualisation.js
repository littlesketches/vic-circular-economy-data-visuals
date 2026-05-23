// Libs and data
import * as d3      from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

// Classes
import { DataVis } from "../../_shared/js/DataVis.js";
import { WasteBreakdownTreemap } from "../../_shared/js/WasteBreakdownTreemap.js";

// => Data Visualisation class
export class JourneyVis extends DataVis {

    ///////////////////////////////////
    //// STATIC CONFIG AND METHODS ////
    ///////////////////////////////////

    /////////////////
    //// FIELDS  ////
    /////////////////

    state = {}

    el = {
        svg:            undefined,
        defs:           undefined,
        vis:            { group: undefined },
        illustration:   { group: undefined },
        legend:         { group: undefined },
        annotation:     { group: undefined },
        tooltip:        { group: undefined, treemap: undefined }
    }

    scale     = {}
    generator = {}
    axis      = {}


    /////////////////////
    //// CONSTRUCTOR ////
    /////////////////////

    constructor(app, queryConfig) {
        super(app)
        this.#initVis()
        this.render()
    }

    ///////////////////////////
    ////  PRIVATE METHODS  ////
    ///////////////////////////

    #initVis() {
        const { width, height, margin } = DataVis.CONFIG.dims
        const svg = this.el.svg = d3.select('svg#data-vis')
            .attr('viewBox', [0, 0, width, height])
            .classed('svg-vis', true)

        this.el.defs = svg.select('defs').node() ? svg.select('defs') : svg.append('defs')

        this.el.vis.group        = svg.append('g').classed('vis-group', true)
        this.el.annotation.group = svg.append('g').classed('annotation-group', true)
    }

    #clearDynamic() {
        this.el.vis.group.selectAll('.cell').remove()
        this.el.annotation.group.selectAll(
            '.section-label, .sub-section-label, .subsection-divider'
        ).remove()
    }

    update() {
        const { dataModel } = this.app.module
        const data = dataModel.data[this.app.state.select.year]
        if (!data) return console.warn(`No data for year ${this.app.state.select.year}`)
        console.log('Update')
        this.#clearDynamic()
        this.#renderFacetComposition(data, { animate: true })
    }


    // ─── COMPOSITION ────────────────────────────────────────────────────────
    #renderFacetComposition(layout, options = {}) {

        const {
            streamRankBy    = 'recoveryRate',
            commentaryWidth = 0.25,

            // Row height WEIGHTS — auto-normalised to fill the full canvas height.
            // Gaps and rowPadding px are subtracted first, so these weights share
            // only the truly available height.
            //
            // Row map:
            //   0  section header   — recovery rate
            //   1  subsection       — by source sector (rate)
            //   2  chart            — sector rate sparklines
            //   3  subsection       — by material stream (rate)
            //   4  chart            — stream rate top 4
            //   5  chart            — stream rate bottom 4
            //   6  section header   — waste volume
            //   7  subsection       — by source sector (vol)
            //   8  chart            — sector dual-area
            //   9  subsection       — by material stream (vol)
            //  10  chart            — stream vol top 4  (or treemap rows)
            //  11  chart            — stream vol bottom 4 (or treemap rows)
            //
            rowWeights  = [1.0, 0.4, 2.0, 0.4, 2.0, 2.0, 1.25, 0.4, 2.0, 0.4, 4.0, 4.0],
            //
            // rowPadding — reserved px at the TOP of each row, subtracted from
            // availH before the weight normalisation so the padding is real space
            // and never overlaps the row below.  Zero means no top-padding.
            //
            rowPadding  = [0, 0, 0, 0, 0, 0, 8, 0, 0, 0, 0, 0],
            rowGap      = 4,
            nCols       = 4,
            events      = [],
            volStreamMode = 'splitView',
            smPadding     = 6,
        } = options

        const series = Object.values(this.app.module.dataModel.data)
            .sort((a, b) => a.year - b.year)

        const years     = series.map(d => d.year),
            firstYear   = years[0],
            lastYear    = years[years.length - 1]


        /////////////////////////////
        /// I. LAYOUT COMPUTATION ///
        /////////////////////////////

        const { x, y, width, height } = layout

        const chartWidth = width * (1 - commentaryWidth) - rowGap,
            commentX     = x + chartWidth + rowGap * 2,
            commentW     = width * commentaryWidth

        // Total fixed overhead: inter-row gaps + per-row top padding
        const nGaps       = rowWeights.length - 1,
            paddingTotal = rowPadding.reduce((s, p) => s + p, 0),
            availH      = height - rowGap * nGaps - paddingTotal

        // Normalise weights → pixel heights (excluding per-row padding)
        const weightSum = rowWeights.reduce((s, w) => s + w, 0),
            rowPx     = rowWeights.map(w => (w / weightSum) * availH)

        // Absolute Y origin for each row — includes accumulated gaps AND padding
        const rowY = []
        rowPx.reduce((acc, h, i) => {
            rowY[i] = y + acc + rowPadding[i]   // padding shifts content down within the row
            return acc + h + rowPadding[i] + rowGap
        }, 0)

        // Column geometry
        const colW = (chartWidth - rowGap * (nCols - 1)) / nCols

        const cell = (row, col) => ({
            x:      x + col * (colW + rowGap),
            y:      rowY[row],
            width:  colW,
            height: rowPx[row],
        })

        const colX    = col => x + col * (colW + rowGap),
            colRightX = col => colX(col) + colW

        // Standard x scale
        const xInset = { left: 28, right: 6 }

        this.scale.tsX = d3.scaleLinear()
            .domain(d3.extent(years))
            .range([xInset.left, colW - xInset.right])

        // Flush-left x scale for col-0 with no y-axis labels
        const xInsetFlush = { left: 0, right: 6 }

        const xScaleFlush = d3.scaleLinear()
            .domain(d3.extent(years))
            .range([xInsetFlush.left, colW - xInsetFlush.right])


        /////////////////////////////
        /// II. STREAM RANKING    ///
        /////////////////////////////

        // Sort by LATEST year's recovery rate, descending
        const latestData = series[series.length - 1],
            allStreams   = Object.keys(DataVis.CONFIG.map.streamClass)

        const streamRanked = [...allStreams].sort((a, b) => {
            if (streamRankBy === 'alpha') return a.localeCompare(b)
            if (streamRankBy === 'volume') {
                const sumA = d3.sum(series, d => d.byStream[a]?.sectors?.All?.['Recovered - total'] ?? 0),
                    sumB = d3.sum(series, d => d.byStream[b]?.sectors?.All?.['Recovered - total'] ?? 0)

                return sumB - sumA
            }
            // Default: recovery rate of the LATEST year only
            const rateA = latestData.byStream[a]?.sectors?.All?.['Recovery rate'] ?? 0,
                rateB = latestData.byStream[b]?.sectors?.All?.['Recovery rate'] ?? 0

            return rateB - rateA
        })


        /////////////////////////////
        /// III. SHARED Y DOMAINS ///
        /////////////////////////////

        const sectorRateDomain = d3.extent([
            0,  // Start at zero
            ...series.map(d => d.metrics.Aggregated.recoveryRate),
            ...series.map(d => d.metrics.Aggregated.generated.bySector['C&D'] > 0
                ? (d.metrics.Aggregated.recovered.bySector['C&D'] / d.metrics.Aggregated.generated.bySector['C&D'] * 100)
                : null).filter(Boolean),
            ...series.map(d => d.metrics.Aggregated.generated.bySector['C&I'] > 0
                ? (d.metrics.Aggregated.recovered.bySector['C&I'] / d.metrics.Aggregated.generated.bySector['C&I'] * 100)
                : null).filter(Boolean),
            ...series.map(d => d.metrics.Aggregated.generated.bySector.MSW > 0
                ? (d.metrics.Aggregated.recovered.bySector.MSW / d.metrics.Aggregated.generated.bySector.MSW * 100)
                : null).filter(Boolean),
            ...streamRanked.flatMap(stream =>
                series.map(d => d.byStream[stream]?.sectors?.All?.['Recovery rate'] ?? null)
                    .filter(v => v != null)
            )
        ])

        const sectorDualDomain = d3.max([
            ...series.map(d => d.metrics.Aggregated.recovered.total),
            ...series.map(d => d.metrics.Aggregated.disposed.total),
            ...series.map(d => d.metrics.Aggregated.recovered.bySector.MSW),
            ...series.map(d => d.metrics.Aggregated.disposed.bySector.MSW),
            ...series.map(d => d.metrics.Aggregated.recovered.bySector['C&I']),
            ...series.map(d => d.metrics.Aggregated.disposed.bySector['C&I']),
            ...series.map(d => d.metrics.Aggregated.recovered.bySector['C&D']),
            ...series.map(d => d.metrics.Aggregated.disposed.bySector['C&D']),
        ]) 


        ////////////////////////////////////////
        /// IV. SECTION & SUBSECTION HEADERS ///
        ////////////////////////////////////////

        const sectionFs   = Math.max(9, height * 0.022)
        const sectionMidY = rowIndex => rowY[rowIndex] + rowPx[rowIndex] / 2

        // Helper method
        const drawSubsectionHeader = (rowIndex, label, opts = {}) => {
            const { startCol = null, endCol = null, xInset: colXInset = 0 } = opts

            // rowY[rowIndex] already includes any rowPadding for this row
            const ry   = rowY[rowIndex]
            const rh   = rowPx[rowIndex]
            const midY = ry + rh / 2
            const fs   = Math.max(8, rh * 0.55)

            const titleX  = startCol != null ? colX(startCol) + colXInset : x
            const divEndX = endCol   != null ? colRightX(endCol) : x + chartWidth

            this.el.annotation.group.append('text')
                .classed('sub-section-label', true)
                .attr('transform', `translate(${titleX}, ${midY})`)
                .attr('dominant-baseline', 'middle')
                .style('font-size', fs)
                .text(label)

            const labelW = label.length * fs * 0.52
            const divX   = titleX + labelW + 6
            const divH   = Math.max(0.5, rh * 0.08)
            const divY   = midY - divH / 2

            if (divEndX > divX) {
                this.el.annotation.group.append('rect')
                    .classed('subsection-divider', true)
                    .attr('x', divX).attr('y', divY)
                    .attr('width', divEndX - divX).attr('height', divH)
                    .style('opacity', 0.2)
            }
        }

        // Row 0 — recovery rate section label
        this.el.annotation.group.append('text')
            .classed('section-label recovery-rate', true)
            .attr('transform', `translate(${x}, ${sectionMidY(0)})`)
            .attr('dominant-baseline', 'middle')
            .style('font-size', sectionFs)
            .text('Recovery rate')

        // Row 1 — "All waste" tag over col 0 (flush left), "By source sector" over cols 1-3
        drawSubsectionHeader(1, 'All sectors & streams', { startCol: 0, endCol: 0, xInset: 0 })
        drawSubsectionHeader(1, 'By source sector', { startCol: 1, endCol: nCols - 1,  xInset: xInset.left })

        // Row 3 — "By material stream" over all cols
        drawSubsectionHeader(3, 'By material stream', { startCol: 0, endCol: nCols - 1, xInset: 0 })

        // Row 6 — waste volume section label (rowPadding[6] = 8 provides the breathing room)
        this.el.annotation.group.append('text')
            .classed('section-label waste-volume', true)
            .attr('transform', `translate(${x}, ${sectionMidY(6)})`)
            .attr('dominant-baseline', 'middle')
            .style('font-size', sectionFs)
            .html('Waste volume: recovered vs <tspan>disposed</tspan>')

        // Row 7 — same pattern as row 1
        drawSubsectionHeader(7, 'All sectors & streams', { startCol: 0, endCol: 0, xInset: 0 })
        drawSubsectionHeader(7, 'By source sector', { startCol: 1, endCol: nCols - 1,  xInset: xInset.left })

        // Row 9 — same pattern as row 3
        drawSubsectionHeader(9, 'Trends by material stream', { startCol: 0, endCol: 1, xInset: 0 })
        drawSubsectionHeader(9, `Composition by stream and source in ${lastYear}`, { startCol: 2, endCol: nCols - 1, xInset: xInset.left })


        ////////////////////////////////
        /// V. ROW 2 — SECTOR RATES  ///
        ////////////////////////////////

        const sectorRateDefs = [
            {
                title:      null,   // '\n' triggers multi-line
                yKey:       d => d.metrics.Aggregated.recoveryRate,

            },
            {
                title:      'Municipal solid waste',
                yKey:       d => d.metrics.Aggregated.generated.bySector.MSW > 0
                    ? d.metrics.Aggregated.recovered.bySector.MSW / d.metrics.Aggregated.generated.bySector.MSW * 100
                    : null,
                class:      DataVis.CONFIG.map.sectorClass['MSW']
            },
            {
                title:      'Commercial & industrial',
                yKey:       d => d.metrics.Aggregated.generated.bySector['C&I'] > 0
                    ? d.metrics.Aggregated.recovered.bySector['C&I'] / d.metrics.Aggregated.generated.bySector['C&I'] * 100
                    : null,
                class:      DataVis.CONFIG.map.sectorClass['C&I']
            },
            {
                title:      'Construction & demolition',
                yKey:       d => d.metrics.Aggregated.generated.bySector['C&D'] > 0
                    ? d.metrics.Aggregated.recovered.bySector['C&D'] / d.metrics.Aggregated.generated.bySector['C&D'] * 100
                    : null,
                class:      DataVis.CONFIG.map.sectorClass['C&D']
            },
        ]

        const sectorRateMaxLines = Math.max(
            ...sectorRateDefs.map(d => (d.title ?? '').split('\n').filter(l => l).length)
        )

        sectorRateDefs.forEach((def, col) => {
            const cl      = cell(2, col)
            const isFirst = col === 0
            const g       = this.el.vis.group.append('g')
                .classed(`cell r2-c${col}`, true)
                .attr('transform', `translate(${cl.x}, ${cl.y})`)

            this.#sparkLineArea(g, series, {
                yKey:          def.yKey,
                yDomain:       sectorRateDomain,
                width:         cl.width,
                height:        cl.height,
                title:         def.title ,
                titleMode:     'top',
                titleBg:       true,
                fillMode:      'solid-contour',
                contourSpacing:    5,
                contourStrokeWidth: 1,
                sectorClass:   def.class,
                xInset:        isFirst ? xInsetFlush : xInset,
                xScale:        isFirst ? xScaleFlush : this.scale.tsX,
                showFirstLast: true,
                events,
                format:        v => this.#formatPct(v),
                areaTitleLines: sectorRateMaxLines,
            })
        })


        //////////////////////////////////////
        /// VI. ROWS 4+5 — STREAM RATES    ///
        //////////////////////////////////////

        streamRanked.forEach((stream, si) => {
            const row   = si < 4 ? 4 : 5,
                col     = si % 4,
                isFirst = col === 0,
                cl      = cell(row, col),
                g       = this.el.vis.group.append('g')
                            .classed(`cell stream-rate-${si}`, true)
                            .attr('transform', `translate(${cl.x}, ${cl.y})`)

            this.#sparkLineArea(g, series, {
                yKey:          d => d.byStream[stream]?.sectors?.All?.['Recovery rate'] ?? null,
                yDomain:       sectorRateDomain,
                width:         cl.width,
                height:        cl.height,
                title:         stream,
                titleMode:     'path',
                titleBg:       true,
                fillMode:      'contour',
                contourSpacing:    5,
                contourStrokeWidth: 1,
                xInset:        isFirst ? xInsetFlush : xInset,
                xScale:        isFirst ? xScaleFlush : this.scale.tsX,
                showFirstLast: true,
                events,
                format:        v => this.#formatPct(v),
                streamClass:   DataVis.CONFIG.map.streamClass[stream],
                areaTitleLines: sectorRateMaxLines,
            })
        })


        //////////////////////////////////////
        /// VII. ROW 8 — SECTOR DUAL AREA  ///
        //////////////////////////////////////

        const sectorVolDefs = [
            {
                title:        '',
                recoveredKey: d => d.metrics.Aggregated.recovered.total,
                disposedKey:  d => d.metrics.Aggregated.disposed.total,
            },
            {
                title:        'Municipal solid waste',
                recoveredKey: d => d.metrics.Aggregated.recovered.bySector.MSW,
                disposedKey:  d => d.metrics.Aggregated.disposed.bySector.MSW,
                class:      DataVis.CONFIG.map.sectorClass['MSW']
            },
            {
                title:        'Commercial & industrial',
                recoveredKey: d => d.metrics.Aggregated.recovered.bySector['C&I'],
                disposedKey:  d => d.metrics.Aggregated.disposed.bySector['C&I'],
                class:      DataVis.CONFIG.map.sectorClass['C&I']
            },
            {
                title:        'Construction & demolition',
                recoveredKey: d => d.metrics.Aggregated.recovered.bySector['C&D'],
                disposedKey:  d => d.metrics.Aggregated.disposed.bySector['C&D'],
                class:      DataVis.CONFIG.map.sectorClass['C&D']
            },
        ]

        sectorVolDefs.forEach((def, col) => {
            const cl    = cell(8, col),
                isFirst = col === 0

            const g = this.el.vis.group.append('g')
                .classed(`cell r8-c${col}`, true)
                .attr('transform', `translate(${cl.x}, ${cl.y})`)

            this.#dualArea(g, series, {
                recoveredKey: def.recoveredKey,
                disposedKey:  def.disposedKey,
                yMax:         sectorDualDomain,
                width:        cl.width,
                height:       cl.height,
                midPadding:   cl.height * 0.075,
                title:        def.title,
                sClass:        def.class,
                xInset:       isFirst ? xInsetFlush : xInset,
                xScale:       isFirst ? xScaleFlush : this.scale.tsX,
                format:       v => `${d3.format('.1f')(Math.abs(v) / 1e6)}Mt`,
            })
        })


        //////////////////////////////////////////////////////
        /// VIII. ROWS 10+11 — STREAM VOL (dual / treemap) ///
        //////////////////////////////////////////////////////

        switch(volStreamMode){
            case 'splitView':

                //////////////////////////////////////////
                // A. MATERIAL STREAM TABLE / SPARKLINE //
                //////////////////////////////////////////

                // i. Layout size
                const combinedH = rowPx[10] + rowGap + rowPx[11],
                    topY      = rowY[10],
                    panelW    = colRightX(1) - colX(0),
                    panelX    = colX(0)

                // ii. Column proportions
                const trendFrac = 0.3,
                    trendW    = panelW * trendFrac,
                    nameW     = panelW * (1 - trendFrac * 2),
                    nameX     = panelX + trendW,
                    recTrendX = panelX + trendW + nameW

                // iii. Row sizing
                const headerFrac = 0.075,
                    headerH    = combinedH * headerFrac,
                    bodyH      = combinedH - headerH,
                    nStreams   = streamRanked.length,
                    rowH       = (bodyH - rowGap * (nStreams - 1)) / nStreams

                // iv. Font sizes
                const headerFs = headerH * 0.32,
                    nameFs   = Math.max(7, rowH * 0.22),
                    valueFs  = rowH * 0.2,
                    nodeR    = Math.max(1.5, rowH * 0.06),
                    valPad   = nodeR + 3

                // v. Geometry within each trend column: stimate value label width from valueFs * char count
                const startValW  = valueFs * 3.2,    // "0.0 Mt" ≈ 6 chars
                    endValW    = valueFs * 3.2,
                    labelPad   = 3

                // vi. Sparkline geometry
                const startNodeX = labelPad + startValW + valPad,
                    endNodeX     = trendW - labelPad - endValW - valPad,
                    sparkW       = endNodeX - startNodeX,
                    sparkH       = Math.min(rowH * 0.65, sparkW * 0.75),
                    sparkOffY    = (rowH - sparkH) / 2

                // vii. Column headers 
                const headerG = this.el.vis.group.append('g')
                    .classed('cell material-trend-spark-header', true)
                    .attr('transform', `translate(${panelX}, ${topY})`)

                ;[
                    { label: 'Recovered', x: trendW / 2 },
                    { label: '',  x: trendW + nameW / 2 },
                    { label: 'Disposed',  x: trendW + nameW + trendW / 2 },
                ].forEach(({ label, x }) => {
                    headerG.append('text')
                        .classed('material-trend-spark-header', true)
                        .attr('x', x).attr('y', headerH * 0.75)
                        .style('font-size', headerFs)
                        .text(label)
                })

                headerG.append('line')
                    .classed('material-trend-spark-divider', true)
                    .attr('x1', 0).attr('x2', panelW)
                    .attr('y1', headerH - 1).attr('y2', headerH - 1)
   
                // viii. Material stream rows
                streamRanked.forEach((stream, si) => {
                    const ry   = topY + headerH + si * (rowH + rowGap)
                    const midY = ry + rowH / 2

                    const recSeries = series.map(d => d.byStream[stream]?.sectors?.All?.['Recovered - total'] ?? 0)
                    const disSeries = series.map(d => d.byStream[stream]?.sectors?.All?.Disposed               ?? 0)

                    const indexTo100 = vals => { const b = vals[0] || 1; return vals.map(v => v / b * 100) }
                    const recIdx = indexTo100(recSeries)
                    const disIdx = indexTo100(disSeries)

                    const idxExtent = d3.extent([...recIdx, ...disIdx])
                    const idxPad    = (idxExtent[1] - idxExtent[0]) * 0.1 || 5

                    const fmt = v => `${d3.format('.2f')(v / 1e6)} Mt`

                    // ── Left col: RECOVERED ───────────────────────────────────────────────
                    this.#trendSpark(this.el.vis.group, recIdx, {
                        x:          panelX + startNodeX,
                        y:          ry + sparkOffY,
                        width:      sparkW,
                        height:     sparkH,
                        nodeR,
                        idxExtent,
                        idxPad,
                        startVal:   fmt(recSeries[0]),
                        endVal:     fmt(recSeries[recSeries.length - 1]),
                        startValX:  panelX + startNodeX - valPad,
                        endValX:    panelX + endNodeX   + valPad,
                        valY:       midY,
                        valueFs,
                        seriesClass: 'recovered',
                    })

                    // ── Stream name — split long names at last space before midpoint ──
                    const words      = stream.split(' ')
                    const midWord    = Math.ceil(words.length / 2)
                    const line1      = words.slice(0, midWord).join(' ')
                    const line2      = words.slice(midWord).join(' ')
                    const nameLineH  = nameFs * 1.25
                    const nameStartY = line2 ? midY - nameLineH / 2 : midY

                    const nameEl = this.el.vis.group.append('text')
                        .classed('splitview-stream-name', true)
                        .attr('text-anchor', 'middle')
                        .attr('dominant-baseline', 'central')
                        .style('font-size', nameFs)

                    nameEl.append('tspan')
                        .attr('x', nameX + nameW / 2)
                        .attr('y', nameStartY)
                        .text(line1)

                    if (line2) {
                        nameEl.append('tspan')
                            .attr('x', nameX + nameW / 2)
                            .attr('dy', `${nameLineH}px`)
                            .text(line2)
                    }

                    // ── Right col: DISPOSED ───────────────────────────────────────────────
                    this.#trendSpark(this.el.vis.group, disIdx, {
                        x:          recTrendX + startNodeX,
                        y:          ry + sparkOffY,
                        width:      sparkW,
                        height:     sparkH,
                        nodeR,
                        idxExtent,
                        idxPad,
                        startVal:   fmt(disSeries[0]),
                        endVal:     fmt(disSeries[disSeries.length - 1]),
                        startValX:  recTrendX + startNodeX - valPad,
                        endValX:    recTrendX + endNodeX   + valPad,
                        valY:       midY,
                        valueFs,
                        seriesClass: 'disposed',
                    })

                    // Row divider
                    if (si < nStreams - 1) {
                        this.el.vis.group.append('line')
                            .classed('splitview-row-divider', true)
                            .attr('x1', panelX).attr('x2', panelX + panelW)
                            .attr('y1', ry + rowH + rowGap / 2)
                            .attr('y2', ry + rowH + rowGap / 2)
                            .style('opacity', 0.15)
                    }
                })

                /////////////////////////////////
                // B. TREEMAP FOR LATEST YEAR  //
                /////////////////////////////////

                // i. Layout config
                const tmX       = colX(2) + 28,
                    tmW         = colW * 2 + rowGap - 28 - 6,  // exactly two column widths + the gap between them minus sparkline chart offests
                    latestData2 = series[series.length - 1],
                    largeLabelH = Math.max(10, combinedH * 0.04)

                const gLarge = this.el.vis.group.append('g')
                    .classed('cell treemap-large', true)
                    .attr('transform', `translate(${tmX}, ${topY})`)


                const tmDataLarge = WasteBreakdownTreemap.fromDataVisData(latestData2, DataVis.CONFIG.map.streamClass)

                // ii. Add treemap
                new WasteBreakdownTreemap(
                    gLarge,
                    { 
                        x:      0, 
                        y:      largeLabelH * 1, 
                        width: tmW, 
                        height: combinedH - largeLabelH - largeLabelH
                    },
                    tmDataLarge,
                    { 
                        showAnnotation: true, 
                        showTooltips: true 
                    }
                )
                break
        }

        /////////////////////////////
        /// IX. COMMENTARY COLUMN ///
        /////////////////////////////

        const commentG = this.el.annotation.group.append('g')
            .classed('commentary', true)
            .attr('transform', `translate(${commentX}, ${y})`)

        // commentG.append('rect').classed('commentary-bg', true)
        //     .attr('width', commentW).attr('height', height)

        commentG.append('text').classed('commentary-placeholder', true)
            .attr('x', width * 0.05).attr('y', height * 0.05)
            .style('font-size', 16).style('opacity', 0.75)
            .text('Commentary TBA by section')

        commentG.append('text').classed('commentary-placeholder', true)
            .attr('x', width * 0.05).attr('y', height * 0.225)
            .style('font-size', 16).style('opacity', 0.75)
            .text('Commentary TBA by section')

        commentG.append('text').classed('commentary-placeholder', true)
            .attr('x', width * 0.05).attr('y', height * 0.55)
            .style('font-size', 16).style('opacity', 0.75)
            .text('Commentary TBA by section')

        commentG.append('text').classed('commentary-placeholder', true)
            .attr('x', width * 0.05).attr('y', height * 0.675)
            .style('font-size', 16).style('opacity', 0.75)
            .text('Commentary TBA by section')

    }



    // ─── CHART METHODS ─────────────────────────────────────────────────────────

    // SPARK-AREA LINE CHART 
    #sparkLineArea(g, series, options = {}) {

        // i/ Chart options
        const {
            yKey,
            yDomain,
            width,
            height,
            title               = '',
            titleMode           = 'top',    // 'top' | 'path' | 'area'
            titleBg             = false,    // show background rect for 'area' mode
            fillMode            = 'contour',  // 'solid' | 'contour' | 'solid-contour'
            contourSpacing      = 3,        // px between contour lines
            contourStrokeWidth  = 0.75,
            xInset              = { left: 28, right: 6 },
            xScale              = this.scale.tsX,
            events              = [],
            format              = v => v,
            sectorClass         = null,
            streamClass         = null,
            curve               = d3.curveLinear,
            showFirstLast       = false,
            areaTitleLines      = null,   // explicit line-count to reserve at bottom, overrides titleLines.length
        } = options

        // ii. Data
        const years       = series.map(d => d.year)
        const validSeries = series.filter(d => yKey(d) != null)

        // iii. Layout config: for title type
        const titleLines = (title ?? '').split('\n').filter(l => l.length > 0)
        const titleFs  = width * 0.055    

        const chartTop = titleMode === 'top'                 // chartTop reserves space when title is at the top
            ? titleFs * (1 + titleLines.length * 1.2)
            : titleFs * 0.5

        const areaTitleLineH = titleFs * 1.25      

        const reservedLines = titleMode === 'area'
            ? (areaTitleLines ?? titleLines.length)
            : 0
        const areaTitleH  = !title && reservedLines === 0 ? 0 :
            titleMode === 'area'
                ? reservedLines * areaTitleLineH + 2
                : 0
        const xAxisY = height - 4 - areaTitleH

        // iv. Scales and generators for area and line
        const yPad   = (yDomain[1] - yDomain[0]) * 0.025
        const yScale = d3.scaleLinear()
            .domain([yDomain[0] - yPad, yDomain[1] + yPad])
            .range([height - 2, 2])

        yScale.range([xAxisY, chartTop])

        const areaGen = d3.area()
            .x(d => xScale(d.year))
            .y0(yScale(yDomain[0]))
            .y1(d => yScale(yKey(d)))
            .curve(curve)
            .defined(d => yKey(d) != null)

        const lineGen = d3.line()
            .x(d => xScale(d.year))
            .y(d => yScale(yKey(d)))
            .curve(curve)
            .defined(d => yKey(d) != null)

        // v. Render area by "fillMode"
        switch(fillMode){
            case 'solid-contour':
                g.append('path').classed(`spark-area ${streamClass ?? ''} ${sectorClass ?? ''}`, true)
                    .attr('d', areaGen(series))

            case 'contour':
                // Contour fill: clip to the area shape, then draw stacked offset lines
                const clipId   = `contour-clip-${Math.random().toString(36).slice(2, 8)}`
                const clipPath = this.el.defs.append('clipPath').attr('id', clipId)
                clipPath.append('path').attr('d', areaGen(series))

                const clipped = g.append('g')
                    .attr('clip-path', `url(#${clipId})`)
                    .classed(`contour-fill ${streamClass ?? ''} ${sectorClass ?? ''}`, true)

                // How many lines do we need to fill from chartTop to xAxisY
                const fillH    = xAxisY - chartTop
                const nLines   = Math.ceil(fillH / contourSpacing) + 1

                const lineGen2 = d3.line()
                    .x(d => xScale(d.year))
                    .y(d => yScale(yKey(d)))
                    .curve(curve)
                    .defined(d => yKey(d) != null)

                const basePath = lineGen2(validSeries)

                for (let li = 0; li < nLines; li++) {
                    const offsetY = li * contourSpacing

                    clipped.append('path')
                        .classed(`contour-line ${fillMode} ${streamClass ?? ''} ${sectorClass ?? ''}`, true)
                        .attr('transform', `translate(0, ${offsetY})`)
                        .style('stroke-width', contourStrokeWidth)
                        .attr('d', basePath)
                }
                break

            case 'solid':
                g.append('path').classed(`spark-area ${streamClass ?? ''} ${sectorClass ?? ''}`, true)
                    .attr('d', areaGen(series))
                break
        }

        // vi. Sparkline 
        const lineId  = `spark-path-${Math.random().toString(36).slice(2, 8)}`

        const lineEl = g.append('path')
            .classed(`spark-line ${streamClass ?? ''}`, true)
            .attr('id', lineId)
            .style('stroke-width', width / 120)
            .attr('d', lineGen(validSeries))


        // vii. Add chart title (by titleMode)
        if(title){
            switch(titleMode){
                case 'top':
                    const t = g.append('text').classed('spark-title', true)
                        .attr('x', xInset.left)
                        .attr('y', titleFs)
                        .style('font-size', titleFs)

                    titleLines.forEach((line, li) => {
                        t.append('tspan')
                            .attr('x', xInset.left)
                            .attr('dy', li === 0 ? 0 : `${titleFs * 1.2}px`)
                            .text(line)
                    })
                    break

                case 'path':
                    if(titleLines.length > 0 && validSeries.length >= 2){
                        // i. Add smooth helper path (hidden) for the textPath
                        const labelPathId = `label-path-${Math.random().toString(36).slice(2, 8)}`

                        const smoothGen   = d3.line()
                            .x(d => xScale(d.year))
                            .y(d => yScale(yKey(d)))
                            .curve(d3.curveCardinal)
                            .defined(d => yKey(d) != null)

                        g.append('path')
                            .attr('id', labelPathId)
                            .style('display', 'none')
                            .attr('d', smoothGen(validSeries))

                        // ii. Render first line on the path; additional lines as offset tspans
                        const t = g.append('text')
                            .classed('spark-title spark-title--path', true)
                            .style('font-size', titleFs * 0.8)
                            .attr('dy', -titleFs * 0.4)

                        t.append('textPath')
                            .attr('href', `#${labelPathId}`)
                            .attr('startOffset', '50%')
                            .attr('text-anchor', 'middle')
                            .text(titleLines[0])

                        // iii. Extra lines (if required))
                        titleLines.slice(1).forEach((line, li) => {
                            t.append('tspan')
                                .attr('x', 0)
                                .attr('dy', `${titleFs * 1.2}px`)
                                .text(line)
                        })
                    }
                    break

                case 'area':
                    if(titleLines.length > 0) {
                        // i. Calculated positioning and layout
                        const chartMidX = (xInset.left + width - xInset.right) / 2           // Centre point of the drawable chart area
                        const bgPadX = 6, bgPadY = 1                       
                        const blockH = titleLines.length * areaTitleLineH                // Total block height = lines × areaTitleLineH                       
                        const topLineY = xAxisY + areaTitleH - blockH + areaTitleLineH - bgPadY      // Y of the topmost line's baseline — lines stack downward from here
                        const blockHeight = blockH + bgPadY * 2

                        // ii. Add title group for bg and label
                        const titleGroup = g.append('g')
                            .attr('transform', `translate(0, ${-blockH - bgPadY * 8})`)

                        // iii. Optional background rect — centred on chartMidX
                        if (titleBg) {
                            const longestLine = titleLines.reduce((a, b) => a.length > b.length ? a : b, '')
                            const estimatedW  = longestLine.length * titleFs * 0.52 + bgPadX * 2

                            titleGroup.append('rect')
                                .classed('area-title-bg', true)
                                .attr('x', chartMidX - estimatedW / 2)
                                .attr('y', topLineY - areaTitleLineH + bgPadY)
                                .attr('width', estimatedW)
                                .attr('height', blockHeight)
                        }

                        // iv. Add label text element — centred, each line as a tspan sharing the same x
                        const t = titleGroup.append('text')
                            .classed('spark-title area-title', true)
                            .attr('x', chartMidX)
                            .attr('y', topLineY)
                            .style('font-size', titleFs)

                        titleLines.forEach((line, li) => {
                            t.append('tspan')
                                .attr('x', chartMidX)
                                .attr('dy', li === 0 ? 0 : `${areaTitleLineH}px`)
                                .text(line)
                        })
                    }

                    break
            }
        }

        // Nodes: with annotation
        if (showFirstLast && validSeries.length >= 2) {
    
            const valueFs = width * 0.035

            ;[validSeries[0], validSeries[validSeries.length - 1]].forEach((d, i) => {
                const vx   = xScale(d.year),
                    vy     = yScale(yKey(d)),
                    isLatest = i === 1

                // Year label at x-axis
                g.append('text')
                    .classed('spark-year-label', true)
                    .attr('x', vx)
                    .attr('y', xAxisY + valueFs * 0.75)
                    .style('font-size', valueFs)
                    .text(d.year)

                // Node dot
                g.append('circle').classed('spark-dot', true)
                    .attr('cx', vx).attr('cy', vy)
                    .attr('r', valueFs * 0.5)

                // Value label — with superscript % if format returns a {__pct} object
                const fv = format(yKey(d))

                this.#appendFormattedValue(g, fv, {
                    isLatest,
                    x:          vx + valueFs * 0.25,
                    y:          vy - valueFs * 0.75,
                    textAnchor: 'middle',
                    fontSize:   valueFs,
                    cls:        'spark-value',
                })
            })
        }
    }

    // TREND SPARKLINE 
    #trendSpark(parent, idxVals, options = {}) {
        // i. Chart options
        const {
            x, y,
            width, height,
            nodeR       = 2,
            idxExtent,
            idxPad,
            startVal    = '',
            endVal      = '',
            startValX,              
            endValX,                
            valY,                   
            valueFs     = 7,
            seriesClass = '',
            curve       = d3.curveLinear,
        } = options

        // ii. Scales and line genertor
        const xScale = d3.scaleLinear()
            .domain([0, idxVals.length - 1])
            .range([0, width])

        const yScale = d3.scaleLinear()
            .domain([idxExtent[0] - idxPad, idxExtent[1] + idxPad])
            .range([height, 0])

        const lineGen = d3.line()
            .x((_, i) => xScale(i))
            .y(d => yScale(d))
            .curve(curve)

        // iii. Container group — translated to absolute position
        const g = parent.append('g')
            .classed(`cell trendSpark ${seriesClass}`, true)
            .attr('transform', `translate(${x}, ${y})`)

        // iv. Render line
        g.append('path')
            .classed('trend-line', true)
            .attr('d', lineGen(idxVals))
            .style('fill', 'none')
            .style('stroke-width', Math.max(0.75, width * 0.02))

        // v. Render Start and end nodes
        g.append('circle').classed('trend-dot start', true)
            .attr('cx', 0)
            .attr('cy', yScale(idxVals[0]))
            .attr('r', nodeR * 0.75)

        g.append('circle').classed('trend-dot end', true)
            .attr('cx', width)
            .attr('cy', yScale(idxVals[idxVals.length - 1]))
            .attr('r', nodeR)

        // vi. Add vnode alue labels
        if (startVal) 
            g.append('text')
                .classed(`trend-spark-value ${seriesClass} start`, true)
                .attr('x', 0 - nodeR * 3)
                .attr('y', yScale(idxVals[0]))             
                .style('font-size', `${valueFs}px`)
                .text(startVal)
        
        if (endVal) 
            g.append('text')
                .classed(`trend-spark-value ${seriesClass} end`, true)
                .attr('x', width + nodeR * 3)
                .attr('y', yScale(idxVals[idxVals.length - 1]) )   // ← node's actual y
                .style('font-size', `${valueFs}px`)
                .text(endVal)
        
    }

    // DUAL AREA CHART 
    #dualArea(g, series, options = {}) {
        // i. Chart options
        const {
            recoveredKey,
            disposedKey,
            yMax,
            width,
            height,
            title         = '',
            xInset        = { left: 28, right: 6 },
            xScale        = this.scale.tsX,
            showFirstLast = true,
            midPadding    = 5,
            format        = v => v,
            sClass        = null,
            curve         = d3.curveLinear,
        } = options

        // ii. Data
        const years = series.map(d => d.year)

        // iii. Layout config
        const titleFs = width * 0.05,
            chartTop  = titleFs * 2.5,
            xBottom   = height,
            xLabelOffset = width * 0.05
        
        const midY   = chartTop + (xBottom - chartTop) / 2,
            recBase  = midY - midPadding,   // recovered area baseline (upper half)
            disBase  = midY + midPadding   // disposed area baseline (lower half)

        const lineStrokeW = Math.max(0.5, width / 500)
        const valueFs     = width * 0.035

        // iv. Add title
        g.append('text').classed('spark-title', true)
            .attr('x', xInset.left)
            .attr('y', titleFs)
            .style('font-size', titleFs)
            .text(title)

        // v. Scales and generators for areas
        const yScalePos = d3.scaleLinear().domain([0, yMax]).range([recBase, chartTop]),
            yScaleNeg = d3.scaleLinear().domain([0, yMax]).range([disBase, xBottom])

        const recArea = d3.area()
            .x(d => xScale(d.year))
            .y0(recBase)
            .y1(d => yScalePos(recoveredKey(d) ?? 0))
            .curve(curve)
            .defined(d => recoveredKey(d) != null)

        const disArea = d3.area()
            .x(d => xScale(d.year))
            .y0(disBase)
            .y1(d => yScaleNeg(disposedKey(d) ?? 0))
            .curve(curve)
            .defined(d => disposedKey(d) != null)

        // vi. Add centre baseline (or gap band if midPadding > 0)
        g.append('line').classed('dual-baseline', true)
            .attr('x1', xInset.left + xLabelOffset)
            .attr('x2', width - xInset.right - xLabelOffset)
            .attr('y1', midY).attr('y2', midY)


        // vi. Render recovered  area above centre
        g.append('path')
            .classed(`dual-area recovered ${sClass ?? ''}`, true)
            .attr('d', recArea(series))

        // vii. Render Disposed area below centre 
        g.append('path')
            .classed(`dual-area disposed ${sClass ?? ''}`, true)
            .attr('d', disArea(series))

        // viii. Render  first/last  values
        if (showFirstLast) {
            const validRec = series.filter(d => recoveredKey(d) != null)
            const validDis = series.filter(d => disposedKey(d) != null)

            const drawDualAreaEndpoints =  (validS, yScale, key, baselineY, seriesClass) => {
                if (validS.length < 2) return

                ;[validS[0], validS[validS.length - 1]].forEach((d, i) => {
                    const vx = xScale(d.year),
                        vy  = yScale(key(d)),
                        isLast  = i === 1

                    // Year label at baseline (once)
                    if(seriesClass === 'recovered'){
                        g.append('text')
                            .classed(`spark-year-label ${seriesClass}`, true)
                            .attr('x', vx)
                            .attr('y', midY)
                            .style('font-size', valueFs)
                            .text(d.year)
                    }

                    // Value label — above node for recovered, below for disposed
                    const fv = format(key(d))
                    this.#appendFormattedValue(g, fv, {
                        isLatest:   isLast,
                        x:          vx + valueFs * 0.25,
                        y:          seriesClass === 'recovered' ? vy - valueFs * 0.75  : vy + valueFs * 1.75,
                        textAnchor: 'middle',
                        baseline:   seriesClass === 'recovered' ? 'alphabetic'  : 'hanging',
                        fontSize:   valueFs,
                        cls:        `spark-value dual-area ${seriesClass}`,
                    })
                })
            }

            drawDualAreaEndpoints(validRec, yScalePos, recoveredKey, recBase, 'recovered')
            drawDualAreaEndpoints(validDis, yScaleNeg, disposedKey,  disBase, 'disposed')

        }
    }

    // ─── CHART HELPERS ─────────────────────────────────────────────────────────

    #formatPct(v) { return { __pct: true, number: d3.format('.0f')(v) }  }   // Return a special tagged object that #appendFormattedValue recognises

    #formatPctStr(v) { return `${d3.format('.0f')(v)}%` }

    #appendFormattedValue(parent, value, opts = {}) {
        const { x = 0, y = 0, textAnchor = 'start', fontSize, cls = '', isLatest } = opts
        const fsMult =  isLatest ? 1.5 : 1

        const el = parent.append('text')
            .attr('x', x)
            .attr('y', y)
            .attr('text-anchor', textAnchor)
            .style('font-size', `${fontSize * fsMult}px`)
            .classed(cls, !!cls)
            .classed('latest', isLatest)

        if (value && value.__pct) {
            el.append('tspan').text(value.number)       
            el.append('tspan')
                .attr('dy', `-${fontSize * fsMult * 0.4 }px`)   
                .style('font-size', `${fontSize * fsMult * 0.45}px`)
                .text('%')
                .clone(false)   

            // Return baseline to original after the superscript
            el.append('tspan')
                .attr('dy', `${fontSize * 0.45}px`)  
                .text('')        
        } else {
            el.text(value)
        }

        return el
    }





    //////////////////////////
    ////  PUBLIC METHODS  ////
    //////////////////////////

    render() {
        const { dataModel }  = this.app.module
        const { width, height, margin } = DataVis.CONFIG.dims
        const canvasWidth    = width  - margin.left - margin.right
        const canvasHeight   = height - margin.top  - margin.bottom

        this.#renderFacetComposition(
            {
                x:      margin.left,
                y:      margin.top,
                width:  canvasWidth,
                height: canvasHeight,
            },
            {
                streamRankBy:    'recoveryRate',
                commentaryWidth: 0.333,
                smPadding:       6,
                volStreamMode:   'splitView',     // 'splitView' | 'treemap' | 'dualArea'

                rowPadding: [0, 0, 0, 20, 10, 0, 50, 0, 0, 0, 0, 0],

                rowWeights: [
                    1.0,    // 0  section header: recovery rate
                    0.4,    // 1  subsection header
                    2.5,    // 2  sector rate sparklines
                    0.4,    // 3  subsection: header
                    2.5,    // 4  stream rate — top 4
                    2.5,    // 5  stream rate — bottom 4
                    1.0,    // 6  section header: waste volume
                    0.4,    // 7  subsection header
                    2.5,    // 8  sector dual-area
                    0.4,    // 9  subsection: by material stream (vol)
                    4.0,    // 10 stream vol — top 4 
                    4.0,    // 11 stream vol — bottom 4 
                ],

                events: [
                    { year: 2018, label: 'China National Sword' },
                    { year: 2020, label: 'COVID-19' },
                ]
            }
        )
    }
}