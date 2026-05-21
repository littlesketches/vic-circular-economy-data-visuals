// Libs and data
import * as d3      from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import { svgScene } from "../assets/scene.js";


// => Data Visualisation class
export class DataVis {

    ///////////////////////////////////
    //// STATIC CONFIG AND METHODS ////
    ///////////////////////////////////

    static CONFIG = {
        dims: {
            width:      1200,
            height:     1200,
            margin: { 
                top: 50, bottom: 50, left: 50, right: 50 
            },
            cycle: {
                innerRadius: 0.1, outerRadius: 0.25,
            }
        },
        map: {
            sectorClass: {
                'MSW': 'msw', 'C&I': 'ci', 'C&D': 'cd'
            }, 
            streamClass: {
                'Aggregate masonry and soils':  'aggregate-masonry-and-soils',
                'Organics':                     'organics',
                'Paper and cardboard':          'paper-and-cardboard',
                'Metals':                       'metals',
                'Plastic':                      'plastic',
                'Glass':                        'glass',
                'Textiles':                     'textiles',
                'Tyres and rubber':             'tyres-and-rubber'
            }        
        },
        animation: {
            duration: 1500,
        }

    }

    static #flowRotationAngle(totalRecovered, totalGenerated) {
        // Maps 0–100% recovery to a rotation range, e.g. -30° to +30°: at 50% recovery → 0° (flat). At 100% → +30° (tilted up). At 0% → -30°.
        const recoveryRate = totalRecovered / totalGenerated        // 0–1
        const maxAngle     = 30                                     // degrees, tune to taste
        const rotationAngle = - (recoveryRate - 0.5) * 2 * maxAngle  *1            // -30° to +30°

        return rotationAngle
    }

    static #svgDoc = new DOMParser().parseFromString(svgScene, 'image/svg+xml');

    /////////////////
    //// FIELDS  ////
    /////////////////

    state = {
        treemap: {
            seed:               { outer: 26, inner: 0 },         // Should be set by year?
        },
        rotateByRecoveryRate:   true,
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

    


    // REFERENCE TO D3 FUNCTIONS
    scale = {}
    generator = {}
    axis = {}

    /////////////////////
    //// CONSTRUCTOR ////
    /////////////////////

    constructor(app, queryConfig) {
        // Store app reference
        this.app = app

        // Init and render vis
        this.#initVis()         // Setup of visualisation components
        this.render()           // Renders selected data (reusable to be called on update)
    }

    ///////////////////////////
    ////  PRIVATE METHODS  ////
    ///////////////////////////

    #initVis() {
        const { width, height, margin } = DataVis.CONFIG.dims
        const svg = this.el.svg = d3.select('svg#data-vis')
            .attr('viewBox', [0, 0, width, height])
            .classed('svg-vis', true)

        const defs = this.el.defs = svg.append('defs')

        // I. Top-level vis group
        const visGroup = this.el.vis.group = svg.append('g').classed('vis-group', true)

        const ceMetrics = this.el.vis.circularMetrics = visGroup.append('g').classed('ce-metrics', true)
        this.el.vis.circularMetricsShapes = ceMetrics.append('g').classed('ce-metrics-shapes', true)

        // II. ROTATION GROUP — single group that rotates together
        const rotationGroup = this.el.vis.rotationGroup = visGroup.append('g').classed('rotation-group', true)
        this.el.vis.materialFlow    = rotationGroup.append('g').classed('material-flow', true)
        this.el.vis.treemap         = rotationGroup.append('g').classed('treemap-group', true)

        // III. ILLUSTRATION — also inside rotation group
        const illustrationGroup = this.el.illustration.group = rotationGroup.append('g').classed('illustration-group', true)
        this.el.illustration.wasteIndustry = illustrationGroup.append('g').classed('waste-industry-illustration', true)

        // IV. ANNOTATION — split: ce-metrics stays outside rotation, materialFlow inside
        const annotationGroup = this.el.annotation.group = svg.append('g').classed('annotation-group', true)
        this.el.annotation.circularMetrics = this.el.vis.circularMetrics.append('g').classed('ce-metrics-annotation', true)

        const rotationAnnotationGroup = this.el.annotation.rotationGroup = annotationGroup.append('g').classed('rotation-annotation-group', true)
        this.el.annotation.materialFlow = rotationAnnotationGroup.append('g').classed('material-flow-annotation', true)

        // V. LEGEND
        const legendGroup = this.el.legend.group = svg.append('g').classed('legend-group', true)
    }

    #renderCircularMetrics(data, layout, options = {}) {

        ////////////////////////
        /// I. CONFIG & DATA ///
        ////////////////////////

        // i. Dims and positioning
        const { x, y, size } = layout

        const { width, height, margin } = DataVis.CONFIG.dims,
            canvasWidth  = width  - margin.left - margin.right,
            canvasHeight = height - margin.top  - margin.bottom

        // ii. SVG group references
        const vis       = this.el.vis.circularMetrics,
            annotation  = this.el.annotation.circularMetrics

        // iii. Data used: assigned to dmc, smc, tmf and circularityRate
        const { 
            'Domestic Material Consumption (DMC)':  dmc,
            'Secondary Material Consumption (SMC)': smc,
            'Total Material Footprint (TMF)':       tmf,
            'Circularity rate':                     circularityRate
        } = data.metrics

        // => Return without rendering if no circular economy data
        if( !dmc || !smc || !tmf || !circularityRate) return


        /////////////////////////////
        /// II. LAYOUT & GEOMETRY ///
        /////////////////////////////

        // i. Set scale so TMF square = size
        const scale = size / Math.sqrt(tmf),
            sTmf    = size,                         // = Math.sqrt(tmf) * scale
            sDmc    = Math.sqrt(dmc) * scale,
            r       = scale * Math.sqrt(smc / Math.PI)

        const baseX = x,
            baseY   = y + size,                // bottom edge of TMF square
            pivotX  = baseX + sDmc,            // DMC pivot: bottom-right corner of DMC square
            pivotY  = baseY

        // ii. Set rotation: top-right corner of DMC touches right edge of TMF
        const sinθ  = (sTmf - sDmc) / sDmc,
            rotation    = Math.asin(sinθ) * 180 / Math.PI

        // iii. Position SMC circle centre of TMF square
        const cx    = baseX + sTmf * 0.5,
            cy      = y + sTmf * 0.5


        ///////////////////////////////////////////////
        /// IV. MATERIAL CONSUMPTION VOLUME SHAPES ///
        ///////////////////////////////////////////////

        const shapeGroup = this.el.vis.circularMetricsShapes 

        // TMF square
        shapeGroup.append('rect').classed('tmf square', true)
            .attr('x', baseX)
            .attr('y', y)
            .attr('width', sTmf)
            .attr('height', sTmf)

        // DMC square — rotated CW around its bottom-right corner
        shapeGroup.append('rect').classed('dmc square', true)
            .attr('x', -sDmc)
            .attr('y', -sDmc)
            .attr('width', sDmc)
            .attr('height', sDmc)
            .attr('transform', `translate(${pivotX},${pivotY}) rotate(${rotation})`)

        // SMC BG and circle
        shapeGroup.append('circle').classed('smc bg', true)
            .attr('cx', cx)
            .attr('cy', cy)
            .attr('r', r * 1.35)

        shapeGroup.append('circle').classed('smc orb', true)
            .attr('cx', cx)
            .attr('cy', cy)
            .attr('r', r)


        //////////////////////
        /// V. TITLE BLOCK ///
        //////////////////////

        const titleGroup = annotation.append('g')
            .classed('consumption-title-group', true)
            .attr('transform', `translate(${-DataVis.CONFIG.dims.margin.left + DataVis.CONFIG.dims.width * 0.175}, ${ DataVis.CONFIG.dims.height * 0.365}) rotate(${rotation - 90})`)

        const titleFs = DataVis.CONFIG.dims.height * 0.025

        titleGroup.append('text').classed('material-consumption-label title', true)
            .attr('y', + DataVis.CONFIG.dims.height * 0.04)
            .style('font-size', titleFs)
            .text('The materials we consume')

        titleGroup.append('rect').classed('title-bar material-consumption', true)
            .attr('x',  - DataVis.CONFIG.dims.width * 0.75)
            .attr('width', DataVis.CONFIG.dims.width * 1.5)
            .attr('height', DataVis.CONFIG.dims.height * 0.0125)


        ///////////////////////////////////////////////
        /// VI. CIRCULARITY RATE LABEL : INSIDE SMC ///
        ///////////////////////////////////////////////

        // i. Add group for label
        const crLabelGroup = annotation.append('g').classed('circularity-rate-label-group', true)

        // ii. Create arc paths for curved text labels in defs
        const arcR      = r * 1.1,
            arcFontSize = r * 0.23,
            arcLetterSp = r * 0.025,
            labelText   = `Circularity rate ${data.year}`,
            arcIds      =[`smcTopArc_${data.year}`, `smcBottomArc_${data.year}`]

        this.el.defs.append('path')
            .attr('id', arcIds[0])
            .attr('d', `M ${cx - arcR},${cy} A ${arcR},${arcR} 0 0,1 ${cx + arcR},${cy}`)

        this.el.defs.append('path')
            .attr('id', arcIds[1])
            .attr('d', `M ${cx + arcR},${cy} A ${arcR},${arcR} 0 0,1 ${cx - arcR},${cy}`)

        // iii. Render label text on curved paths
        arcIds.forEach(id => {
            crLabelGroup.append('text').classed('circularity-desc-label', true)
                .attr('text-anchor', 'middle')
                .style('font-size', arcFontSize)
                .append('textPath')
                    .attr('href', `#${id}`)
                    .attr('startOffset', '50%')
                    .style('letter-spacing', arcLetterSp)
                    .text(labelText)
        })

        // iv. Add Circularity Rate headline label with superscript %
        const numFontSize = r * 0.9,
            pctFontSize = numFontSize * 0.25,
            numBaseline = cy + numFontSize * 0.3

        const numeral = crLabelGroup.append('text').classed('circularity-rate', true)
            .attr('x', cx)
            .attr('y', numBaseline)
            .style('font-size', numFontSize)
            .text(d3.format('.2')(circularityRate * 100))
        const pctY = numBaseline - (numFontSize * 0.72) + (pctFontSize * 0.72)

        const pct = crLabelGroup.append('text').classed('circularity-rate-pct', true)
            .attr('y', pctY)
            .attr('dy', pctFontSize * 0.1)
            .style('font-size', pctFontSize)
            .text('%')

        // v. Set the position of the % after numeral is rendered
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                const len = numeral.node().getComputedTextLength()
                pct.attr('x', cx + len / 2 + r * 0.02)
            })
        })
    }

    #renderMaterialFlow(data, layout, options = {}) {

        ////////////////////////
        /// I. CONFIG & DATA ///
        ////////////////////////

        const { x, y, width } = layout

        const {
            streamHeight     = width * 0.25,
            elbowRatio       = 0.5,
            slopeAngleDeg    = 60,
            rMinFactor       = 3,
            labelOffsetRatio = 0.5,
            slopePad         = 0,
            rotationAngle    = 0,
            animate          = false,     
            trianglePosition = 'bottom',
        } = options

        const vis        = this.el.vis.materialFlow
        const annotation = this.el.annotation.materialFlow

        // Stream data
        const streams = Object.entries(data.byStream)
            .map(([name, d]) => ({
                name,
                generated:    d.sectors?.All?.Generated             ?? 0,
                recovered:    d.sectors?.All?.['Recovered - total'] ?? 0,
                disposed:     d.sectors?.All?.Disposed              ?? 0,
                recoveryRate: d.sectors?.All?.['Recovery rate']     ?? 0,
            }))
            .filter(s => s.generated > 0)
            .sort((a, b) => b.generated - a.generated)

        const n = streams.length

        const { Aggregated } = data.metrics,
            totalGenerated    = Aggregated.generated.total,
            totalDisposed     = Aggregated.disposed.total,
            totalRecovered    = Aggregated.recovered.total,
            disposalRatio     = totalDisposed / totalGenerated,
            totalRecoveryRate = Aggregated.recoveryRate.toFixed(1)

        /////////////////////////////
        /// II. SHARED GEOMETRY   ///
        /////////////////////////////

        const slotH  = streamHeight / n,
            lineYs   = streams.map((_, i) => y + i * slotH + slotH / 2),
            elbowX   = width * elbowRatio,
            rMin     = slotH * rMinFactor,
            radii    = streams.map((_, i) => rMin + (n - 1 - i) * slotH),
            slopeAngle = slopeAngleDeg * Math.PI / 180

        this.scale.materialFlow = d3.scaleSqrt()
            .domain([0, streams[0].generated])
            .range([1, slotH * 0.55])

        const tGenTop     = this.scale.materialFlow(streams[0].generated),
            tGenBot       = this.scale.materialFlow(streams[n-1].generated),
            groupTop      = lineYs[0]   - tGenTop / 2,
            groupBot      = lineYs[n-1] + tGenBot / 2,
            genSquareSize = groupBot - groupTop

        // Landfill slope geometry — shared across multiple sub-components
        const triArea     = disposalRatio * genSquareSize * genSquareSize,
            triSide       = Math.sqrt(triArea * 4 / Math.sqrt(3)),
            triH          = (Math.sqrt(3) / 2) * triSide,
            triTopY       = trianglePosition === 'bottom' ? groupBot - triH : groupBot + slotH * 0.5,
            Bx            = x + width,    By = triTopY,
            Ax            = Bx - triSide, Ay = triTopY,
            Cx            = Ax + triSide * Math.cos(slopeAngle),
            Cy            = Ay + triSide * Math.sin(slopeAngle),
            tSlopeTotal   = this.scale.materialFlow(totalDisposed),
            miterDx       = tSlopeTotal / (2 * Math.tan(slopeAngle)),
            slopeEndX     = Ax - slopePad - miterDx + triSide / 2,
            slopeEndY     = Cy,
            slopeStartY   = trianglePosition === 'bottom'
                                ? lineYs[0] - this.scale.materialFlow(streams[0].generated) / 2 + this.scale.materialFlow(streams[0].disposed) / 2
                                : lineYs[0] - tGenTop / 2 + this.scale.materialFlow(streams[0].disposed) / 2,
            slopeStartX   = slopeEndX - (slopeEndY - slopeStartY) / Math.tan(slopeAngle),
            slopeXatY     = cy => slopeEndX - (slopeEndY - cy) / Math.tan(slopeAngle)

        // Recovery arc centroid — shared by arcs, breakdown triangle and label
        let sumCy = 0
        streams.forEach((s, i) => {
            const tGen = this.scale.materialFlow(s.generated),
                tRec   = this.scale.materialFlow(s.recovered),
                recCy  = (lineYs[i] + tGen / 2) - tRec / 2
            sumCy += recCy + radii[i]
        })
        const arcCentX = x + elbowX,
            arcCentY   = sumCy / n,
            innerR     = rMin * 0.7

        // Bundle geometry for sub-components
        const sharedGeom = {
            x, y, width, streams, n, slotH, lineYs, elbowX,
            rMin, radii, slopeAngle, slopeAngleDeg, slopePad,
            genSquareSize, groupTop, groupBot,
            tGenTop, tGenBot,
            Ax, Ay, Bx, By, Cx, Cy, triSide, triH, triTopY,
            tSlopeTotal, slopeStartX, slopeStartY, slopeEndX, slopeEndY, slopeXatY,
            arcCentX, arcCentY, innerR,
            totalGenerated, totalDisposed, totalRecovered,
            disposalRatio, totalRecoveryRate,
            rotationAngle, labelOffsetRatio,
            Ax, Ay, Bx, By, Cx, Cy,
            triTopY,
            tSlopeTotal, slopeStartX, slopeStartY, slopeEndX, slopeEndY, slopeXatY,
            trianglePosition,
            slopePad,
        }

        //////////////////////////////
        /// III. RENDER COMPONENTS ///
        //////////////////////////////

        // i. Title
        this.#materialFlow.renderFlowTitle(annotation, sharedGeom, data.year)

        // ii. Generation | treemap
        this.#materialFlow.renderFlowGeneration(vis, annotation, data, sharedGeom)

        // iii. Flow lines — generated / disposed / recovered
        this.#materialFlow.renderFlowLines(vis, annotation, sharedGeom)

        // iv. Recovery breakdown triangle
        this.#materialFlow.renderRecoveryBreakdown(vis, data, sharedGeom)

        // v. Recovery rate circular chart 
        this.#renderRecoveryCircleChart(
            vis, annotation, data,
            { x, y, width, streamHeight },
            {
                sortBy:          'generated',
                elbowRatio,
                rMinFactor,
                showStreamLabels: false,
                showRateLabels:   false,
                showCentreLabel:  true,
                counterRotation:  -rotationAngle,
                animate,                  
                delay:            DataVis.CONFIG.animation.duration * 0.3,
            }
        )

        // vi. Landfill slope + disposal triangle
        this.#materialFlow.renderLandfill(vis, annotation, sharedGeom,  { trianglePosition: 'bottom'})

        // vii. Fate labels
        this.#materialFlow.renderWasteFateLabels(annotation, sharedGeom, data)

        // viii. Waste management labels
        this.#materialFlow.renderWasteManagementLabels(annotation, sharedGeom, data)
    }

    // Material flow graphic component methods         
    #materialFlow = {   
        renderFlowTitle: (annotation, g, year) => {
            const titleGroup = annotation.append('g').classed('waste-title-group', true)
                .attr('transform', `translate(${DataVis.CONFIG.dims.margin.left}, ${g.groupTop - g.slotH * 0.8 * g.n})`)

            const titleFs = DataVis.CONFIG.dims.height * 0.025

            titleGroup.append('text').classed('waste-industry-label title', true)
                .style('font-size', titleFs)
                .text('Managing our waste')

            titleGroup.append('rect').classed('title-bar waste-industry', true)
                .attr('y',  -DataVis.CONFIG.dims.height * 0.035)
                .attr('width', g.width * 1.25)
                .attr('height', g.slotH * 0.1 * g.n)
        },

        renderFlowGeneration: (vis, annotation, data, g) => {

            // Generation square background
            vis.append('rect').classed('generation-square', true)
                .attr('x', g.x).attr('y', g.groupTop)
                .attr('width', g.genSquareSize).attr('height', g.genSquareSize)

            // Treemap overlay
            this.#renderWasteBreakdownTreemap(data, {
                x:      g.x,
                y:      g.groupTop,
                width:  g.genSquareSize,
                height: g.genSquareSize,
            }, {
                showAnnotation: false,
                showTooltips:   false,
                seedOuter:      this.state.treemap.seed.outer,
                seedInner:      this.state.treemap.seed.inner,
                visGroup:       vis,
                annotGroup:     annotation,
            })

        },

        renderFlowLines: (vis, annotation, g, options = {}) => {

            const { animate = false, delay = 0 } = options

            const dur = DataVis.CONFIG.animation.duration

            g.streams.forEach((s, i) => {
                const lineY   = g.lineYs[i],
                    tGen      = this.scale.materialFlow(s.generated),
                    tDis      = this.scale.materialFlow(s.disposed)

                const topEdge = lineY - tGen / 2,
                    disCy     = topEdge + tDis / 2,
                    disEndX   = Math.min(g.slopeXatY(disCy), g.x + g.width)

                const sc      = DataVis.CONFIG.map.streamClass[s.name]

                // ── Generated line ─────────────────────────────────
                const genLine = vis.append('line')
                    .classed(`generated stream-line ${sc}`, true)
                    .attr('x1', g.x + g.genSquareSize)
                    .attr('x2', g.x + g.elbowX)
                    .attr('y1', lineY).attr('y2', lineY)
                    .attr('stroke-width', animate ? 0 : tGen)

                if (animate) {
                    genLine.transition()
                        .duration(dur)
                        .delay(delay + i * 30)
                        .attr('stroke-width', tGen)
                }

                // ── Disposal line ──────────────────────────────────
                const disLine = vis.append('line')
                    .classed(`landfill stream-line ${sc}`, true)
                    .attr('x1', g.x + g.elbowX)
                    .attr('x2', animate ? g.x + g.elbowX : disEndX)   // grows rightward
                    .attr('y1', disCy).attr('y2', disCy)
                    .attr('stroke-width', animate ? 0 : tDis)

                if (animate) {
                    disLine.transition()
                        .duration(dur)
                        .delay(delay + dur * 0.5 + i * 30)             // after generated
                        .attr('x2', disEndX)
                        .attr('stroke-width', tDis)
                }

                // ── Stream label ───────────────────────────────────
                const labelOffsetX = g.width * g.labelOffsetRatio,
                    labelPadY      = g.width * 0.001,
                    labelPadX      = labelPadY * 4,
                    labelFs        = g.width * 0.01

                const labelG = annotation.append('g')
                    .classed(`stream-label stream-${i}`, true)
                    .style('opacity', animate ? 0 : 1)

                if (animate) {
                    labelG.transition()
                        .duration(dur * 0.5)
                        .delay(delay + i * 30)
                        .style('opacity', 1)
                }

                const bg = labelG.append('rect').classed('stream-label-bg', true)
                    .attr('y', lineY - labelFs / 2 - labelPadY)
                    .attr('height', labelFs + labelPadY * 2)

                const label = labelG.append('text').classed('stream-name', true)
                    .attr('x', g.x + labelOffsetX).attr('y', lineY)
                    .attr('text-anchor', 'end').attr('dominant-baseline', 'central')
                    .style('font-size', labelFs)
                    .text(s.name)

                requestAnimationFrame(() => requestAnimationFrame(() => {
                    const len = label.node().getComputedTextLength()
                    bg.attr('x', g.x + labelOffsetX - len - labelPadX)
                        .attr('width', len + labelPadX * 2)
                }))
            })
        },

        renderLandfill: (vis, annotation, g) =>  {

            const slopeEndX = g.trianglePosition === 'bottom'
                ? g.slopeXatY(g.slopeEndY)
                : g.slopeEndX

            vis.append('line').classed('landfill slope-line', true)
                .attr('x1', g.slopeStartX).attr('y1', g.slopeStartY)
                .attr('x2', g.slopeEndX).attr('y2', g.slopeEndY)
                .attr('stroke-width', g.tSlopeTotal)

            // Triangle
            vis.append('polygon').classed('landfill triangle', true)
                .attr('points', `${g.Ax},${g.Ay} ${g.Bx},${g.By} ${g.Cx},${g.Cy}`)
                .style('stroke-width', g.triH * 0.05)

            // Label
            const triCentX  = (g.Ax + g.Bx + g.Cx) / 3,
                triCentY    = (g.Ay + g.By + g.Cy) / 3,
                triFs       = Math.max(g.triH * 0.25, 9),
                pctFs       = triFs * 0.35,
                disposalPct = Math.round(g.disposalRatio * 100)

            const numeral = annotation.append('text')
                .classed('landfill-label pct-value', true)
                .attr('x', triCentX).attr('y', triCentY)
                .attr('text-anchor', 'middle').attr('dominant-baseline', 'central')
                .style('font-size', triFs)
                .text(disposalPct)

            const pctY = triCentY - triFs * 0.72 + pctFs * 0.72

            const pct = annotation.append('text')
                .classed('landfill-label pct-sign', true)
                .attr('y', pctY)
                .attr('text-anchor', 'start')
                .style('font-size', pctFs)
                .text('%')

            requestAnimationFrame(() => requestAnimationFrame(() => {
                const len = numeral.node().getComputedTextLength()
                pct.attr('x', triCentX + len / 2 + triFs * 0.02)
            }))
        },

        renderRecoveryBreakdown: (vis, data, g) => {
            const { Aggregated } = data.metrics

            const recoveryGroup = vis.append('g').classed('recovery-breakdown-group', true)
                .attr('transform', `rotate(${-g.rotationAngle}, ${g.arcCentX}, ${g.arcCentY})`)

            this.#renderRecoveryBreakdown({
                svg:      recoveryGroup,
                apexX:    g.arcCentX,
                apexY:    g.arcCentY,
                baseY:    DataVis.CONFIG.dims.height - DataVis.CONFIG.dims.margin.bottom,
                segments: [
                    { value: Aggregated.recovered.processedLocally,       class: 'recovered-local',         label: 'Processed locally' },
                    { value: Aggregated.recovered.exported.interstate,    class: 'recovered-interstate',     label: 'Interstate export' },
                    { value: Aggregated.recovered.exported.international, class: 'recovered-international',  label: 'International export' },
                ]
            })
        },

        renderWasteFateLabels: (annotation, g, data) => {

            const labelFs        = g.slotH * 0.85       // Set the same as 

            // i. Disposal label
            annotation.append('g').classed('disposal-label-group', true)
                .attr('transform', `translate(${g.slopeStartX}, ${g.groupTop})`)
                .append('text').classed('disposal-label', true)
                    .attr('x', labelFs * 0.5)
                    .attr('y', -labelFs * 0.9)
                    .attr('text-anchor', 'end').attr('dominant-baseline', 'middle')
                    .style('font-size', labelFs)
                    .html(`<tspan class = 'lowercase'>${d3.format("0.1f")(data.metrics.Aggregated.disposed.total /1000000)} Mt</tspan> disposed`)


            // ii. Recovery label arc
            const tGenTop      = this.scale.materialFlow(g.streams[0].generated),
                tRecTop        = this.scale.materialFlow(g.streams[0].recovered),
                botEdgeTop     = g.lineYs[0] + tGenTop / 2,
                recCyTop       = botEdgeTop - tRecTop / 2,
                largestArcCy   = recCyTop + g.radii[0],
                recoveryLabelR = g.radii[0] + g.slotH * 1.0,
                arcId          = `recoveryLabelArc_${data.year}`

            this.el.defs.append('path')
                .attr('id', arcId)
                .attr('d', `M ${g.arcCentX},${largestArcCy - recoveryLabelR} A ${recoveryLabelR},${recoveryLabelR} 0 1,1 ${g.arcCentX},${largestArcCy + recoveryLabelR}`)
                .attr('transform', `rotate(${-g.rotationAngle}, ${g.arcCentX}, ${largestArcCy})`)

            annotation.append('text').classed('recovery-label', true)
                .style('font-size', labelFs)
                .append('textPath')
                    .attr('href', `#${arcId}`)
                    .attr('startOffset', '50%')
                    .attr('text-anchor', 'middle')
                    .html(`<tspan class = 'lowercase'>${d3.format("0.1f")(data.metrics.Aggregated.recovered.total /1000000)} Mt</tspan> Recovered `)
        },

        renderWasteManagementLabels: (annotation, sharedGeom, data) =>{

            const fs = sharedGeom.slotH * 0.85
            const group = annotation.append('g').classed('waste-management-label-group', true)
                .attr('transform', `translate(${sharedGeom.x}, ${sharedGeom.y - sharedGeom.slotH * 0.25})`)

            group.append('text').classed('waste-management-label generation-label total', true)
                .attr('transform', ` translate(${-fs * 0.75}, ${sharedGeom.genSquareSize * 1.1}) rotate(-90)`)
                .html(`<tspan class = 'lowercase'>${d3.format("0.1f")(data.metrics.Aggregated.generated.total /1000000)} Mt</tspan> of waste`)
                .style('font-size', fs * 1)

            group.append('text').classed('waste-management-label generation-label', true)
                .text(`generated`)
                .style('font-size', fs)
        }
    }

    // Data graphics support material flow with standalone options
    #renderRecoveryCircleChart(vis, annotation, data, layout, options = {}) {

        ////////////////////////
        /// I. CONFIG & DATA ///
        ////////////////////////

        const { x, y, width, streamHeight } = layout

        const {
            // Data options
            sortBy           = 'generated',     // 'generated' | 'recoveryRate'
            sortDir          = 'desc',          // 'desc' | 'asc'
            // Geometry options
            elbowRatio       = 0.5,
            rMinFactor       = 3,
            // Label options
            showStreamLabels  = false,          // labels for each waste stream
            showRateLabels    = false,          // recovery rate % per stream
            labelOffsetRatio  = 0.5,
            showCentreLabel   = true,           // overall recovery rate in centre                
            counterRotation   = 0,               // Counter-rotation — offsets parent group rotation so labels read horizontally
            // Animation control
            animate          = false,    
            delay            = 0,        
        } = options

        const vis_        = vis        ?? this.el.vis.materialFlow
        const annotation_ = annotation ?? this.el.annotation.materialFlow

        // i. Build stream data (sorted by generation volume)
        let streams = Object.entries(data.byStream)
            .map(([name, d]) => ({
                name,
                generated:    d.sectors?.All?.Generated             ?? 0,
                recovered:    d.sectors?.All?.['Recovered - total'] ?? 0,
                disposed:     d.sectors?.All?.Disposed              ?? 0,
                recoveryRate: d.sectors?.All?.['Recovery rate']     ?? 0,
            }))
            .filter(s => s.generated > 0)

        const sortKey = sortBy === 'recoveryRate' ? 'recoveryRate' : 'generated'
        streams = streams.sort((a, b) => sortDir === 'asc' ? a[sortKey] - b[sortKey] : b[sortKey] - a[sortKey])

        const n = streams.length

        const { Aggregated } = data.metrics,
            totalGenerated    = Aggregated.generated.total,
            totalRecovered    = Aggregated.recovered.total,
            totalRecoveryRate = Aggregated.recoveryRate.toFixed(1)

        /////////////////////////////
        /// II. LAYOUT & GEOMETRY ///
        /////////////////////////////

        const slotH  = streamHeight / n,
            lineYs   = streams.map((_, i) => y + i * slotH + slotH / 2),
            elbowX   = width * elbowRatio,
            rMin     = slotH * rMinFactor,
            radii    = streams.map((_, i) => rMin + (n - 1 - i) * slotH)

        this.scale.recoveryArcs = d3.scaleSqrt()
            .domain([0, streams[0].generated])
            .range([1, slotH * 0.55])

        // Arc centroid
        let sumCy = 0
        streams.forEach((s, i) => {
            const tGen = this.scale.recoveryArcs(s.generated),
                tRec   = this.scale.recoveryArcs(s.recovered),
                recCy  = (lineYs[i] + tGen / 2) - tRec / 2
            sumCy += recCy + radii[i]
        })

        const arcCentX = x + elbowX,
            arcCentY   = sumCy / n,
            innerR     = rMin * 0.7

        //////////////////////////////
        /// III. RENDER ARCS       ///
        //////////////////////////////      
        const dur = DataVis.CONFIG.animation.duration

        streams.forEach((s, i) => {
            const lineY = lineYs[i],
                r       = radii[i],
                tGen    = this.scale.recoveryArcs(s.generated),
                tRec    = this.scale.recoveryArcs(s.recovered),
                botEdge = lineY + tGen / 2,
                recCy   = botEdge - tRec / 2,
                arcCx   = x + elbowX,
                arcCy   = recCy + r

            const startRad = -Math.PI / 2,
                sweepRad   = (s.recoveryRate / 100) * 2 * Math.PI,
                largeArc   = sweepRad > Math.PI ? 1 : 0

            const ax1 = arcCx + r * Math.cos(startRad),
                ay1   = arcCy + r * Math.sin(startRad),
                ax2   = arcCx + r * Math.cos(startRad + sweepRad),
                ay2   = arcCy + r * Math.sin(startRad + sweepRad)

            const sc = DataVis.CONFIG.map.streamClass[s.name]


            const arcPath = vis_.append('path')
                .classed(`recovered stream-arc ${sc}`, true)
                .attr('fill', 'none')
                .attr('stroke-width', tRec)

            if (animate) {
                arcPath
                    .attr('d', `M ${ax1},${ay1} A ${r},${r} 0 ${largeArc},1 ${ax1},${ay1}`)  // zero-length start
                    .transition()
                    .duration(dur)
                    .delay(delay + dur * 0.3 + i * 40)    // after generated lines
                    .attrTween('d', function() {
                        const interp = d3.interpolate(0, s.recoveryRate / 100)
                        return t => {
                            const sweep = interp(t) * 2 * Math.PI,
                                la      = sweep > Math.PI ? 1 : 0,
                                ex      = arcCx + r * Math.cos(startRad + sweep),
                                ey      = arcCy + r * Math.sin(startRad + sweep)
                            return `M ${ax1},${ay1} A ${r},${r} 0 ${la},1 ${ex},${ey}`
                        }
                    })
            } else {
                arcPath.attr('d', `M ${ax1},${ay1} A ${r},${r} 0 ${largeArc},1 ${ax2},${ay2}`)
            }

            // ── Per-stream labels ─────────────────────────────────
            if (showStreamLabels || showRateLabels) {

                const labelG    = annotation_.append('g').classed(`arc-stream-label arc-stream-${i}`, true),
                    labelFs     = slotH * 0.8,
                    labelOffsetX = width * labelOffsetRatio

                if (showStreamLabels) {
                    const bg = labelG.append('rect').classed('stream-label-bg', true)
                        .attr('y', lineY - labelFs / 2 - 2)
                        .attr('height', labelFs + 4)

                    const label = labelG.append('text').classed('stream-name', true)
                        .attr('x', x + labelOffsetX).attr('y', lineY)
                        .attr('text-anchor', 'end').attr('dominant-baseline', 'central')
                        .style('font-size', labelFs)
                        .text(s.name)

                    requestAnimationFrame(() => requestAnimationFrame(() => {
                        const len = label.node().getComputedTextLength()
                        bg.attr('x', x + labelOffsetX - len - 4)
                            .attr('width', len + 8)
                    }))
                }

                if (showRateLabels) {
                    // Place rate label at the arc endpoint
                    const endX = ax2 + r * 0.15,
                        endY   = ay2

                    labelG.append('text').classed('arc-rate-label', true)
                        .attr('x', endX).attr('y', endY)
                        .attr('dominant-baseline', 'middle')
                        .style('font-size', labelFs * 0.9)
                        .text(`${Math.round(s.recoveryRate)}%`)
                }
            }
        })

        //////////////////////////////
        /// IV. CENTRE LABEL       ///
        //////////////////////////////

        if (showCentreLabel) {
            const labelGroup = annotation_.append('g')
                .classed('recovery-rate-label-group', true)
                .attr('transform', `rotate(${counterRotation}, ${arcCentX}, ${arcCentY})`)

            // i. Label background donut
            const labelBgArc = d3.arc()
                .innerRadius(innerR * 0.9) 
                .outerRadius(innerR * 1.2)       
                .startAngle(0)             
                .endAngle(Math.PI * 2);    

            labelGroup.append("path")
                .classed('recovery-rate-label bg', true)
                .attr('transform', `translate(${arcCentX}, ${arcCentY})`)
                .attr("d", labelBgArc)

            // ii. Sector recovered contrbution pie chart
            const pieData = Object.entries(data.metrics.Aggregated.recovered.bySector)
            const pieGenerator = d3.pie().value(d => d[1]);
            const sectorRecoveredPicArc = d3.arc()
                .innerRadius(innerR * 0.8) 
                .outerRadius(innerR * 0.9)      

            const recoveryPie = labelGroup.append('g').classed('recovery-pie-group', true)
                .attr('transform', `translate(${arcCentX}, ${arcCentY})`)

            recoveryPie.selectAll("path")
                .data(pieGenerator(pieData)) 
                .enter()
                .append("path")
                .attr("d", sectorRecoveredPicArc)
                .attr('class', d => `${DataVis.CONFIG.map.sectorClass[d.data[0]]} recovery-sector-segment` )

            // ii. Three arc text paths
            const arcFontSize = innerR * 0.15,
                arcLetterSp   = innerR * 0.02

            ;[0, 120, 240].forEach((offset, i) => {
                const startAngle = (offset - 90) * Math.PI / 180,
                    endAngle     = (offset + 90) * Math.PI / 180,
                    x1 = arcCentX + Math.cos(startAngle) * innerR,
                    y1 = arcCentY + Math.sin(startAngle) * innerR,
                    x2 = arcCentX + Math.cos(endAngle)   * innerR,
                    y2 = arcCentY + Math.sin(endAngle)   * innerR

                this.el.defs.append('path')
                    .attr('id', `recRate-textPath_${data.year}_${i}`)
                    .attr('d', `M ${x1},${y1} A ${innerR},${innerR} 0 0,1 ${x2},${y2}`)

                labelGroup.append('text').classed('recovery-rate-label outer', true)
                    .style('font-size', arcFontSize)
                    .append('textPath')
                        .attr('href', `#recRate-textPath_${data.year}_${i}`)
                        .attr('startOffset', '50%')
                        .style('letter-spacing', arcLetterSp)
                        .text(`Recovery rate ${data.year}`)
            })

            // Numeral
            const numFontSize = innerR * 0.9,
                pctFontSize   = numFontSize * 0.25,
                numBaseline   = arcCentY + numFontSize * 0.15,
                recoveryInt   = Math.round(parseFloat(totalRecoveryRate))

            const numeral = labelGroup.append('text')
                .classed('recovery-rate-label value', true)
                .attr('x', arcCentX).attr('y', numBaseline)
                .attr('dy', numFontSize * 0.15)
                .style('font-size', numFontSize)
                .text(recoveryInt)

            const pctY = numBaseline - numFontSize * 0.72 + pctFontSize * 0.72

            const pct = labelGroup.append('text')
                .classed('recovery-rate-label pct', true)
                .attr('y', pctY)
                .attr('dy', numFontSize * 0.2)
                .style('font-size', pctFontSize).text('%')

            requestAnimationFrame(() => requestAnimationFrame(() => {
                const len = numeral.node().getComputedTextLength()
                pct.attr('x', arcCentX + len / 2 + innerR * 0.01)
            }))
        }
    }

    #renderWasteBreakdownTreemap(data, layout, options = {}) {

        ////////////////////////
        /// I. CONFIG & DATA ///
        ////////////////////////

        const { x, y, width, height } = layout  
        
        const {
            showAnnotation   = true,
            showTooltips     = true,
            seedOuter        = 26,
            seedInner        = 0,
        } = options

        const vis        = options.visGroup  ?? this.el.vis.group
        const annotation = options.annotGroup ?? this.el.annotation.group

        const SECTORS = ['MSW', 'C&I', 'C&D']

        //////////////////////////////
        /// II.  LAYOUT & GEOMETRY ///
        //////////////////////////////

        const dims = {
            width,
            height,
            border: {
                outer: width * 0.002,
                inner: width * 0.001,
            }
        }

        ///////////////////////////
        /// III. TREEMAP LAYOUT ///
        ///////////////////////////

        this.generator.treemap = {}

        this.generator.treemap.outer = d3.treemap()
            .size([dims.width, dims.height])
            .tile(d3.treemapBinary)
            .paddingOuter(dims.border.outer)
            .paddingInner(dims.border.outer)

        const streamNames = [...new Set(
            SECTORS.flatMap(sector => Object.keys(data.bySector[sector] || {}))
        )]

        const outerHierarchy = d3.hierarchy({
            name: 'root',
            children: deterministicShuffle(
                streamNames.map(name => ({
                    name,
                    value: SECTORS.reduce((sum, sector) =>
                        sum + (data.bySector[sector]?.[name]?.['Generated'] ?? 0), 0)
                })),
                seedOuter
            )
        }).sum(d => d.value)

        this.generator.treemap.outer(outerHierarchy)

        const allLeaves = []

        outerHierarchy.children.forEach(streamNode => {
            const name = streamNode.data.name,
                sw = streamNode.x1 - streamNode.x0,
                sh = streamNode.y1 - streamNode.y0

            const innerHierarchy = d3.hierarchy({
                name,
                children: deterministicShuffle(
                    SECTORS.map(sector => ({
                        name,
                        sector,
                        total:    data.bySector[sector]?.[name]?.['Generated']    ?? 0,
                        recovery: (data.bySector[sector]?.[name]?.['Recovery rate'] ?? 0) / 100,
                    })).filter(d => d.total > 0),
                    seedInner
                )
            }).sum(d => d.total)

            this.generator.treemap[name] = d3.treemap()
                .size([sw, sh])
                .tile(d3.treemapBinary)
                .paddingOuter(dims.border.outer / 2)
                .paddingInner(dims.border.inner)

            this.generator.treemap[name](innerHierarchy)

            innerHierarchy.leaves().forEach(leaf => {
                leaf.x0 += streamNode.x0
                leaf.x1 += streamNode.x0
                leaf.y0 += streamNode.y0
                leaf.y1 += streamNode.y0
                allLeaves.push(leaf)
            })
        })

        ///////////////////////////
        /// IV. RENDER TREEMAP  ///
        ///////////////////////////

        const treemap = vis.append('g')
            .classed('treemap', true)
            .attr('transform', `translate(${x}, ${y})`)

        treemap.append('rect')
            .classed('treemap-bg', true)
            .attr('width', dims.width)
            .attr('height', dims.height)

        const cells = treemap.selectAll('g.treemap-cell')
            .data(allLeaves)
            .join('g')
            .classed('treemap-cell', true)
            .attr('transform', d => `translate(${d.x0},${d.y0})`)

        cells.each(function(d) {
            const cellWidth  = Math.max(0, d.x1 - d.x0),
                cellHeight   = Math.max(0, d.y1 - d.y0)

            if (cellWidth < 1 || cellHeight < 1) return

            const g            = d3.select(this),
                r              = d.data.recovery,
                halfBorder     = dims.border.inner / 2,
                sectorClass    = DataVis.CONFIG.map.sectorClass[d.data.sector],
                isFlipped      = hashFlip(d.data.name + d.data.sector),
                isHorizontal   = cellWidth >= cellHeight

            if (isHorizontal) {
                const recoveredWidth = cellWidth * r,
                    landfillWidth    = cellWidth - recoveredWidth

                if (recoveredWidth > 0)
                    g.append('rect').classed(`${sectorClass} recovered`, true)
                        .attr('x', isFlipped ? landfillWidth + halfBorder : 0)
                        .attr('y', 0)
                        .attr('width',  Math.max(0, recoveredWidth - halfBorder))
                        .attr('height', cellHeight)

                if (landfillWidth > 0)
                    g.append('rect').classed(`${sectorClass} landfill`, true)
                        .attr('x', isFlipped ? 0 : recoveredWidth + halfBorder)
                        .attr('y', 0)
                        .attr('width',  Math.max(0, landfillWidth - halfBorder))
                        .attr('height', cellHeight)

            } else {
                const recoveredHeight = cellHeight * r,
                    landfillHeight    = cellHeight - recoveredHeight

                if (recoveredHeight > 0)
                    g.append('rect').classed(`${sectorClass} recovered`, true)
                        .attr('x', 0)
                        .attr('y', isFlipped ? 0 : landfillHeight + halfBorder)
                        .attr('width',  cellWidth)
                        .attr('height', Math.max(0, recoveredHeight - halfBorder))

                if (landfillHeight > 0)
                    g.append('rect').classed(`${sectorClass} landfill`, true)
                        .attr('x', 0)
                        .attr('y', isFlipped ? recoveredHeight + halfBorder : 0)
                        .attr('width',  cellWidth)
                        .attr('height', Math.max(0, landfillHeight - halfBorder))
            }

            if (showTooltips)
                g.append('rect').classed('treemap-hit-area', true)
                    .attr('x', 0).attr('y', 0)
                    .attr('width', cellWidth).attr('height', cellHeight)
        })

        /////////////////////
        /// V. ANNOTATION ///
        /////////////////////

        if (showAnnotation) {
            const EPS      = dims.border.outer + 1,
                labelPad = width * 0.007,
                labelFs  = width * 0.008

            const addLabel = (lx, ly, anchor, rotate, text) => {
                treemap.append('text')
                    .classed('stream-label', true)
                    .attr('x', lx).attr('y', ly)
                    .attr('text-anchor', anchor)
                    .attr('font-size', labelFs)
                    .attr('transform', rotate
                        ? `rotate(${rotate[0]}, ${rotate[1]}, ${rotate[2]})`
                        : null)
                    .text(text)
            }

            outerHierarchy.children.forEach(streamNode => {
                const { x0, x1, y0, y1 } = streamNode,
                    name  = streamNode.data.name,
                    cx    = (x0 + x1) / 2,
                    cy    = (y0 + y1) / 2,
                    sw    = x1 - x0,
                    sh    = y1 - y0

                const tT = y0 <= EPS,
                    tB   = y1 >= dims.height - EPS,
                    tL   = x0 <= EPS,
                    tR   = x1 >= dims.width  - EPS

                const isCorner = (tT || tB) && (tL || tR)

                if (isCorner) {
                    const [a, b] = getBestSplit(name) || [name, name]
                    const corners = {
                        TL: [[x0, y0 - labelPad, 'start', null, b],
                            [x0 - labelPad, y0, 'end', [-90, x0 - labelPad, y0], a]],
                        TR: [[x1, y0 - labelPad, 'end', null, a],
                            [x1 + labelPad, y0, 'start', [90, x1 + labelPad, y0], b]],
                        BL: [[x0, y1 + labelPad, 'end', [180, x0, y1 + labelPad], a],
                            [x0 - labelPad, y1, 'start', [-90, x0 - labelPad, y1], b]],
                        BR: [[x1, y1 + labelPad, 'start', [180, x1, y1 + labelPad], b],
                            [x1 + labelPad, y1, 'end', [90, x1 + labelPad, y1], a]],
                    }
                    const key = `${tT ? 'T' : 'B'}${tL ? 'L' : 'R'}`
                    corners[key].forEach(args => addLabel(...args))
                } else {
                    const preferV = sh > sw
                    const edges = [
                        [preferV && tL, x0 - labelPad, cy,          'middle', [-90, x0 - labelPad, cy]],
                        [preferV && tR, x1 + labelPad, cy,          'middle', [ 90, x1 + labelPad, cy]],
                        [tT,            cx,             y0 - labelPad, 'middle', null],
                        [tB,            cx,             y1 + labelPad, 'middle', null],
                        [tL,            x0 - labelPad, cy,          'middle', [-90, x0 - labelPad, cy]],
                        [tR,            x1 + labelPad, cy,          'middle', [ 90, x1 + labelPad, cy]],
                    ]
                    const match = edges.find(([cond]) => cond)
                    if (match) {
                        const [, lx, ly, anchor, rotate] = match
                        addLabel(lx, ly, anchor, rotate, name)
                    }
                }
            })
        }

        ///////////////////
        /// VI. TOOLTIPS //
        ///////////////////

        if (showTooltips) {
            const tip = this.el.tooltip.treemap = document.querySelector('#tooltip')

            cells
                .on('mousemove', (event, d) => {
                    const pctRecovered  = Math.round(d.data.recovery * 100),
                        pctLandfilled   = 100 - pctRecovered,
                        rect            = this.el.svg.node().getBoundingClientRect()

                    tip.style.opacity = 1
                    tip.style.left    = (event.clientX - rect.left + 14) + 'px'
                    tip.style.top     = (event.clientY - rect.top  - 10) + 'px'
                    tip.innerHTML     = `<strong>${d.data.name}</strong><br>${d.data.sector}<br>
                                        ${pctRecovered}% recovered<br>${pctLandfilled}% to landfill`
                })
                .on('mouseleave', () => { tip.style.opacity = 0 })
        }

        //////////////////////
        /// HELPER METHODS ///
        //////////////////////

        function hashFlip(str) {
            let h = 0
            for (let i = 0; i < str.length; i++)
                h = (Math.imul(31, h) + str.charCodeAt(i)) | 0
            return Math.abs(h) % 2
        }

        function deterministicShuffle(arr, seed) {
            const a = [...arr]
            for (let i = a.length - 1; i > 0; i--) {
                let h = 0
                const key = (a[i].name || a[i].sector || '') + i
                for (let k = 0; k < key.length; k++)
                    h = (Math.imul(31, h) + seed + key.charCodeAt(k)) | 0
                const j = Math.abs(h) % (i + 1);
                [a[i], a[j]] = [a[j], a[i]]
            }
            return a
        }

        function getBestSplit(name) {
            const words = name.split(' ')
            if (words.length === 1) return null
            const mid = name.length / 2
            let bestIdx = 0, bestDist = Infinity, pos = 0
            for (let i = 0; i < words.length - 1; i++) {
                pos += words[i].length + 1
                const dist = Math.abs(pos - mid)
                if (dist < bestDist) { bestDist = dist; bestIdx = i + 1 }
            }
            return [words.slice(0, bestIdx).join(' '), words.slice(bestIdx).join(' ')]
        }
    }

    #renderRecoveryBreakdown({ svg, apexX, apexY, baseY, segments }) {

        const total = d3.sum(segments, s => s.value)
        if (total === 0) return

        const h      = baseY - apexY
        const side   = (2 * h) / Math.sqrt(3)
        const halfW  = side / 2
        const leftX  = apexX - halfW
        const rightX = apexX + halfW

        // Cumulative split x positions along base
        let cum = 0
        const splits = segments.slice(0, -1).map(s => {
            cum += s.value / total
            return leftX + (rightX - leftX) * cum
        })

        segments.forEach((seg, i) => {
            const lbX = i === 0           ? leftX       : splits[i - 1]
            const rbX = i === segments.length - 1 ? rightX : splits[i]

            svg.append('polygon')
                .classed(`recovery-segment ${seg.class}`, true)
                .attr('points', `${apexX},${apexY} ${lbX},${baseY} ${rbX},${baseY}`)
        })

        // Divider lines — stroke with background colour to create gap effect
        splits.forEach(splitX => {
            svg.append('line')
                .classed('recovery-segment-divider', true)
                .attr('x1', apexX).attr('y1', apexY)
                .attr('x2', splitX).attr('y2', baseY)
        })
    }

    #renderWasteIndustryIllustration(data, layout, options = {}){

        ////////////////////////
        /// I. CONFIG & DATA ///
        ////////////////////////

        // i. Layout and positioning
        const { x, y, w } = layout

        const { width, height, margin } = DataVis.CONFIG.dims,
            canvasWidth  = width  - margin.left - margin.right,
            canvasHeight = height - margin.top  - margin.bottom

        const scale = w / canvasWidth * 1

        // ii. Layout options
        const {
            rotateVis     = false   // enable data-driven rotation
        } = options

        // iii. SVG group references
        const vis =  this.el.illustration.wasteIndustry 

        // iv. Data used for visualisation rotation 
        const totalGenerated = data.metrics.Aggregated.generated.total,
            totalRecovered   = data.metrics.Aggregated.recovered.total

        const rotationAngle = rotateVis ? DataVis.#flowRotationAngle(totalRecovered, totalGenerated) : 0,
            rotateCx = 0,
            rotateCy = 0


        ///////////////////////////////////
        /// II. RENDER SVG ILLUSTRATION ///
        ///////////////////////////////////

        // i. Extract SVG illustration components
        const truck     = DataVis.#svgDoc.getElementById('truck')?.cloneNode(true),
            facility    = DataVis.#svgDoc.getElementById('waste-facility')?.cloneNode(true),
            bins        = DataVis.#svgDoc.getElementById('collection-bins')?.cloneNode(true),
            road        = DataVis.#svgDoc.getElementById('road')?.cloneNode(true)


        // ii. Position illustration components
        const illustrationGroup = this.el.illustration.wasteIndustry.append('g').classed('illustration-group-wrapper', true)
            .attr('transform', `translate(${x}, ${y}) scale(${scale})`);

        // iii. Add components and position with transforms
        // illustrationGroup.append(() => road)
        illustrationGroup.append(() => truck).attr('transform', `translate( ${ w * 0.15}, 0) scale(-1, 1)`)
        // illustrationGroup.append(() => truckRight).attr('transform', `translate( ${ DataVis.CONFIG.dims.width * 1.15}, 0)`)
        illustrationGroup.append(() => facility).attr('transform', `translate( ${w * 0.5}, 0)`)
        // illustrationGroup.append(() => road)
        illustrationGroup.append(() => bins).attr('transform', `translate( ${-DataVis.CONFIG.dims.width * 0.5}, 0)`)

    }


    //////////////////////////
    ////  PUBLIC METHODS  ////
    //////////////////////////

    render() {

        ////////////////////////
        /// I. CONFIG & DATA ///
        ////////////////////////

        const { width, height, margin } = DataVis.CONFIG.dims,
            canvasWidth  = width  - margin.left - margin.right,
            canvasHeight = height - margin.top  - margin.bottom

        const { dataModel } = this.app.module,
            year = this.app.state.select.year, 
            data = dataModel.data[year]

        ////////////////////////////////////
        /// II. GLOBAL LAYOUT & GEOMETRY ///
        ////////////////////////////////////
        
        // i. Compute rotation once from data
        const rotationAngle = this.state.rotateByRecoveryRate
            ? DataVis.#flowRotationAngle( data.metrics.Aggregated.recovered.total, data.metrics.Aggregated.generated.total)
            : 0

        // ii. Apply rotation ONCE to the shared rotation groups        
        const flowY        = margin.top + canvasHeight * 0.5,       
            streamHeight   = canvasHeight / 8,
            rotateCx       = width / 2,                     // Centre of rotation = centre of the material flow component
            rotateCy       = flowY + streamHeight / 2   

        this.el.vis.rotationGroup.attr('transform', `rotate(${rotationAngle}, ${rotateCx}, ${rotateCy})`)
        this.el.annotation.rotationGroup.attr('transform',`rotate(${rotationAngle}, ${rotateCx}, ${rotateCy})`)


        //////////////////////////////
        /// III. RENDER COMPONENTS ///
        //////////////////////////////

        // i. Circular metrics (top) section
        this.#renderCircularMetrics(data, {
            x:      width * 0.5 - canvasHeight * 0.333 * 0.5,
            y:      margin.top,
            size:   canvasHeight * 0.333,
        })

        // ii. Waste industry illustration (top-middle) 
        this.#renderWasteIndustryIllustration(data, {
            x:  width * 0.35,
            y:  margin.top + height * 0.325,
            w:  width * 0.5,
        })

        // iii. Waste material flow
        this.#renderMaterialFlow(data, {
            x:      margin.left,
            y:      flowY,
            width:  canvasWidth,
        }, {
            streamHeight:    streamHeight,
            rMinFactor:      5,
            slopePad:        width * 0.01,
            rotationAngle
        })
    }

    update() {
        const { dataModel } = this.app.module,
            year = this.app.state.select.year,
            data = dataModel.data[year]

        if (!data) {
            console.warn(`No data for year ${year}`)
            return
        }

        const { width, height, margin } = DataVis.CONFIG.dims,
            canvasWidth  = width  - margin.left - margin.right,
            canvasHeight = height - margin.top  - margin.bottom

        //////////////////////////////
        /// I. UPDATE ROTATION     ///
        //////////////////////////////

        const rotationAngle = this.state.rotateByRecoveryRate
            ? DataVis.#flowRotationAngle(
                data.metrics.Aggregated.recovered.total,
                data.metrics.Aggregated.generated.total)
            : 0

        const flowY       = margin.top + canvasHeight * 0.5,
            streamHeight  = canvasHeight / 8,
            rotateCx      = width / 2,
            rotateCy      = flowY + streamHeight / 2

        this.el.vis.rotationGroup
            .transition()
            .duration(DataVis.CONFIG.animation.duration)
            .attr('transform', `rotate(${rotationAngle}, ${rotateCx}, ${rotateCy})`)

        this.el.annotation.rotationGroup
            .transition()
            .duration(DataVis.CONFIG.animation.duration)
            .attr('transform', `rotate(${rotationAngle}, ${rotateCx}, ${rotateCy})`)

        //////////////////////////////
        /// II. CLEAR & REDRAW     ///
        //////////////////////////////

        // Clear all rendered content — groups were set up in #initVis
        // and are preserved; only their children are cleared
        this.el.vis.circularMetricsShapes.selectAll('*').remove()
        this.el.annotation.circularMetrics.selectAll('*').remove()

        this.el.vis.materialFlow.selectAll('*').remove()
        this.el.annotation.materialFlow.selectAll('*').remove()

        this.el.illustration.wasteIndustry.selectAll('*').remove()

        // Clear defs that are year-namespaced (arc paths etc.)
        this.el.defs.selectAll('path[id*="Arc_"]').remove()
        this.el.defs.selectAll('path[id*="textPath_"]').remove()

        //////////////////////////////
        /// III. REDRAW            ///
        //////////////////////////////

        this.#renderCircularMetrics(data, {
            x:    width * 0.5 - canvasHeight * 0.333 * 0.5,
            y:    margin.top,
            size: canvasHeight * 0.333,
        })

        this.#renderWasteIndustryIllustration(data, {
            x: width * 0.35,
            y: margin.top + height * 0.35,
            w: width * 0.4,
        })

        this.#renderMaterialFlow(data, {
            x:     margin.left,
            y:     flowY,
            width: canvasWidth,
        }, {
            streamHeight:  streamHeight,
            rMinFactor:    5,
            slopePad:      width * 0.01,
            rotationAngle,
            animate:       true,          // trigger reveal animation on update
        })
    }
}



/////////////////////////////////////////
////  UNUSED / DRAFT VIS COMPONENTS  ////
/////////////////////////////////////////

function renderConeFacets(data) {
    // Canvas dimensions and positioning
    const { width, height, margin } = DataVis.CONFIG.dims,
        canvasWidth = width - margin.left - margin.right

    // Treemap dimensions and positioning
    const dims = {
        width:      canvasWidth * 1,
        height:     canvasWidth * 0.5, 
    }

    dims.column = {
        label:  dims.width * 0.20,
        1:      dims.width * 0.30,
        2:      dims.width * 0.55,
        3:      dims.width * 0.80
    } 
    dims.cell   =  dims.width * 0.05
    dims.padding = {
        row:         dims.height * 0.10,         // Gap between rows
        cellShape:   dims.height * 0.025,       // Gap between shapes
    }

    const position = {
        x: width * 0.5 - dims.width * 0.5,
        y: height * 0 + margin.top
    }


    // Sector config: ordered
    const sectors = [
        { key: "MSW", className: "msw", label: "MSW", cx: dims.column[1] },
        { key: "CI",  className: "ci",  label: "C&I", cx: dims.column[2] },
        { key: "CD",  className: "cd",  label: "C&D", cx: dims.column[3] },
    ];


    /////////////////////////////////
    /// FACET vis DATA & LAYOUT ///
    /////////////////////////////////

    // I. Materials data by sectore: sorted by aggreagte volume  
    const materials = buildMaterials(data);

    materials.sort((a, b) => {
        const total = row => sectors.reduce((sum, s) => {
            const c = row[s.key];
            return sum + (c ? c.rec + c.lan : 0);
        }, 0);
        return total(b) - total(a);
    });

    // II. Facet cell area scale
    const MAX_TONNES = deriveMaxTonnes(materials),
        MAX_PX_R     = dims.cell,
        K_TONNES     = Math.PI * MAX_PX_R * MAX_PX_R / MAX_TONNES,
        MIN_GLYPH    = dims.cell * 0.1   // ← minimum rendered r / H. Set to 0 to disable.


    // III. Layout: row distribution

    const budgets = materials.map(rowBudget);
    const HEADER_Y = 16;
    const HEADER_CLEARANCE = 100;

    let baselines = [];
    let y = HEADER_Y + HEADER_CLEARANCE;

    budgets.forEach(b => {
        y += b.maxR;
        baselines.push(y);
        y += b.maxH + dims.padding.row;
    })

    // IV. Add vis element
    const vis = this.el.vis.facets = this.el.vis.group.append('g')
        .classed('facet-vis', true)
        .attr('transform', `translate(${position.x}, ${position.y})`)
        .attr("role", "img")
        .attr("aria-label", "Faceted Bauhaus vis — Victoria waste recovery 2022-23");

    // V. Add waste sector headers
    sectors.forEach(s => {
        vis.append("text").classed(`waste-stream-label ${s.className}`, true)
            .attr("x", s.cx).attr("y", HEADER_Y)
            .style('font-size', dims.height * 0.075)
            .text(s.label);
    });

    // VI. Add rows: by waste material
    materials.forEach((row, ri) => {

        const baseline = baselines[ri];    

        // i. Repeating material label row (clipped to vis width)
        const labelText = row.label.toLowerCase() + ' -   ',
            labelSize = dims.padding.cellShape * 0.85
        const clipId = `clip-row-${ri}`;

        // Define clipPath scoped to vis width
        vis.append("clipPath")
            .attr("id", clipId)
            .append("rect")
            .attr("x", 0)
            .attr("y", baseline - dims.height * 0.03)
            .attr("width", dims.width)
            .attr("height", dims.height * 0.04);

        const labelGroup = vis.append("g")
            .classed('material-label-row', true)
            .attr("clip-path", `url(#${clipId})`);

        // Measure a single label instance, then tile to fill width
        const tempText = vis.append("text")
            .classed('material-label', true)
            .style('font-size', labelSize)
            .text(labelText);

        tempText.text(labelText + labelText);
        const labelW = tempText.node().getBBox().width / 2;
        tempText.remove();

        const repeatCount = Math.ceil(dims.width / labelW) + 1;

        d3.range(repeatCount).forEach(i => {
            labelGroup.append("text")
                .classed('material-label', true)
                .attr("x", i * labelW)
                .attr("y", baseline)
                .style('font-size', labelSize)
                .text(labelText);
        });

        // i.  Sector glyphs
        sectors.forEach(s => {
            const cell = row[s.key];
            const cx = s.cx;

            const { r, W, H } = cellGeom(cell);

            // c. Recovery rate label
            vis.append("circle").classed(`recovery-rate-label-bg ${s.className}`, true)
                .attr("cx", cx)
                .attr("cy", baseline)
                .attr("r", labelSize * 2)
                .style('fill', '#fff')


            vis.append("text").classed(`recovery-rate-label ${s.className}`, true)
                .attr("x", cx)
                .attr("y", baseline)
                .style('font-size', labelSize * 1.25)
                .text(`${cell.rate}%`)


            // a. Recovered volume circle with class key
            if (r > 0) {    
                vis.append("circle").classed(`recovered ${s.className}`, true)
                    .attr("cx", cx)
                    .attr("cy", baseline - r - dims.padding.cellShape)
                    .attr("r", r)
            }

            // b. Landfill volume triangle
            if (H > 0) {
                const triTop = baseline + dims.padding.cellShape,
                    strokeWidth = H  / dims.width * 100 // Scaled stroke width

                vis.append("polygon").classed('landfill', true)
                    .attr("points", `${cx - W / 2},${triTop} ${cx + W / 2},${triTop} ${cx},${triTop + H}`)
                    .attr("stroke-width", strokeWidth)  
            }
        })
    })


    //////////////////////
    /// HELPER METHODS ///
    //////////////////////

    function buildMaterials(data) {
        const sectorKeys = { MSW: "MSW", CI: "C&I", CD: "C&D" };

        // Collect all material stream names from bySector > All
        const streamNames = Object.keys(data.bySector.All);

        return streamNames.map(streamName => {
            const row = { label: streamName };

            Object.entries(sectorKeys).forEach(([visKey, dataKey]) => {
                const cell = data.bySector[dataKey][streamName];
                if (!cell) {
                    row[visKey] = null;
                    return;
                }
                const rec = cell["Recovered - total"] ?? 0;
                const lan = cell["Disposed"] ?? 0;
                const rate = cell["Recovery rate"] ?? 0;
                row[visKey] = { rec, lan, rate };
            });

            return row;
        });
    }

    function deriveMaxTonnes(materials) {
        let max = 0;
        materials.forEach(row => {
            ["MSW", "CI", "CD"].forEach(key => {
                const cell = row[key];
                if (!cell) return;
                if (cell.rec > max) max = cell.rec;
                if (cell.lan > max) max = cell.lan;
            });
        });
        return max;
    }

    function cellGeom(cell, clamp = true) {
        const r    = cell.rec === 0 ? 0 : Math.sqrt(cell.rec * K_TONNES / Math.PI);
        let W = 0, H = 0;
        if (cell.lan > 0) {
            const triArea = cell.lan * K_TONNES;
            W = Math.sqrt((4 * triArea) / Math.sqrt(3));
            H = W * Math.sqrt(3) / 2;
        }
        if (!clamp || MIN_GLYPH === 0) return { r, W, H };
        // Clamp rendered sizes up to MIN_GLYPH, preserving W/H ratio
        const rC = r > 0 ? Math.max(r, MIN_GLYPH) : 0;
        const HC = H > 0 ? Math.max(H, MIN_GLYPH) : 0;
        const WC = HC > 0 ? HC / (Math.sqrt(3) / 2) : 0;
        return { r: rC, W: WC, H: HC };
    }

    function rowBudget(row) {
        let maxR = 0, maxH = 0;
        sectors.forEach(s => {
            const cell = row[s.key];
            if (!cell) return;
            const { r, H } = cellGeom(cell, false);   // ← unclipped for layout
            if (r > maxR) maxR = r;
            if (H > maxH) maxH = H;
        });
        return { maxR: maxR + dims.padding.cellShape, maxH: maxH + dims.padding.cellShape };
    }
}
