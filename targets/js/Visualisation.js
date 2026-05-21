// Libs and data
import * as d3      from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import { util }     from "../../_shared/js/util.js";

// Classes
import { DataVis } from "../../_shared/js/DataVis.js";


// => Data Visualisation class
export class TargetsVis extends DataVis {

    //////////////////////////////////
    //// STATIC CONFIG & HELPERS  ////
    //////////////////////////////////

    static CONFIG = {
        year:{
            baseline:  2020,    target: 2030
        },
        target:{
            1: {
                label: {
                    short: 'Increase waste recovery to 80% of collected waste'
                },
                description: `Divert 80 per cent of waste from landfill by 2030,and an interim target of 72 per cent by 2025.`,

                detail: {
                    baseline:  {year: 2020 },
                    interim:   {year: 2025, target: 72, unit: '%' },
                    final:     {year: 2030, target: 80, unit: '%' }
                }
            },
            2: {
                label: {
                    short: 'Reduce total waste generation by 15% per capita'
                },
                description: `Cut total waste generation by 15 per cent per capita by 2030.`,

                detail: {
                    baseline:  {year: 2020 },
                    final:     {year: 2030, target: 0.85, type: 'reduction',  unit: 'tonnes per capita' }
                }
            },

            3: {
                label: {
                    short: 'Reduce organic material by going to landfill by 50%'
                },
                description: `Halve the volume of organic material going to landfill between 2020 and 2030, with an interim target of 20 per cent reduction by 2025.`,

                detail: {
                    baseline:  {year: 2020 },
                    interim:   {year: 2025, target: 20,  type: 'reduction', unit: '%' },
                    final:     {year: 2030, target: 50,  type: 'reduction', unit: '%' }
                }
            },

            4: {
                label: {
                    short: 'All households have access to food and organic waste services or composting'
                },
                description: `Ensure every Victorian household has access to food and garden organic waste recycling services or local composting by 2030.`,

                detail: {
                    baseline:  {year: 2020 },
                    final:     {year: 2030, target: 100,  unit: '%' }
                }
            }
        }
    }

    static TARGET_CONFIG = {
        '1': {
            corner:         'bottom-right',
            reverseArc:     false,
            arcGroupOffset: (w, h) => ({ x: w, y: h }),
            arcOrigin:      (x, w, y, h) => ({ x: x + w, y: y + h }),
            titleAlign:     'left',
            titlePos:       (w, h) => ({ x: w * 0.075, y: h * 0.1 }),
            titleWrap:      w => w * 0.6,
            getScaleDomain: (targetMeta, data) => {
                const baseline = targetMeta.detail.final.target - 2 * (targetMeta.detail.final.target - targetMeta.detail.interim.target)
                return { baselineValue: baseline, targetValue: targetMeta.detail.final.target }
            },
            hasInterim:     true,
            getInterimR:    (targetMeta, targetScale) => targetScale(targetMeta.detail.interim.target),
            getDataCircleR: (d, targetScale) => targetScale(d.recoveryRate),
            getArcConfigs:  (targetMeta, targetScale, targetRadius, baselineRadius, latest, w) => [
                {
                    id:        'target',
                    r:         targetRadius,
                    fs:        w * 0.035,
                    dy:        -w * 0.05,
                    label:     `Targeting an ${targetMeta.detail.final.target}% recovery rate`,
                    className: `arc-label target target-1`,
                    offset:    '50%'
                },
                {
                    id:        'interim',
                    r:         targetScale(targetMeta.detail.interim.target),
                    fs:        w * 0.02,
                    dy:        -w * 0.0125,
                    label:     `${targetMeta.detail.interim.year} target ${targetMeta.detail.interim.target}%`,
                    className: `arc-label interim-target target-1`,
                    offset:    '50%'
                },
                {
                    id:        'data',
                    r:         targetScale(latest.recoveryRate),
                    fs:        w * 0.03,
                    dy:        w * 0.0075,
                    label:     `${latest.recoveryRate}% in ${latest.year}`,
                    className: `arc-label data target-1`,
                    offset:    '50%'
                },
                {
                    id:        'baseline',
                    r:         baselineRadius,
                    fs:        w * 0.015,
                    dy:        0,
                    label:     '',
                    className: `arc-label arc-label-baseline target-1`,
                    offset:    '50%'
                },
            ],
        },
        '2': {
            corner:         'bottom-left',
            reverseArc:     false,
            arcGroupOffset: (w, h) => ({ x: 0, y: h }),
            arcOrigin:      (x, w, y, h) => ({ x: x, y: y + h }),
            titleAlign:     'right',
            titlePos:       (w, h) => ({ x: w - w * 0.075, y: h * 0.1 }),
            titleWrap:      w => w * 0.55,
            getScaleDomain: (targetMeta, data) => {
                const baselineValue = data[0].totalGeneration / data[0].population
                return { baselineValue, targetValue: baselineValue * targetMeta.detail.final.target }
            },
            hasInterim:     false,
            getDataCircleR: (d, targetScale) => targetScale(d.totalGeneration / d.population),
            getArcConfigs:  (targetMeta, targetScale, targetRadius, baselineRadius, latest, w, fmt, baselineValue, targetValue, data) => [
                {
                    id:        'target',
                    r:         targetRadius,
                    fs:        w * 0.035,
                    dy:        -w * 0.05,
                    label:     `Targeting ${fmt(targetValue)} tonnes per capita`,
                    className: `arc-label target target-2`,
                    offset:    '50%'
                },
                {
                    id:        'data',
                    r:         targetScale(latest.totalGeneration / latest.population),
                    fs:        w * 0.03,
                    dy:        w * 0.0075,
                    label:     `${fmt(latest.totalGeneration / latest.population)} t per capita in ${latest.year}`,
                    className: `arc-label data target-2`,
                    offset:    '50%'
                },
                {
                    id:        'baseline',
                    r:         baselineRadius,
                    fs:        w * 0.0175,
                    dy:        w * 0.0225,
                    label:     `${fmt(baselineValue)} t per capita in ${data[0].year}`,
                    className: `arc-label arc-label-baseline target-2`,
                    offset:    '50%'
                },
            ],
        },
        '3': {
            corner:         'top-left',
            reverseArc:     true,
            arcGroupOffset: (w, h) => ({ x: 0, y: 0 }),
            arcOrigin:      (x, w, y, h) => ({ x: x, y: y }),
            titleAlign:     'right',
            titlePos:       (w, h) => ({ x: w - w * 0.075, y: h - h * 0.225 }),
            titleWrap:      w => w * 0.65,
            getScaleDomain: (targetMeta, data) => {
                const baselineValue = data[0].landfillOrganics / 1000000
                return { baselineValue, targetValue: baselineValue * (1 - targetMeta.detail.final.target / 100) }
            },
            hasInterim:     true,
            getInterimR:    (targetMeta, targetScale, baselineValue) =>
                                targetScale(baselineValue * (1 - targetMeta.detail.interim.target / 100)),
            getDataCircleR: (d, targetScale) => targetScale(d.landfillOrganics / 1000000),
            getArcConfigs:  (targetMeta, targetScale, targetRadius, baselineRadius, latest, w, fmt, baselineValue, targetValue, data) => [
                {
                    id:        'target',
                    r:         targetRadius,
                    fs:        w * 0.035,
                    dy:        -w * 0.05,
                    label:     `Targeting ${fmt(targetValue)} million tonnes to landfill annually`,
                    className: `arc-label target reverse target-3`,
                    offset:    '50%'
                },
                {
                    id:        'interim',
                    r:         targetScale(baselineValue * (1 - targetMeta.detail.interim.target / 100)),
                    fs:        w * 0.02,
                    dy:        -w * 0.025,
                    label:     `${targetMeta.detail.interim.year} target ${targetMeta.detail.interim.target}%`,
                    className: `arc-label interim-target reverse target-3`,
                    offset:    '50%'
                },
                {
                    id:        'data',
                    r:         targetScale(latest.landfillOrganics / 1000000),
                    fs:        w * 0.03,
                    dy:        w * 0.0075,
                    label:     `${fmt(latest.landfillOrganics / 1000000)} Mt in ${latest.year}`,
                    className: `arc-label data reverse target-3`,
                    offset:    '50%'
                },
                {
                    id:        'baseline',
                    r:         baselineRadius,
                    fs:        w * 0.0175,
                    dy:        w * 0.01,
                    label:     `${fmt(baselineValue)} Mt in ${data[0].year}`,
                    className: `arc-label baseline reverse target-3`,
                    offset:    '50%'
                },
            ],
        },
        '4': {
            corner:         'top-right',
            reverseArc:     true,
            arcGroupOffset: (w, h) => ({ x: w, y: 0 }),
            arcOrigin:      (x, w, y, h) => ({ x: x + w, y: y }),
            titleAlign:     'left',
            titlePos:       (w, h) => ({ x: w * 0.075, y: h - h * 0.3 }),
            titleWrap:      w => w * 0.65,
            getScaleDomain: (targetMeta, data) => {
                const baselineValue = data[0].noKerbsideOrganics / data[0].noCouncils * 100
                return { baselineValue, targetValue: targetMeta.detail.final.target }
            },
            hasInterim:     false,
            getDataCircleR: (d, targetScale) => targetScale(d.noKerbsideOrganics / d.noCouncils * 100),
            getArcConfigs:  (targetMeta, targetScale, targetRadius, baselineRadius, latest, w, fmt, baselineValue, targetValue, data) => [
                {
                    id:        'target',
                    r:         targetRadius,
                    fs:        w * 0.035,
                    dy:        -w * 0.05,
                    label:     `Targeting ${fmt(targetValue)}% access to FOGO services`,
                    className: `arc-label reverse target target-4`,
                    offset:    '50%'
                },
                {
                    id:        'data',
                    r:         targetScale(latest.noKerbsideOrganics / latest.noCouncils * 100),
                    fs:        w * 0.03,
                    dy:        w * 0.0075,
                    label:     `${fmt(latest.noKerbsideOrganics / latest.noCouncils * 100)}% in ${latest.year}`,
                    className: `arc-label data reverse target-4`,
                    offset:    '50%'
                },
                {
                    id:        'baseline',
                    r:         baselineRadius,
                    fs:        w * 0.0175,
                    dy:        w * 0.01,
                    label:     `${fmt(baselineValue)}% in ${data[0].year}`,
                    className: `arc-label baseline reverse target-4`,
                    offset:    '50%'
                },
            ],
        }
    }

    static buildTrendSeries(data, baselineYear) {
        return Object.values(data)
            .filter(d => d.year >= baselineYear)
            .sort((a, b) => a.year - b.year)
            .map(d => ({
                year:               d.year,
                recoveryRate:       d.metrics.Aggregated.recoveryRate,
                noCouncils:         d.metrics.count.councils,
                noKerbsideOrganics: d.metrics.count.kerbside_organics_fogo?.Yes ?? 0,
                totalGeneration:    d.metrics.Aggregated.generated.total,
                population:         d.metrics.lga.Population,
                landfillOrganics:   d.metrics.Aggregated.disposed.byStream?.['Organics'] ?? 0,
            }))
    }

    static quarterArcPath = (r, corner = 'bottom-right') => {
        const corners = {
            'bottom-right': { start: [-r, 0],  end: [0, -r],  sweep: 1 },
            'bottom-left':  { start: [0, -r],  end: [r, 0],   sweep: 1 },
            'top-right':    { start: [0, r],   end: [-r, 0],  sweep: 1 },
            'top-left':     { start: [r, 0],   end: [0, r],   sweep: 1 },
        };
        const { start, end, sweep } = corners[corner];
        return `M ${start[0]} ${start[1]} A ${r} ${r} 0 0 ${sweep} ${end[0]} ${end[1]}`;
    }

    static quarterArcPathReverse(r, corner = 'bottom-right') {
        // Get the forward path, then reverse it by swapping start/end and flipping sweep
        const corners = {
            'bottom-right': { start: [0, -r], end: [-r, 0], sweep: 0 },
            'bottom-left':  { start: [r,  0], end: [0, -r], sweep: 0 },
            'top-left':     { start: [0,  r], end: [r,  0], sweep: 0 },
            'top-right':    { start: [-r, 0], end: [0,  r], sweep: 0 },
        };
        const { start, end, sweep } = corners[corner];
        return `M ${start[0]} ${start[1]} A ${r} ${r} 0 0 ${sweep} ${end[0]} ${end[1]}`;
    }


    /////////////////
    //// FIELDS  ////
    /////////////////

    state = {
        mode:   'inner'  // 'inner' | 'outer
    }

    // SVG ELEMENTS
    el = {
        svg:            undefined,
        defs:           undefined,
        vis: {
            group:      undefined,
        },
        illustration: {
            group:      undefined
        },
        legend: {
            group:      undefined
        },
        annotation: {
            group:      undefined
        },
        tooltip: {
            group:       undefined,
            treemap:     undefined
        }
    }


    /////////////////////
    //// CONSTRUCTOR ////
    /////////////////////

    constructor(app, queryConfig) {
        super(app)

        // Init and render vis
        this.#initVis()         // Setup of visualisation components

        // Build target data
        this.targetData =  TargetsVis.buildTrendSeries(app.module.dataModel.data,  TargetsVis.CONFIG.year.baseline)

        this.render()           

        console.log(this)
    }


    ///////////////////////////
    ////  PRIVATE METHODS  ////
    ///////////////////////////

    #initVis() {
        // I. SVG CANVAS
        const { width, height, margin } = DataVis.CONFIG.dims
        const svg = this.el.svg = d3.select('svg#data-vis')
            .attr('viewBox', [0, 0, width, height])
            .classed('svg-vis', true)

        const defs = this.el.defs = svg.select('defs') ?? svg.append('defs')

        // II. VIS GROUPS
        const visGroup = this.el.vis.group = svg.append('g').classed('vis-group', true)

        // III. ANNOTATION
        const annotationGroup = this.el.annotation.group = svg.append('g').classed('annotation-group', true)
    }

    #renderTargets(layout, options = {}) {
        const { width, height, margin } = DataVis.CONFIG.dims,
            canvasWidth  = width  - margin.left - margin.right,
            canvasHeight = height - margin.top  - margin.bottom

        this.el.defs.append('clipPath')
            .attr('id', 'clip-target')
            .append('rect')
                .attr('width',  canvasWidth  * 0.5)
                .attr('height', canvasHeight * 0.5)

        const hw = canvasWidth * 0.5,
            hh = canvasHeight * 0.5

        // Render targets
        this.#renderTarget('1', { x: margin.left,  y: margin.top,   width: hw, height: hh })
        this.#renderTarget('2', { x: width * 0.5,  y: margin.top,   width: hw, height: hh })
        this.#renderTarget('3', { x: width * 0.5,  y: height * 0.5, width: hw, height: hh })
        this.#renderTarget('4', { x: margin.left,  y: height * 0.5, width: hw, height: hh })
    }

    #renderTarget(targetNum, layout) {
        const { x, y, width: w, height: h } = layout

        const cfg           = TargetsVis.TARGET_CONFIG[targetNum]
        const targetMeta    = TargetsVis.CONFIG.target[targetNum]
        const targetClass   = `target-${targetNum}`
        const latest        = this.targetData[this.targetData.length - 1]
        const fmt           = d3.format(targetNum === '4' ? '0.0f' : '0.2f')
        const arcRotation   = {1: 270, 2: 0, 3: 90, 4: 180}
        const isOuter       = this.state.mode === 'outer' ? true : false

        const outerRadius = w * 0.65,
            innerRadius  = w * 0.25

        // I. SCALE
        const { baselineValue, targetValue } = cfg.getScaleDomain(targetMeta, this.targetData)

        const targetRadius = isOuter ? innerRadius : outerRadius,
            baselineRadius = isOuter ? outerRadius : innerRadius

        const targetScale = d3.scaleLinear()
            .domain([baselineValue, targetValue])
            .range([baselineRadius, targetRadius])

        // II. SVG GROUP
        const g = this.el.vis.group.append('g')
            .classed(`${targetClass}-group target-group`, true)
            .attr('transform', `translate(${x}, ${y})`)
            .attr('clip-path', 'url(#clip-target)')

        g.append('rect')
            .classed(`block-bg ${targetClass}`, true)
            .attr('width', w)
            .attr('height', h)

        // III. CIRCLES / ARCS
        const { x: gx, y: gy } = cfg.arcGroupOffset(w, h)

        const arcGroup = g.append('g')
            .classed('center-arc-group', true)
            .attr('transform', `translate(${gx}, ${gy})`)

        arcGroup.append('circle')
            .classed(`target-label ${targetClass}`, true)
            .attr('r', outerRadius + w * 0.1)

        arcGroup.append('circle')
            .classed(`target-area ${targetClass}`, true)
            .attr('r', outerRadius)



        if (cfg.hasInterim) {
            arcGroup.append('circle')
                .classed(`target-interim-arc ${targetClass}`, true)
                .attr('r', cfg.getInterimR(targetMeta, targetScale, baselineValue))
        }
   

        this.targetData.forEach((d, i) => {
            const isLatest = i === this.targetData.length - 1

            if(isOuter){
                const dataRadius = cfg.getDataCircleR(d, targetScale) 

                if(outerRadius > dataRadius){
                    arcGroup.append("path")
                        .attr('transform', `rotate(${arcRotation[targetNum]})`)
                        .classed(`data-arc year-${d.year} ${isLatest ? 'latest' : ''}`, true)
                            .attr("d", d3.arc()({
                                innerRadius: dataRadius,
                                outerRadius: outerRadius - 20,
                                startAngle: 0,
                                endAngle: Math.PI / 2
                            }));
                }

            } else {
                arcGroup.append('circle')
                    .classed(`data-circle year-${d.year} ${isLatest ? 'latest' : ''}`, true)
                    .attr('r', cfg.getDataCircleR(d, targetScale))
            }

        })

        arcGroup.append('circle')
            .classed(`baseline-arc-bg ${targetClass}`, true)
            .attr('r', innerRadius)


        arcGroup.append('circle')
            .classed(`inner-target-bg ${targetClass}`, true)
            .attr('r', innerRadius * 0.65)


        // IV. TITLE
        const titlePos = cfg.titlePos(w, h)
        g.append('g')
            .classed(`annotation-group ${targetClass}`, true)
            .append('text')
                .classed(`target-header ${cfg.titleAlign}`, true)
                .attr('transform', `translate(${titlePos.x}, ${titlePos.y})`)
                .style('font-size', w * 0.055)
                .text(targetMeta.label.short)
                .call(util.wrapText, cfg.titleWrap(w))

        // V. ARC LABELS
        const { x: ox, y: oy } = cfg.arcOrigin(x, w, y, h)
        const arcFn = cfg.reverseArc ? TargetsVis.quarterArcPathReverse : TargetsVis.quarterArcPath

        const arcConfigs = cfg.getArcConfigs(
            targetMeta, targetScale, outerRadius, baselineRadius,
            latest, w, fmt, baselineValue, targetValue, this.targetData
        )

        arcConfigs.forEach(({ id, r, dy }) => {
            this.el.defs.append('path')
                .attr('id', `arc-${id}-${targetClass}`)
                .attr('d', arcFn(r - dy, cfg.corner))
                .attr('transform', `translate(${ox}, ${oy})`)
        })

        const labelGroup = this.el.vis.group.append('g')
            .classed(`arc-label-group ${targetClass}`, true)

        arcConfigs.forEach(({ id, label, fs, offset, className }) => {
            labelGroup.append('text')
                .classed(className, true)
                .style('font-size', fs)
                .append('textPath')
                    .attr('href', `#arc-${id}-${targetClass}`)
                    .attr('startOffset', offset)
                    .text(label)
        })
    }

    #renderLabel(layout){
        const { cx, cy, radius } = layout

        const labelGroup = this.el.vis.group.append('g')
            .classed('label-group', true)
            .attr('transform', `translate(${cx}, ${cy} )`)

        // Circular label
        const circularLabelR = radius  * 0.9
        const circularLabelWidth = radius  * 0.1

        labelGroup.append('circle').classed('outer', true).attr('r', circularLabelR + circularLabelWidth * 0.5)
        labelGroup.append('circle').classed('inner', true).attr('r', circularLabelR - circularLabelWidth * 0.5)

        const latestYear = this.targetData[this.targetData.length - 1].year
        // const labelText = `tracking our performance to ${latestYear}`,
        const labelText = ``,
            labelFs = circularLabelWidth * 0.45

        this.el.defs.append('path')
            .attr('id', 'label-arc-top')
            .attr('d', `M ${cx - circularLabelR} ${cy} A ${circularLabelR} ${circularLabelR} 0 0 1 ${cx + circularLabelR} ${cy}`)

        this.el.defs.append('path')
            .attr('id', 'label-arc-bottom')
            .attr('d', `M ${cx - circularLabelR} ${cy} A ${circularLabelR} ${circularLabelR} 0 0 0 ${cx + circularLabelR} ${cy}`)

        const textGroup = this.el.vis.group.append('g').classed('circular-label-group', true)

        textGroup.append('text').classed('circular-label top', true)
            .append('textPath')
                .attr('href', '#label-arc-top')
                .attr('startOffset', '50%')
                .attr('text-anchor', 'middle')
                .attr('dominant-baseline', 'central')
                .text(labelText)
                .style('font-size', labelFs)

        textGroup.append('text').classed('circular-label bottom', true)
            .append('textPath')
                .attr('href', '#label-arc-bottom')
                .attr('startOffset', '50%')
                .attr('text-anchor', 'middle')
                .attr('dominant-baseline', 'central')
                .text(labelText)
                .style('font-size', labelFs)

        // Central label
        labelGroup.append('text')
            .attr('dy',-radius * 0.175)
            .classed('center-label year', true)
            .style('font-size', radius * 0.4)
            .text(2030)

        // labelGroup.append('text')
        //     .classed('center-label', true)
        //     .attr('y', -radius * 0.275)
        //     .style('font-size', radius * 0.15)
        //     .text("Victoria's")

        labelGroup.append('text')
            .classed('center-label', true)
            .attr('dy',-radius * 0.125)
            .attr('y', radius * 0.275)
            .style('font-size', radius * 0.25)
            .text('targets')

    }

    #clearDynamic() {
        this.el.vis.group.selectAll('*').remove()
        this.el.defs.selectAll('clipPath, path').remove()
    }


    //////////////////////////
    ////  PUBLIC METHODS  ////
    //////////////////////////

    render() {
        const { dataModel } = this.app.module,
            data   = Object.values(dataModel.data)

        const { width, height, margin} = DataVis.CONFIG.dims,
            canvasWidth = width - margin.left - margin.right,
            canvasHeight = height - margin.top - margin.bottom

        this.#renderTargets(
            {
                x:      margin.left,
                y:      margin.top,
                width:  canvasWidth,
                height: canvasHeight,
            },
            {}
        )

        this.#renderLabel(
            {
                cx:      width * 0.5,
                cy:      height * 0.5,
                radius:  canvasWidth * 0.1,  // Set to same as target 
            },
            {}
        )
    }

    update(){
        const { dataModel } = this.app.module
        const data = dataModel.data[this.app.state.select.year]
        if (!data) return console.warn(`No data for year ${data}`)

        this.targetData = TargetsVis.buildTrendSeries(dataModel.data, TargetsVis.CONFIG.year.baseline)
            .filter(d => d.year <= this.app.state.select.year)

        this.#clearDynamic()
        this.render()
    }
}

