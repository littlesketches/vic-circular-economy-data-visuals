// Libs and data
import * as d3      from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

// Classes
import { DataVis } from "../../_shared/js/DataVis.js";
import { WasteBreakdownTreemap } from "../../_shared/js/WasteBreakdownTreemap.js";

// => Data Visualisation class
export class JoyVis extends DataVis {

    ///////////////////////////////////
    //// STATIC CONFIG AND METHODS ////
    ///////////////////////////////////

    static CONFIG = {
        ridgeline: {
            marginLeft:   150,
            marginRight:  24,
            marginTop:    24,
            marginBottom: 0,
            ridgeHeight:  100,
            overlap:      0.775,
            fillOpacity:  0.8,
            strokeWidth:  1.6,
            curve:        d3.curveCatmullRom.alpha(0),
            colorScheme: ['#262626'],
        }
    }

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

        this.el.vis.group.append('rect')
            .classed('bg', true)
            .attr('x', margin.left)
            .attr('y', margin.top)
            .attr('width', width - margin.left - margin.right)
            .attr('height', height - margin.top - margin.bottom)

        this.el.vis.volumeChange =  this.el.vis.group.append('g').classed('volume-change-group', true)
        this.el.vis.recoveryRate =  this.el.vis.group.append('g').classed('recovery-rate-group', true)
    }

    #clearDynamic() {
        this.el.vis.group.selectAll('.ridgeline-group').remove()
    }

    // I. CHART DATA PREPARATION
    #prepareRidgeSeries({ metric, groupBy = 'stream', index = true, sort = 'lastValue', resolver = null, perCapita = false }) {
        const { dataModel } = this.app.module

        const groups = groupBy === 'stream'          ? dataModel.getStreams()
                    : groupBy === 'sector'          ? dataModel.schema.sectors
                    : groupBy === 'both'            ? [...dataModel.schema.sectors, ...dataModel.getStreams()]
                    : groupBy === 'sectorWithTotal' ? [...dataModel.schema.sectors, 'Total']
                    : groupBy === 'total'           ? ['Total']
                    : []

        const defaultResolver = (year, group) => {
            if (group === 'Total') {
                const agg = dataModel.data[year]?.metrics?.Aggregated
                if (metric === 'Generated')         return agg?.generated?.total    ?? 0
                if (metric === 'Recovered - total') return agg?.recovered?.total    ?? 0
                if (metric === 'Disposed')          return agg?.disposed?.total     ?? 0
                if (metric === 'Recovery rate')     return agg?.recoveryRate        ?? 0
                return 0
            }
            if (dataModel.getStreams().includes(group)) {
                const value = dataModel.data[year]?.byStream[group]?.sectors?.['All']?.[metric] ?? 0
                return metric === 'Recovery rate' ? value / 100 : value
            }
            if (dataModel.schema.sectors.includes(group)) {
                const agg = dataModel.data[year]?.metrics?.Aggregated
                if (metric === 'Generated')         return agg?.generated?.bySector?.[group]    ?? 0
                if (metric === 'Recovered - total') return agg?.recovered?.bySector?.[group]    ?? 0
                if (metric === 'Disposed')          return agg?.disposed?.bySector?.[group]     ?? 0
                if (metric === 'Recovery rate') {
                    const recovered = agg?.recovered?.bySector?.[group] ?? 0
                    const generated = agg?.generated?.bySector?.[group] ?? 1
                    return recovered / generated
                }
            }
            return 0
        }

        const getValue = resolver ?? defaultResolver

        const sectorLabel = DataVis.CONFIG.map.sectorLabel ?? {}
        const series = groups.map(group => {
            const raw = dataModel.getYears().map(({ year }) => {
                const value      = getValue(year, group)
                const population = perCapita ? (dataModel.data[year]?.metrics?.lga?.Population || 1) : 1
                return { year, value: value / population }
            })
            const base = index ? (raw[0].value || 1) : 1
            return {
                label:  sectorLabel[group] ?? group,
                values: raw.map(d => ({ year: d.year, value: d.value / base * 100 }))
            }
        })


        const sorted = {
            lastValue:  (a, b) => b.values.at(-1).value - a.values.at(-1).value,
            firstValue: (a, b) => b.values[0].value     - a.values[0].value,
            variance:   (a, b) => {
                const v = s => { const m = d3.mean(s.values, d => d.value); return d3.mean(s.values, d => (d.value - m) ** 2) }
                return v(b) - v(a)
            },
            range:      (a, b) => {
                const r = s => d3.max(s.values, d => d.value) - d3.min(s.values, d => d.value)
                return r(b) - r(a)
            },
            none: null,
        }

        if (sorted[sort]) series.sort(sorted[sort])

        const allValues = series.flatMap(s => s.values.map(v => v.value))
        const yDomain = [
            Math.floor(d3.min(allValues) * 0.9),
            Math.ceil(d3.max(allValues)  * 1.1)
        ]

        return { series, yDomain }
    }

    #prepareSparklineSeries({ metric, groupBy = 'stream', sort = 'none' }) {
        const { dataModel } = this.app.module

        const groups = groupBy === 'stream'  ? dataModel.getStreams()
                    : groupBy === 'sector'  ? dataModel.schema.sectors
                    : groupBy === 'total'   ? ['Total']
                    : []

        const getValue = (year, group) => {
            if (group === 'Total') {
                return dataModel.data[year]?.metrics?.Aggregated?.recoveryRate ?? 0
            }
            if (groupBy === 'stream') {
                return dataModel.data[year]?.byStream[group]?.sectors?.['All']?.['Recovery rate'] ?? 0
            }
            if (groupBy === 'sector') {
                const agg       = dataModel.data[year]?.metrics?.Aggregated
                const recovered = agg?.recovered?.bySector?.[group] ?? 0
                const generated = agg?.generated?.bySector?.[group] ?? 1
                return (recovered / generated) * 100
            }
            return 0
        }

        const sectorLabel = DataVis.CONFIG.map.sectorLabel ?? {}
        const series = groups.map(group => ({
            label:  sectorLabel[group] ?? group,
            values: dataModel.getYears().map(({ year }) => ({
                year,
                value: getValue(year, group)
            }))
        }))

        const sorted = {
            lastValue:  (a, b) => b.values.at(-1).value - a.values.at(-1).value,
            firstValue: (a, b) => b.values[0].value     - a.values[0].value,
            range:      (a, b) => {
                const r = s => d3.max(s.values, d => d.value) - d3.min(s.values, d => d.value)
                return r(b) - r(a)
            },
            none: null,
        }

        if (sorted[sort]) series.sort(sorted[sort])

        const allValues  = series.flatMap(s => s.values.map(v => v.value))
        const yDomain    = [d3.min(allValues), d3.max(allValues)]

        return { series, yDomain }
    }

    // II. CHART RENDERING
    #drawRidgelinePlot(series, config = {}) {

        const cfg = {
            ...JoyVis.CONFIG.ridgeline,
            showAxis:       false,
            axisOnTop:      false,
            title:          null,
            annualised:     true,
            strokeSeries:   null,       
            strokeDomain:   null,       
            strokeRange:    [1, 10],  
            seriesType:    'none',
            labelMap:       {},          
            ...config
        }

        const n        = series.length,
            allYears = series[0].values.map(v => v.year),
            nYears   = allYears.length

        const yDomain = cfg.yDomain ?? [0, d3.max(series.flatMap(s => s.values.map(v => v.value))) * 1.05],
            bandH   = cfg.ridgeHeight,
            step    = bandH * (1 - cfg.overlap),
            plotW   = cfg.width - cfg.marginLeft - cfg.marginRight

        const rootX = cfg.x + cfg.marginLeft,
            rootY = cfg.y + cfg.marginTop

        const titleFs = plotW * 0.075,
            labelFs   = plotW * 0.0475

        // -- Add ridgeline group
        const root = this.el.vis.volumeChange 
            .append('g')
            .classed('ridgeline-group', true)
            .attr('transform', `translate(${rootX}, ${rootY})`)

        // ── Scales ──────────────────────────────────────────────────────────
        this.scale.ridgeX = d3.scalePoint()
            .domain(allYears)
            .range([0, plotW])
            .padding(0.3)

        this.scale.ridgeY = d3.scaleLinear()
            .domain(yDomain)
            .range([bandH, 0])

        this.scale.ridgeThickness = cfg.strokeSeries
            ? d3.scaleLinear()
                .domain(cfg.strokeDomain ?? d3.extent(cfg.strokeSeries.flatMap(s => s.values.map(v => v.value))))
                .range(cfg.strokeRange)
            : null

        // ── Generators ──────────────────────────────────────────────────────
        this.generator.ridgeArea = d3.area()        
            .x(d  => this.scale.ridgeX(d.year))     
            .y0(bandH)      // For band only
            .y1(d => this.scale.ridgeY(d.value))
            .curve(cfg.curve)

        this.generator.ridgeLine = d3.line()
            .x(d => this.scale.ridgeX(d.year))
            .y(d => this.scale.ridgeY(d.value))
            .curve(cfg.curve)

        // ── Title (optional) ────────────────────────────────────────────────────────────
        if (cfg.title) {
            root.append('text')
                .classed('title', true)
                .attr('x', 4)
                .attr('y', 0)
                .attr('font-size', titleFs)
                .text(cfg.title)
        }

        // ── Axis (top) ───────────────────────────────────────────────────────
        this.axis.ridgeX = d3.axisBottom(this.scale.ridgeX)
            .tickFormat(cfg.formatX ?? (d => d))
            .tickSize(4)
            .tickValues(allYears.filter((_, i) => i % 2 === 0))

        if (cfg.showAxis && cfg.axisOnTop) {
            root.append('g')
                .classed('ridge-axis-x', true)
                .attr('transform', `translate(0, ${n * step + bandH})`)
                .call(this.axis.ridgeX)
                .call(g => g.select('.domain').remove())
        }

        // ── Ridges ───────────────────────────────────────────────────────────
        series.forEach((s, i) => {
            // i. Config
            const sc = cfg.seriesType === 'sector' ? DataVis.CONFIG.map.sectorClass[s.label]
                : cfg.seriesType === 'stream' ? DataVis.CONFIG.map.streamClass[s.label] : ''

            const yOff = i * step,
                col  = cfg.colorScheme[i % cfg.colorScheme.length]

            // ii. Ridge area generator to base
            const bottomY = (n - 1) * step + bandH - yOff   // base of lowest band, in local coords
            const ridgeArea = d3.area()
                .x(d  => this.scale.ridgeX(d.year))
                .y0(bottomY)
                .y1(d => this.scale.ridgeY(d.value))
                .curve(cfg.curve)

            // iii. Calculate Percentage change: total or annualised ((end/start) ^ (1/(n-1)) - 1) * 100
            const firstVal      = s.values[0].value,
                lastVal       = s.values.at(-1).value,
                pctChange     = cfg.annualised ? (Math.pow(lastVal / firstVal, 1 / (nYears - 1)) - 1) * 100 : (lastVal / firstVal - 1) * 100,
                sign          = pctChange >= 0 ? '+' : '',
                pctLabel      = `${sign}${pctChange.toFixed(1)}%`

            // iv. Redner ridgeline group: 
            const rg = root.append('g')
                .classed(`ridge ${cfg.seriesType} ${sc}`, true)
                .attr('transform', `translate(0, ${yOff})`)

            // vi. Area
            rg.append('path')
                .datum(s.values)
                .classed(`ridge-area ${cfg.seriesType} ${sc}`, true)
                .attr('d', ridgeArea)

            // vii. Ridgeline with scaled thicknesss
            let strokeW = cfg.strokeWidth

            if (this.scale.ridgeThickness) {
                const matched = cfg.strokeSeries.find(ss => ss.label === s.label)
                if (matched) {
                    const meanVal = d3.mean(matched.values, v => v.value)
                    strokeW = this.scale.ridgeThickness(meanVal)
                }
            }

            rg.append('path')
                .datum(s.values)
                .classed(`ridge-line  ${cfg.seriesType} ${sc}`, true)
                .attr('d', this.generator.ridgeLine)
                .attr('stroke', col)
                .attr('stroke-width', strokeW)


            // viii. Series label: wrapped with line split, capped at two lines
            const displayLabel = cfg.labelMap[s.label] ?? s.label

            const maxChars  = 18,
                words     = displayLabel.split(' '),   // ← use displayLabel not s.label
                lines     = []

            let current   = ''

            for (const word of words) {
                const test = current ? `${current} ${word}` : word
                if (test.length > maxChars && current) {
                    lines.push(current)
                    current = word
                } else {
                    current = test
                }
            }

            if (current) lines.push(current)

            if (lines.length > 2) {
                lines[1] = lines.slice(1).join(' ')
                lines.length = 2
            }

            const wrapped = lines.length > 1,
                fontSize  = wrapped ? labelFs * 0.8 : labelFs,    // 20% smaller if two lines
                lineH     = fontSize * 1.2,
                totalH    = lines.length * lineH,
                startY    = this.scale.ridgeY(s.values[0].value) - totalH / 2

            const labelEl = rg.append('text')
                .classed('ridge-label start', true)
                .attr('x', -fontSize)
                .attr('font-size', fontSize)

            lines.forEach((line, li) => {
                labelEl.append('tspan')
                    .attr('x', -8)
                    .attr('y', startY + li * lineH)
                    .attr('dy', fontSize * 0.5 )
                    .text(line)
            })

            // End label — % change (abs of pa)
            rg.append('text')
                .classed('ridge-label ridge-label-end', true)
                .attr('x', plotW + fontSize)
                .attr('y', this.scale.ridgeY(lastVal))
                .attr('font-size', labelFs)
                .text(`${pctLabel}`)
        })

        // ── Axis (bottom) ────────────────────────────────────────────────────
        if (cfg.showAxis && !cfg.axisOnTop) {
            root.append('g')
                .classed('ridge-axis-x', true)
                .attr('transform', `translate(0, ${n * step + bandH - cfg.marginTop * 0.75})`)
                .call(this.axis.ridgeX)
                .call(g => g.select('.domain').remove())
        }
    }

    #drawSparkline(series, cell, config = {}) {
        // i., Config and layout
        const cfg = {
            showValues:         false,
            showDates:          false,
            yDomain:            null,
            strokeColor:        '#262626',
            strokeWidth:        1,
            curve:              d3.curveCatmullRom.alpha(0.5),
            formatValue:        v => v.toFixed(1) + '%',
            labelPad:           4,
            labelMap:       {},   
            ...config,
        }

        const { x, y, width, height } = cell
        const values = series.values

        // Reserve vertical space for labels if needed
        const labelH    = (cfg.showValues || cfg.showDates) ? 4 : 0
        const plotH     = height - labelH
        const plotPadX  = 2

        // ii. Scales
        const xScale = d3.scalePoint()
            .domain(values.map(d => d.year))
            .range([plotPadX, width - plotPadX])

        const yDomain = cfg.yDomain ?? d3.extent(values, d => d.value)
        const yScale  = d3.scaleLinear()
            .domain(yDomain)
            .range([plotH, 0])

        // iii. Generators
        const area = d3.area()
            .x(d => xScale(d.year))
            .y0(plotH)
            .y1(d => yScale(d.value))
            .curve(cfg.curve)

        const line = d3.line()
            .x(d => xScale(d.year))
            .y(d => yScale(d.value))
            .curve(cfg.curve)


        // iv. Add SVG gropu
        const g = this.el.vis.recoveryRate
            .append('g')
            .classed('sparkline', true)
            .attr('transform', `translate(${x}, ${y})`)

        // v. Area fill
        g.append('path')
            .datum(values)
            .classed('sparkline-area', true)
            .attr('d', area)

        // Line
        g.append('path')
            .datum(values)
            .classed('sparkline-line', true)
            .attr('d', line)
            .attr('stroke-width', plotH * 0.035)

        // Stream/sector label 
        const seriesFs  = width * 0.08,
            labelFs     = width * 0.08

        g.append('text')
            .classed('sparkline-title', true)
            .attr('x', width / 2)
            .attr('y', plotH + labelH + cfg.labelPad)
            .attr('font-size', seriesFs)
            .text(cfg.labelMap[series.label] ?? series.label)

        // Value and date labels (both optional)
        if (cfg.showValues) {
            const first = values[0], last = values.at(-1)
            g.append('text')
                .classed('sparkline-value start', true)
                .attr('x', xScale(first.year))
                .attr('y', yScale(first.value))
                .attr('dy', -labelFs * 0.5)
                .attr('font-size', labelFs * 0.8)
                .text(cfg.formatValue(first.value))

            g.append('text')
                .classed('sparkline-value end', true)
                .attr('x', xScale(last.year))
                .attr('y', yScale(last.value))
                .attr('dy', -labelFs * 0.5)
                .attr('font-size', labelFs)
                .text(cfg.formatValue(last.value))
        }

        if (cfg.showDates) {
            const first = values[0], last = values.at(-1)

            g.append('text')
                .classed('sparkline-date start', true)
                .attr('x', xScale(first.year))
                .attr('y', plotH + cfg.labelPad)
                .attr('font-size', labelFs)
                .text(first.year)

            g.append('text')
                .classed('sparkline-date end', true)
                .attr('x', xScale(last.year))
                .attr('y', plotH + cfg.labelPad)
                .attr('font-size', labelFs)
                .text(last.year)
        }
    }

    // III. SPARKLINE LAYOUT 
    #makeGrid(count, { x = 0, y = 0, width, height, cols = null, padX = 12, padY = 12 }) {
        const numCols  = cols ?? Math.ceil(Math.sqrt(count))
        const numRows  = Math.ceil(count / numCols)
        const cellW    = (width  - padX * (numCols - 1)) / numCols
        const cellH    = (height - padY * (numRows - 1)) / numRows

        return Array.from({ length: count }, (_, i) => {
            const col = i % numCols
            const row = Math.floor(i / numCols)
            return {
                x:      x + col * (cellW + padX),
                y:      y + row * (cellH + padY),
                width:  cellW,
                height: cellH,
            }
        })
    }

    // Titles and labels
    #addVolumeTitles(rowY){
        const { width, height, margin } = DataVis.CONFIG.dims,
            canvasWidth  = width  - margin.left - margin.right,
            canvasHeight = height - margin.top  - margin.bottom

        const titleFs   = canvasWidth * 0.0225,
            subtitleFs  = canvasWidth * 0.015,
            sectionFs   = canvasWidth * 0.0125

        const titleG = this.el.annotation.group.append('g')
            .classed('volume-change-annotation', true)
            .attr('transform', `translate(${margin.left}, ${margin.top})`)

        titleG.append('text')
            .classed('volume-change title', true)
            .attr('x', canvasWidth * 0.5)
            .style('font-size', titleFs)
            .text(`How the volumes of Victoria's waste have evolved`)

        titleG.append('text')
            .classed('volume-change subtitle', true)
            .attr('x', canvasWidth * 0.25)
            .attr('y', canvasHeight * 0.05)
            .style('font-size', subtitleFs)
            .text('Generated waste')

        titleG.append('text')
            .classed('volume-change subtitle', true)
            .attr('x', canvasWidth * 0.75)
            .attr('y', canvasHeight * 0.05)
            .style('font-size', subtitleFs)
            .text('Recovered waste')


        titleG.append('text')
            .classed('volume-change section', true)
            .attr('x', canvasWidth * 0.5)
            .attr('y', rowY.B)
            .style('font-size', sectionFs)
            .text('By sector')

        titleG.append('text')
            .classed('volume-change section', true)
            .attr('x', canvasWidth * 0.5)
            .attr('y', rowY.C)
            .style('font-size', sectionFs)
            .text('By material')

        // Section divider lines
        titleG.append('line')
            .classed('section-divider', true)
            .attr('x1', canvasWidth * 0.5)
            .attr('x2', canvasWidth * 0.5)
            .attr('y1', rowY.B + sectionFs)
            .attr('y2', rowY.C - sectionFs * 2.5)


        titleG.append('line')
            .classed('section-divider', true)
            .attr('x1', canvasWidth * 0.5)
            .attr('x2', canvasWidth * 0.5)
            .attr('y1', rowY.C +sectionFs)
            .attr('y2',  rowY.D)

    }

    #addRecoveryRateTitles(rowY){
        const { width, height, margin } = DataVis.CONFIG.dims,
            canvasWidth  = width  - margin.left - margin.right,
            canvasHeight = height - margin.top  - margin.bottom

        const titleFs   = canvasWidth * 0.0225,
            subtitleFs  = canvasWidth * 0.0175,
            sectionFs    = canvasWidth * 0.0125

        const titleG = this.el.annotation.group.append('g')
            .classed('recovery-rate-annotation', true)
            .attr('transform', `translate(${margin.left}, ${margin.top + canvasHeight * 0.545})`)

        const row1Y = canvasHeight * 0.1
        const row2Y = canvasHeight * 0.25
        const xStart = canvasWidth * 0.125
        const xEnd = canvasWidth * (1 - 0.125)

        titleG.append('text')
            .classed('recovery-rate title', true)
            .attr('x', canvasWidth * 0.5)
            .attr('y', canvasHeight * 0.05)
            .style('font-size', titleFs)
            .text(`How have waste recovery rates evolved`)

        titleG.append('text')
            .classed('recovery-rate section', true)
            .attr('x', xStart)
            .attr('y', row1Y)
            .style('font-size', sectionFs)
            .text('All waste')

        titleG.append('text')
            .classed('recovery-rate  section', true)
            .attr('x', canvasWidth * 0.33)
            .attr('y', row1Y)
            .style('font-size', sectionFs)
            .text('By sector')

        titleG.append('text')
            .classed('recovery-rate  section', true)
            .attr('x', canvasWidth * 0.125)
            .attr('y', row2Y)
            .style('font-size', sectionFs)
            .text('By material')

        // Section divider lines
        titleG.append('line')
            .classed('section-divider', true)
            .attr('x1', canvasWidth * 0.4)
            .attr('x2', xEnd)
            .attr('y1', row1Y)
            .attr('y2', row1Y)


        titleG.append('line')
            .classed('section-divider', true)
            .attr('x1', canvasWidth * 0.21)
            .attr('x2', xEnd)
            .attr('y1', row2Y)
            .attr('y2', row2Y)

    }


    //////////////////////////
    ////  PUBLIC METHODS  ////
    //////////////////////////

    update() {
        const { dataModel } = this.app.module
        const data = dataModel.data[this.app.state.select.year]
        if (!data) return console.warn(`No data for year ${this.app.state.select.year}`)

        this.#clearDynamic()
    }

    render() {
        const { width, height, margin } = DataVis.CONFIG.dims
        const canvasWidth  = width  - margin.left - margin.right
        const canvasHeight = height - margin.top  - margin.bottom

        ////////////////////////
        /// RIDEGELINE PLOTS ///
        ////////////////////////

        const colW = canvasWidth * 0.4
        const colX = { 
            left:   margin.left, 
            right:  width * 0.5 
        }

        const rowY = { 
            A:    margin.top + canvasHeight * 0.045, 
            B:    margin.top + canvasHeight * 0.125, 
            C:    margin.top + canvasHeight * 0.25, 
            D:    margin.top + canvasHeight * 0.475, 
        }

        // ── I. Labels and titles ────────────────────────────────────────────────

        this.#addVolumeTitles(rowY)

        // ── IIa. Data for plots: indexed series ───────────────────────────────────
        const { series: generatedTotal,    yDomain: ydGenTotal }    = this.#prepareRidgeSeries({ metric: 'Generated',         groupBy: 'total',  sort: 'none',      perCapita: true })
        const { series: generatedSector,   yDomain: ydGenSector }   = this.#prepareRidgeSeries({ metric: 'Generated',         groupBy: 'sector', sort: 'lastValue', perCapita: true })
        const { series: generatedStream,   yDomain: ydGenStream }   = this.#prepareRidgeSeries({ metric: 'Generated',         groupBy: 'stream', sort: 'lastValue', perCapita: true })
        const { series: recoveredTotal,    yDomain: ydRecTotal }    = this.#prepareRidgeSeries({ metric: 'Recovered - total', groupBy: 'total',  sort: 'none',      perCapita: true })
        const { series: recoveredSector,   yDomain: ydRecSector }   = this.#prepareRidgeSeries({ metric: 'Recovered - total', groupBy: 'sector', sort: 'lastValue', perCapita: true })
        const { series: recoveredStream,   yDomain: ydRecStream }   = this.#prepareRidgeSeries({ metric: 'Recovered - total', groupBy: 'stream', sort: 'lastValue', perCapita: true })

        // ── IIb.Data => create shared stroke domain (uese raw, unindexed data) ───
        const { series: strokeGenTotal }   = this.#prepareRidgeSeries({ metric: 'Generated',         groupBy: 'total',  index: false, sort: 'none' })
        const { series: strokeGenSector }  = this.#prepareRidgeSeries({ metric: 'Generated',         groupBy: 'sector', index: false, sort: 'none' })
        const { series: strokeGenStream }  = this.#prepareRidgeSeries({ metric: 'Generated',         groupBy: 'stream', index: false, sort: 'none' })
        const { series: strokeRecTotal }   = this.#prepareRidgeSeries({ metric: 'Recovered - total', groupBy: 'total',  index: false, sort: 'none' })
        const { series: strokeRecSector }  = this.#prepareRidgeSeries({ metric: 'Recovered - total', groupBy: 'sector', index: false, sort: 'none' })
        const { series: strokeRecStream }  = this.#prepareRidgeSeries({ metric: 'Recovered - total', groupBy: 'stream', index: false, sort: 'none' })

        const sharedStrokeDomain = d3.extent([
            ...strokeGenTotal,  ...strokeGenSector,  ...strokeGenStream,
            ...strokeRecTotal,  ...strokeRecSector,  ...strokeRecStream,
        ].flatMap(s => s.values.map(v => v.value)))

        // ── III. Draw plots by type ───────────────────────────────────────────────

        //// Co1. Left |  Row B. Generated total 
        this.#drawRidgelinePlot(generatedTotal, {
            x: colX.left,   y: rowY.A,          width: colW,            
            ridgeHeight:    100,                overlap:        0.75,
            strokeSeries:   strokeGenTotal,     seriesType:     'total',
            yDomain:        ydGenTotal,         strokeDomain:   sharedStrokeDomain,
            labelMap:       { 'Total': 'Victoria' }
        })

        // ── Co1. Left | Row C. Generated by sector ────────────────────────────────
        this.#drawRidgelinePlot(generatedSector, {
            x: colX.left,   y: rowY.B,          width: colW,
            ridgeHeight:    55,                 overlap:        0.35,
            strokeSeries:   strokeGenSector,    seriesType:     'sector',
            yDomain:        ydGenSector,        strokeDomain:   sharedStrokeDomain            
        })

        // ── Co1. Left | Row D. Generated by stream ────────────────────────────────
        this.#drawRidgelinePlot(generatedStream, {
            x: colX.left,   y: rowY.C,          width: colW,
            ridgeHeight:    100,                overlap:        0.75,
            strokeSeries:   strokeGenStream,    seriesType:     'stream',        
            yDomain:        ydGenStream,        strokeDomain:   sharedStrokeDomain,
            showAxis:       true
        })

        // ── Co1. Right | Row B. Recovered total ────────────────────────────────────
        this.#drawRidgelinePlot(recoveredTotal, {
            x: colX.right,  y: rowY.A,          width: colW,
            ridgeHeight:    100,                overlap:        0.75,
            strokeSeries:   strokeRecTotal,     seriesType:     'total',
            yDomain:        ydRecTotal,         strokeDomain:   sharedStrokeDomain,
            labelMap:       { 'Total': 'Victoria' }
        })

        // ── Co1. Right | Row C. Recovered by sector ────────────────────────────────
        this.#drawRidgelinePlot(recoveredSector, {
            x: colX.right,  y: rowY.B,          width: colW,
            ridgeHeight:    80,                 overlap:        0.6,
            strokeSeries:   strokeRecSector,    seriesType:      'total',
            yDomain:        ydRecSector,        strokeDomain:   sharedStrokeDomain
        })

        // ── Co1. Right | Row D. Recovered by stream ────────────────────────────────
        this.#drawRidgelinePlot(recoveredStream, {
            x: colX.right,  y: rowY.C,          width: colW,
            ridgeHeight:    100,                overlap:        0.75,
            strokeSeries:   strokeRecStream,    seriesType:    'stream',
            yDomain:        ydRecStream,        strokeDomain:   sharedStrokeDomain,
            showAxis:       true
        })

        /////////////////////////////////
        /// RECOVERY RATE SPARKLINES  ///
        /////////////////////////////////

        // ── I. Date by total, sector and stream ─────────────────────────────────────────
        const totalSpark   = this.#prepareSparklineSeries({ metric: 'Recovery rate', groupBy: 'total' })
        const streamSpark  = this.#prepareSparklineSeries({ metric: 'Recovery rate', groupBy: 'stream' })
        const sectorSpark  = this.#prepareSparklineSeries({ metric: 'Recovery rate', groupBy: 'sector' })

        // II. Get domain for all series
        const allSparkSeries = [...totalSpark.series, ...sectorSpark.series, ...streamSpark.series],
            allSparkValues   = allSparkSeries.flatMap(s => s.values.map(v => v.value)),
            sparkYDomain     = [d3.min(allSparkValues)*0, d3.max(allSparkValues)]

        // III. Grid layout: split into 1. total + sector | 2. Streams
        const gridConfig = {
            noCols:     4, 
            width:      canvasWidth * 0.75,
            rowHeight:  canvasHeight * 0.08,
            padX:       canvasWidth * 0.075,
            padY:       canvasWidth * 0.05
        }

        gridConfig.xPos = margin.left + (canvasWidth * 0.5 - gridConfig.width * 0.5)      // Centered

        const grid1Series   = [...totalSpark.series, ...sectorSpark.series]

        const sparkCells1 = this.#makeGrid(grid1Series.length, {
            x:       gridConfig.xPos ,
            y:       margin.top + canvasHeight * 0.675,
            width:   gridConfig.width,
            height:  gridConfig.rowHeight,
            cols:    gridConfig.noCols,
            padX:    gridConfig.padX,
            padY:    gridConfig.padY
        })

        const streamCells = this.#makeGrid(streamSpark.series.length, {
            x:       gridConfig.xPos ,
            y:       margin.top + canvasHeight * 0.825,
            width:   gridConfig.width,
            height:  gridConfig.rowHeight * 2,
            cols:    gridConfig.noCols,
            padX:    gridConfig.padX,
            padY:    gridConfig.padY
        })


        // IV. Render grids
        grid1Series.forEach((s, i) => {

            this.#drawSparkline(s, sparkCells1[i], {
                yDomain:     sparkYDomain,
                showValues:  true,
                showDates:   false,
                formatValue: v => Math.round(v) + '%',
                labelMap:       { 'Total': 'Victoria' },
                seriesType:   i > 0 ?  'sector' : null,
            })
        })

        streamSpark.series.forEach((s, i) => {
            this.#drawSparkline(s, streamCells[i], {
                yDomain:     sparkYDomain,
                showValues:  true,
                showDates:   false,
                formatValue: v => Math.round(v) + '%',
            })
        })


        // IV. Add titles and labels
        this.#addRecoveryRateTitles()




    }
}