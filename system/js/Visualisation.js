// Libs and data
import * as d3      from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import { svgScene } from "../assets/scene.js";

// Classes
import { DataVis } from "../../_shared/js/DataVis.js";
import { WasteBreakdownTreemap } from "../../_shared/js/WasteBreakdownTreemap.js";


// => Data Visualisation class
export class SystemVis extends DataVis{

    /////////////////
    //// FIELDS  ////
    /////////////////

    state = {
        layout:                     'd',      // 'T' or 't' | 'd' | 'six' | 'snail'
        flowConfig: {
            yPosition:              0.4 ,          // User setting to set the vertical position of the top of the circular flow component
            circularFlowMultiple:   5.25,              // User setting to set the relative size of the circular flow component
            flowHeightMultiple:     1/8,            // User setting to set width of linear system flows 
            rotateByRecoveryRate:   true,           // User setting to apply rotation to horizontal (T and snail) layouts
            circleDirection:        'clockwise',    // 'clockwise' | 'anticlockwise' : set by layout in "applyLayoutComponents"
            reverseFlow:            false,          // Boolean for reversins the flow direction so that disposal is on the left and generation is on the right
            reverseSort:            false,          // Boolean for sort order of source and stream flows: set by layout in "applyLayoutComponents"
            rotateDisposal:         false,          // Boolean for setting direction of the disposal triangle (and adjoining disposal streams): set by layout in "applyLayoutComponents"
            invertCircularFlow:     false,          // Boolean for inverting circular flow (rotate 180deg)
        },

        render: {
            ceMetrics:              true,
            flows:                  true,
            flowsCircular:          true,
            recoveryBreakdown:      true,       
            illustration:           true,
        }
    }

    // SVG ELEMENTS
    el = {
        svg:            undefined,
        defs:           undefined,
        background:     undefined,
        vis: {
            group:      undefined,
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
        super(app)

        // Init and render vis
        this.#applyLayoutComponents(app)
        this.#initVis()         // Setup of visualisation components
        this.render()           // Renders selected data (reusable to be called on update)
    }

    ///////////////////////////
    ////  PRIVATE METHODS  ////
    ///////////////////////////

    #applyLayoutComponents(app){

        if(app.queryParams.layout) this.state.layout = app.queryParams.layout

        switch(this.state.layout){
            case 't':
            case 'T':
                // Components
                this.state.render.ceMetrics = true
                this.state.render.flows = true
                this.state.render.flowsCircular = true
                this.state.render.recoveryBreakdown = true
                this.state.render.illustration = true
                // Circular flow direction and sort order
                this.state.flowConfig.circleDirection = 'clockwise'
                this.state.flowConfig.invertCircularFlow = false
                this.state.flowConfig.reverseSort = false
                this.state.flowConfig.reverseFlow = false
                this.state.flowConfig.rotateDisposal = false
                break

            case 'd':
                // Components
                this.state.render.ceMetrics = false
                this.state.render.flows = true
                this.state.render.flowsCircular = true
                this.state.render.recoveryBreakdown = true
                this.state.render.illustration = false
                // Circular flow direction and sort order
                this.state.flowConfig.circleDirection = 'clockwise'
                this.state.flowConfig.invertCircularFlow = false
                this.state.flowConfig.reverseSort = false
                this.state.flowConfig.reverseFlow = false
                this.state.flowConfig.rotateDisposal = true
                break

            case 'six':  case '6': case 6:
                // Components
                this.state.render.ceMetrics = false
                this.state.render.flows = true
                this.state.render.flowsCircular = true
                this.state.render.recoveryBreakdown = true
                this.state.render.illustration = false
                // Circular flow direction and sort order
                this.state.flowConfig.circleDirection = 'anticlockwise'
                this.state.flowConfig.invertCircularFlow = false
                this.state.flowConfig.reverseSort = false
                this.state.flowConfig.reverseFlow = true
                this.state.flowConfig.rotateDisposal = true
                break

            case 'snail':
                // Components
                this.state.render.ceMetrics = false
                this.state.render.flows = true
                this.state.render.flowsCircular = true
                this.state.render.recoveryBreakdown = false
                this.state.render.illustration = true
                // Circular flow direction and sort order
                this.state.flowConfig.circleDirection = 'anticlockwise'
                this.state.flowConfig.invertCircularFlow = true
                this.state.flowConfig.reverseSort = false
                this.state.flowConfig.reverseFlow = false
                this.state.flowConfig.rotateDisposal = false
                break
        }

        // Other settings
        if(app.queryParams.illustration) 

        if(app.queryParams.year){
            const isValidYear = this.app.module.dataModel.schema.years.map( d=> d.year).includes(+app.queryParams.year)
            if(isValidYear) this.app.state.select.year = +app.queryParams.year
        }

        if(app.queryParams.flat) this.state.flowConfig.rotateByRecoveryRate = false
        
        if(app.queryParams.flow){ this.state.render.ceMetrics = false}

    }

    #initVis() {

        // I. Setup SVG and defs use in vs
        const { width, height, margin } = DataVis.CONFIG.dims

        const svg = this.el.svg = d3.select('svg#data-vis')
            .attr('viewBox', [0, 0, width, height])
            .classed('svg-vis', true)

        const defs = this.el.defs = svg.select('defs') ?? svg.append('defs')

        // II. BACKGROUND GROUP
        this.el.background = svg.append('g').classed('background-group', true)
        this.el.background.circularMetrics = this.el.background .append('g').classed('ce-metrics-bg', true)

        // this.el.background.append('line')
        //     .attr('x1', width * 0.5).attr('x2', width * 0.5)
        //     .attr('y1', 0) .attr('y1', height)
        //     .style('stroke', '#000')
        //     .style('stroke-dasharray', '4 4')

        // this.el.background.append('line')
        //     .attr('y1', width * 0.5).attr('y2', width * 0.5)
        //     .attr('x1', 0) .attr('x2', width)
        //     .style('stroke', '#000')
        //     .style('stroke-dasharray', '4 4')

        // III. VIS COMPONENT GROUPS 
        const visGroup = this.el.vis.group = svg.append('g').classed('vis-group', true)

         this.el.vis.recoveryBreakdown = visGroup.append('g').classed('recovery-breakdown', true)

        // i. Rotation group: all component that rotate with recovery rate 
        const rotationGroup = this.el.vis.rotationGroup = visGroup.append('g').classed('rotation-group', true)

        this.el.vis.materialFlow   = rotationGroup.append('g').classed('material-flow', true)
        this.el.vis.treemap        = rotationGroup.append('g').classed('treemap-group', true)
        this.el.vis.wasteIndustry  = rotationGroup.append('g').classed('waste-industry-illustration', true)


        // ii. Circular economy metrics: not rotated
        const ceMetrics = this.el.vis.circularMetrics = visGroup.append('g').classed('ce-metrics', true)
        this.el.vis.circularMetricsShapes = ceMetrics.append('g').classed('ce-metrics-shapes', true)

        // IV. ANNOTATION — split: ce-metrics stays outside rotation, materialFlow inside
        const annotationGroup = this.el.annotation.group = svg.append('g').classed('annotation-group', true)
        this.el.annotation.circularMetrics = annotationGroup.append('g').classed('ce-metrics-annotation', true)
        this.el.annotation.rotationGroup = annotationGroup.append('g').classed('rotation-annotation-group', true)
        this.el.annotation.materialFlow = this.el.annotation.rotationGroup.append('g').classed('material-flow-annotation', true)
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
            annotation  = this.el.annotation.circularMetrics,
            background  = this.el.background.circularMetrics

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

        // Circularity rate label bg 
        shapeGroup.append('circle').classed('circularity-rate-label-bg', true)
            .attr('cx', cx)
            .attr('cy', cy)
            .attr('r', r * 1.35)

        // SMC circle
        shapeGroup.append('circle').classed('smc orb', true)
            .attr('cx', cx)
            .attr('cy', cy)
            .attr('r', r)


        //////////////////////
        /// V. TITLE BLOCK ///
        //////////////////////

        const titleGroup = annotation.append('g')
            .classed('consumption-title-group', true)
            .attr('transform', `translate(${-DataVis.CONFIG.dims.margin.left + DataVis.CONFIG.dims.width * 0.175}, ${ DataVis.CONFIG.dims.height * 0.25}) rotate(${rotation - 90})`)

        const titleFs = DataVis.CONFIG.dims.height * 0.025

        titleGroup.append('text').classed('material-consumption-label section-title', true)
            .attr('y', + DataVis.CONFIG.dims.height * 0.0475)
            .style('font-size', titleFs)
            .text('Our consumption')

        const titleBackgroundGroup = background.append('g')
            .classed('consumption-title-bg-group', true)
            .attr('transform', `translate(${-DataVis.CONFIG.dims.margin.left + DataVis.CONFIG.dims.width * 0.175}, ${ DataVis.CONFIG.dims.height * 0.365}) rotate(${rotation - 90})`)

        titleBackgroundGroup.append('rect').classed('title-bar material-consumption', true)
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
            crLabelGroup.append('text').classed('circularity-rate outer-description', true)
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
            pctFontSize = numFontSize * 0.3,
            numBaseline = cy + numFontSize * 0.3

        const numeral = crLabelGroup.append('text').classed('circularity-rate', true)
            .attr('x', cx)
            .attr('y', numBaseline)
            .style('font-size', numFontSize)
            .text(d3.format('.2')(circularityRate * 100))
        const pctY = numBaseline - (numFontSize * 0.72) + (pctFontSize * 0.72)

        const pct = crLabelGroup.append('text').classed('circularity-rate pct', true)
            .attr('y', pctY)
            .attr('dx', pctFontSize * 0.5)
            .attr('dy', pctFontSize * 0.2)
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
            streamHeight        = width * 0.25,
            elbowRatio          = 0.5,
            slopeAngleDeg       = 60,
            rMinFactor          = 3,
            labelOffsetRatio    = 0.5,
            slopePad            = 0,
            rotationAngle       = 0,
            animate             = false,
            trianglePosition    = 'bottom',
            bumpByRecovery      = true,
            bumpByDisposal      = true,
            kinkPositionGen     = 0.15,
            kinkPositionDis     = 0.65,
            generationMode      = 'treemap',
            connectorWidth      = null,        // null here — defaulted below once genSquareSize is known
            reverseFlow         = this.state.flowConfig.reverseFlow,    
            circleDirection     = this.state.flowConfig.circleDirection,
            invertCircularFlow  = this.state.flowConfig.invertCircularFlow
        } = options

        const vis        = this.el.vis.materialFlow
        const annotation = this.el.annotation.materialFlow

        const dur = DataVis.CONFIG.animation.duration

        // Stream data — base fields not in #computeFlowGeometry
        const streamExtra = Object.fromEntries(
            Object.entries(data.byStream).map(([name, d]) => [name, {
                disposed:     d.sectors?.All?.Disposed          ?? 0,
                recoveryRate: d.sectors?.All?.['Recovery rate'] ?? 0,
            }])
        )

        const { Aggregated } = data.metrics,
            totalGenerated    = Aggregated.generated.total,
            totalDisposed     = Aggregated.disposed.total,
            totalRecovered    = Aggregated.recovered.total,
            disposalRatio     = totalDisposed / totalGenerated,
            totalRecoveryRate = Aggregated.recoveryRate.toFixed(1)

        /////////////////////////////
        /// II. CALCULATE LAYOUT  ///
        /////////////////////////////

        // Use computeFlowGeometry helped
        const {
            streams: baseStreams, n, slotH, lineYs, rMin, radii, scale: flowScale, arcCentY, groupTop, groupBot, genSquareSize, 
        } = SystemVis.#computeFlowGeometry(data, DataVis.CONFIG.dims, {
            rMinFactor: this.state.circularFlowMultiple,
            streamHeight,
            flowY: y,
            reverseFlow
        })

        // Merge extra fields into streams
        const streams = baseStreams.map(s => ({ ...s, ...streamExtra[s.name], }))

        // Assign computed scale
        this.scale.materialFlow = flowScale

        // Calculate geometry points 
        const elbowX   = reverseFlow ? width * (1 - elbowRatio) : width * elbowRatio,
            slopeAngle = slopeAngleDeg * Math.PI / 180

        const genSquareLeft = reverseFlow ? x + width - genSquareSize : x
        const tGenTop     = this.scale.materialFlow(streams[0].generated),
            tGenBot       = this.scale.materialFlow(streams[n-1].generated)

        const resolvedConnectorWidth = connectorWidth ?? genSquareSize

        const triInnerRad   = 60 * Math.PI / 180,
            triArea         = disposalRatio * genSquareSize * genSquareSize,
            triSide         = Math.sqrt(triArea * 4 / Math.sqrt(3)),
            triH            = (Math.sqrt(3) / 2) * triSide,
            triTopY         = trianglePosition === 'bottom' ? groupBot - triH : groupBot + slotH * 0.5,
            Bx              = reverseFlow
                                ? x + (slopeAngleDeg !== 60 ? triSide * 1 : 0)
                                : (x + width) - (slopeAngleDeg !== 60 ? triSide * 1 : 0),
            By              = triTopY,
            Ax              = Bx - triSide,
            Ay              = triTopY,
            Cx              = Ax + triSide * Math.cos(triInnerRad),
            Cy              = Ay + triSide * Math.sin(triInnerRad),
            tSlopeTotal     = this.scale.materialFlow(totalDisposed) * 0.5,
            miterDx         = tSlopeTotal / (2 * Math.tan(slopeAngle)) ,

            slopeEndX = reverseFlow
                ? Bx + triSide * 0.5 + slopePad 
                : Ax - slopePad - miterDx + triSide / 2,

            slopeEndY    = Cy,

            slopeStartY  = trianglePosition === 'bottom'
                ? lineYs[0] - this.scale.materialFlow(streams[0].generated) / 2 + this.scale.materialFlow(streams[0].disposed) / 2
                : lineYs[0] - tGenTop / 2 + this.scale.materialFlow(streams[0].disposed) / 2,

            slopeStartX  = reverseFlow
                ? slopeEndX + (slopeEndY - slopeStartY) / Math.tan(slopeAngle)   // mirror
                : slopeEndX - (slopeEndY - slopeStartY) / Math.tan(slopeAngle),

            slopeXatY    = reverseFlow
                ? cy => slopeEndX + (slopeEndY - cy) / Math.tan(slopeAngle)      // mirror
                : cy => slopeEndX - (slopeEndY - cy) / Math.tan(slopeAngle)

        // Store for illustration positioning
        this._lastFlowGeom = { slopeStartX, x }

        // Recovery arc centroid
        let sumCy = 0
        streams.forEach((s, i) => {
            const tGen = this.scale.materialFlow(s.generated),
                tRec   = this.scale.materialFlow(s.recovered),
                recCy  = (lineYs[i] + tGen / 2) - tRec / 2
            sumCy += recCy + radii[i]
        })

        const arcCentX = x + elbowX,
            innerR     = rMin * 0.7

        ////////////////////////////////
        /// III. STAGE Y POSITIONS   ///
        ////////////////////////////////

        const recoveredOrder = [...streams]
            .sort((a, b) => b.recovered - a.recovered)
            .map(s => s.name)

        const disposedOrder = [...streams]
            .sort((a, b) => b.disposed - a.disposed)
            .map(s => s.name)

        const stageYs = {
            generated: Object.fromEntries(streams.map((s, i) => [s.name, lineYs[i]])),
            recovered: Object.fromEntries(recoveredOrder.map((name, rank) => [name, lineYs[rank]])),
            disposed:  Object.fromEntries(disposedOrder.map((name, rank)  => [name, lineYs[rank]])),
        }

        // Bundle geometry for sub-components
        const sharedGeom = {
            x, y, width, streams, n, slotH, lineYs, elbowX,
            rMin, radii, slopeAngle, slopeAngleDeg, slopePad,
            genSquareSize, genSquareLeft, groupTop, groupBot, 
            tGenTop, tGenBot,
            Ax, Ay, Bx, By, Cx, Cy, triSide, triH, triTopY,
            tSlopeTotal, slopeStartX, slopeStartY, slopeEndX, slopeEndY, slopeXatY,
            arcCentX, arcCentY, innerR,
            totalGenerated, totalDisposed, totalRecovered,
            disposalRatio, totalRecoveryRate,
            trianglePosition, slopePad,
            rotationAngle, labelOffsetRatio,
            stageYs, recoveredOrder, disposedOrder,
            bumpByRecovery, bumpByDisposal, kinkPositionGen, kinkPositionDis,
            reverseFlow, circleDirection, invertCircularFlow
        }

        //////////////////////////////
        /// IV. RENDER COMPONENTS  ///
        //////////////////////////////

        this.#materialFlow.renderFlowTitle(annotation, sharedGeom, data.year)

        
        const genResult = this.#materialFlow.renderFlowGeneration(
            vis, annotation, data, sharedGeom,
            { 
                generationMode, 
                connectorWidth:  resolvedConnectorWidth,
                connectorStyle:  options.connectorStyle ?? 'angular',
                animate,
                delay: 0,
            }
        )

        sharedGeom.genStartX = genResult?.streamStartX ?? (x + genSquareSize)

        this.#materialFlow.renderFlowLines(vis, annotation, sharedGeom, {
            animate,
            bumpByRecovery,
            bumpByDisposal,
            kinkPositionGen,
            kinkPositionDis,

        })

        if(this.state.render.recoveryBreakdown)
            this.#materialFlow.renderRecoveryBreakdown(vis, annotation, data, sharedGeom, {
                animate,
                delay: dur * 0.5,
            })

        if(this.state.render.flowsCircular)
            this.#renderRecoveryCircleChart(
                vis, annotation, data,
                { x, y, width, streamHeight },
                {
                    direction:          this.state.flowConfig.circleDirection,
                    sortBy:           bumpByRecovery ? 'recovered' : 'generated',
                    elbowRatio,
                    rMinFactor,
                    showStreamLabels: false,
                    showRateLabels:   false,
                    showCentreLabel:  true,
                    counterRotation:  -rotationAngle,
                    animate,
                    delay:            DataVis.CONFIG.animation.duration * 0.3,
                    overrideLineYs:   bumpByRecovery ? stageYs.recovered : null,
                }
            )

        this.#materialFlow.renderDisposal(vis, annotation, sharedGeom, { 
            trianglePosition: 'bottom',
            animate,
            delay: dur,
        })

        this.#materialFlow.renderWasteFateLabels(annotation, sharedGeom, data, {
            animate,
            delay: dur * 1.2,
        })

        this.#materialFlow.renderWasteManagementLabels(annotation, sharedGeom, data, {
            animate,
            delay: 0,
        })
    }

    // Material flow graphic component methods         
    #materialFlow = {   
        renderFlowTitle: (annotation, g, year) => {
            const titleGroup = annotation.append('g').classed('waste-title-group', true)
                .attr('transform', `translate(${DataVis.CONFIG.dims.margin.left}, ${g.groupTop - g.slotH * 0.8 * g.n})`)

            const titleFs = DataVis.CONFIG.dims.height * 0.025

            titleGroup.append('text').classed('waste-industry-label section-title', true)
                .style('font-size', titleFs)
                .text('Managing our waste')

            titleGroup.append('rect').classed('title-bar waste-industry', true)
                .attr('y',  -DataVis.CONFIG.dims.height * 0.035)
                .attr('width', g.width * 1.25)
                .attr('height', g.slotH * 0.1 * g.n)
        },

        renderFlowGeneration: (vis, annotation, data, g, options = {}) => {
            const {
                generationMode = 'treemap',
                connectorWidth = g.genSquareSize,
            } = options

            const reverseFlow = g.reverseFlow ?? false
            const squareLeft  = reverseFlow ? g.x + g.width - g.genSquareSize : g.x
            const squareRight = squareLeft + g.genSquareSize
            const connRight   = reverseFlow ? squareLeft - connectorWidth : squareRight + connectorWidth

            switch(generationMode){
                case 'sectorBands':
                    return this.#materialFlow.renderFlowGenerationSectorBands(
                        vis, annotation, data, g, { 
                            connectorWidth, 
                            connectorStyle:  options.connectorStyle ?? 'angular',
                            animate:         options.animate        ?? false,
                            delay:           options.delay          ?? 0,
                            squareLeft,      // ← pass computed values through
                            squareRight,
                            connRight,
                        }
                    )

                case 'treemap':
                    vis.append('rect').classed('generation-square', true)
                        .attr('x', squareLeft).attr('y', g.groupTop)
                        .attr('width', g.genSquareSize).attr('height', g.genSquareSize)

                    this.treemap = new WasteBreakdownTreemap(
                        vis,
                        { x: squareLeft, y: g.groupTop, width: g.genSquareSize, height: g.genSquareSize },
                        WasteBreakdownTreemap.fromDataVisData(data),
                        { showAnnotation: false, showTooltips: false }
                    )

                    return { streamStartX: reverseFlow ? connRight : squareRight }
            }
        },

        renderFlowGenerationSectorBands: (vis, annotation, data, g, options = {}) => {
            const {
                connectorWidth = g.genSquareSize,
                connectorStyle = 'angular',
                bandPadding    = g.genSquareSize * 0.02,
                animate        = false,
                delay          = 0,
                squareLeft     = g.x,
                squareRight    = g.x + g.genSquareSize,
                connRight      = squareRight + connectorWidth,
            } = options

            const reverseFlow = g.reverseFlow ?? false

            ////////////////////////
            /// I. SECTOR BANDS  ///
            ////////////////////////

            const sectors      = Object.keys(DataVis.CONFIG.map.sectorClass),
                sectorTotals   = Object.fromEntries(sectors.map(s => [s, data.metrics.Aggregated.generated.bySector[s] ?? 0])),
                totalGenerated = g.totalGenerated,
                sortedSectors  = Object.entries(sectorTotals).sort(([, a], [, b]) => b - a).map(([key]) => key)

            const totalPadding = bandPadding * (sectors.length - 1)
            const usableH      = g.genSquareSize - totalPadding

            let yPos = g.groupTop
            const bands = sortedSectors.map((sector, i) => {
                const h = (sectorTotals[sector] / totalGenerated) * usableH,
                    y   = yPos
                yPos += h + (i < sectors.length - 1 ? bandPadding : 0)
                return { sector, volume: sectorTotals[sector], h, y }
            })

            // Band rects + labels
            bands.forEach(b => {
                const sc    = DataVis.CONFIG.map.sectorClass?.[b.sector] ?? '',
                    label   = DataVis.CONFIG.map.sectorLabel?.[b.sector] ?? ''

                const bandRect = vis.append('rect')
                    .classed(`sector-band ${sc}`, true)
                    .attr('x',      squareLeft)
                    .attr('y',      b.y)
                    .attr('width',  g.genSquareSize)
                    .attr('height', b.h)

                if (animate) {
                    bandRect.style('opacity', 0)
                        .transition()
                        .duration(DataVis.CONFIG.animation.duration)
                        .delay(delay)
                        .style('opacity', 1)
                }

                if (b.h > g.genSquareSize * 0.06) {
                    const labelFs      = g.genSquareSize * 0.1,
                        parts          = label.split('&'),
                        isMultiLine    = parts.length > 1,
                        labelPadX      = g.genSquareSize * 0.1,                        
                        labelX         = reverseFlow  ? squareRight - labelPadX : squareLeft  + labelPadX // For reverseFlow, labels anchor to the right edge of the square

                    const textEl = annotation.append('text')
                        .classed(`sector-label ${sc}`, true)
                        .attr('x', labelX)
                        .attr('text-anchor', reverseFlow ? 'end' : 'start')
                        .style('opacity', animate ? 0 : 1)
                        .style('font-size', labelFs)

                    if (animate) {
                        textEl.transition()
                            .duration(DataVis.CONFIG.animation.duration)
                            .delay(delay)
                            .style('opacity', 1)
                    }

                    if (isMultiLine) {
                        const lineH = labelFs * 1.2
                        textEl.attr('y', b.y + b.h * 0.5 - lineH * 0.5)
                        textEl.append('tspan')
                            .attr('x',  labelX)
                            .attr('dy', 0)
                            .text(parts[0].trim() )
                        textEl.append('tspan')
                            .attr('x',  labelX)
                            .attr('dy', lineH)
                            .text(`&  ${parts[1].trim()}` )
                    } else {
                        textEl.attr('y', b.y + b.h * 0.5).text(label)
                    }
                }
            })

            //////////////////////////////////////////////////
            /// II. GRADIENT DEFS (shared by both styles)  ///
            //////////////////////////////////////////////////

            const getGradId    = (sector, streamName) => `connector-grad-${sector}-${streamName}`.replace(/[\s&]/g, '-')
            const sectorCssVar = sector => `var(--${sector.toLowerCase().replace('&', '')})`

            bands.forEach(b => {
                g.streams.forEach(s => {
                    const gradId = getGradId(b.sector, s.name)
                    // Gradient runs from square edge → connector edge (direction flips with reverseFlow)
                    this.el.defs.append('linearGradient')
                        .attr('id', gradId)
                        .attr('gradientUnits', 'userSpaceOnUse')
                        .attr('x1', reverseFlow ? squareLeft  : squareRight)
                        .attr('x2', reverseFlow ? connRight   : connRight)
                        .attr('y1', 0)
                        .attr('y2', 0)
                        .call(grad => {
                            grad.append('stop')
                                .attr('offset', '0%')
                                .attr('stop-color', sectorCssVar(b.sector))
                            grad.append('stop')
                                .attr('offset', '100%')
                                .attr('stop-color', 'var(--generated)')
                        })
                })
            })

            //////////////////////////////////////////////////
            /// III. CONNECTORS: Sankey or angular styles  ///
            //////////////////////////////////////////////////

            if (connectorStyle === 'sankey') {

                const bandSlices = {}
                bands.forEach(b => {
                    let sliceCursor = b.y
                    bandSlices[b.sector] = {}
                    g.streams.forEach(s => {
                        const vol = data.byStream[s.name]?.sectors?.[b.sector]?.Generated ?? 0
                        const h   = (vol / b.volume) * b.h
                        bandSlices[b.sector][s.name] = { top: sliceCursor, bot: sliceCursor + h, h }
                        sliceCursor += h
                    })
                })

                const streamEdge = {}
                g.streams.forEach((s, i) => {
                    const th = this.scale.materialFlow(s.generated)
                    const cy = g.lineYs[i]
                    streamEdge[s.name] = { top: cy - th / 2, bot: cy + th / 2 }
                })

                const cpX1 = reverseFlow ? squareLeft  - connectorWidth * 0.4 : squareRight + connectorWidth * 0.4
                const cpX2 = reverseFlow ? connRight   + connectorWidth * 0.4 : connRight   - connectorWidth * 0.4

                g.streams.forEach(s => {
                    const sc   = DataVis.CONFIG.map.streamClass?.[s.name] ?? ''
                    const rTop = streamEdge[s.name].top
                    const rBot = streamEdge[s.name].bot

                    // Square edge is squareLeft for reverseFlow, squareRight otherwise
                    const sEdge = reverseFlow ? squareLeft : squareRight

                    bands.forEach(b => {
                        const slice = bandSlices[b.sector][s.name]
                        if (slice.h < 0.05) return

                        vis.append('path')
                            .classed(`connector-ribbon ${DataVis.CONFIG.map.sectorClass?.[b.sector] ?? ''} ${sc}`, true)
                            .attr('d', [
                                `M ${sEdge},${slice.top}`,
                                `C ${cpX1},${slice.top} ${cpX2},${rTop} ${connRight},${rTop}`,
                                `L ${connRight},${rBot}`,
                                `C ${cpX2},${rBot} ${cpX1},${slice.bot} ${sEdge},${slice.bot}`,
                                'Z'
                            ].join(' '))
                            .style('fill', `url(#${getGradId(b.sector, s.name)})`)
                    })
                })

            } else if (connectorStyle === 'angular') {

                const stubLen = connectorWidth * 0.15
                const tanKink = Math.tan(60 * Math.PI / 180)
                const bandPad = 2

                const exitGeom = {}
                bands.forEach(b => {
                    exitGeom[b.sector] = {}
                    const rawTh = {}
                    let rawSum  = 0
                    g.streams.forEach(s => {
                        const vol = data.byStream[s.name]?.sectors?.[b.sector]?.Generated ?? 0
                        rawTh[s.name] = this.scale.materialFlow(vol)
                        rawSum += rawTh[s.name]
                    })
                    const totalPad = bandPad * (g.streams.length - 1)
                    const scale    = (b.h - totalPad) / rawSum
                    let cursor     = b.y
                    g.streams.forEach(s => {
                        const th = rawTh[s.name] * scale
                        exitGeom[b.sector][s.name] = { cy: cursor + th / 2, th }
                        cursor += th + bandPad
                    })
                })

                const entryGeom = {}
                g.streams.forEach((s, i) => {
                    entryGeom[s.name] = {}
                    const totalTh = this.scale.materialFlow(s.generated)
                    const rawTh   = {}
                    let rawSum    = 0
                    bands.forEach(b => {
                        const vol = data.byStream[s.name]?.sectors?.[b.sector]?.Generated ?? 0
                        rawTh[b.sector] = this.scale.materialFlow(vol)
                        rawSum += rawTh[b.sector]
                    })
                    const scale  = totalTh / rawSum
                    let cursor   = g.lineYs[i] - totalTh / 2
                    bands.forEach(b => {
                        const th = rawTh[b.sector] * scale
                        entryGeom[s.name][b.sector] = { cy: cursor + th / 2, th }
                        cursor += th
                    })
                })

                g.streams.forEach((s, i) => {
                    const sc = DataVis.CONFIG.map.streamClass?.[s.name] ?? ''

                    bands.forEach((b, bi) => {
                        const sectorClass              = DataVis.CONFIG.map.sectorClass?.[b.sector] ?? ''
                        const vol                      = data.byStream[s.name]?.sectors?.[b.sector]?.Generated ?? 0
                        if (vol === 0) return

                        const { cy: exitCy, th: exitTh }   = exitGeom[b.sector][s.name]
                        const { cy: entryCy, th: entryTh }  = entryGeom[s.name][b.sector]

                        // For reverseFlow: exit is at squareLeft (right side of square), entry is at connRight (left of square)
                        const lTop = exitCy  - exitTh  / 2
                        const lBot = exitCy  + exitTh  / 2
                        const rTop = entryCy - entryTh / 2
                        const rBot = entryCy + entryTh / 2

                        let d
                        if (reverseFlow) {
                            // Mirror: x0=squareLeft, x3=connRight (connRight < squareLeft)
                            const x0 = squareLeft
                            const x1 = squareLeft - stubLen
                            const x2 = connRight  + stubLen
                            const x3 = connRight

                            const dYTop = rTop - lTop
                            const dxTop = Math.abs(dYTop) / tanKink
                            const kxTop = Math.max(x1 - dxTop, x2)
                            const kyTop = lTop + Math.sign(dYTop) * Math.min(dxTop, x1 - x2) * tanKink

                            const dYBot = rBot - lBot
                            const dxBot = Math.abs(dYBot) / tanKink
                            const kxBot = Math.max(x1 - dxBot, x2)
                            const kyBot = lBot + Math.sign(dYBot) * Math.min(dxBot, x1 - x2) * tanKink

                            d = [
                                `M ${x0},${lTop}`,
                                `L ${x1},${lTop}`,
                                `L ${kxTop},${kyTop}`,
                                `L ${x2},${rTop}`,
                                `L ${x3},${rTop}`,
                                `L ${x3},${rBot}`,
                                `L ${x2},${rBot}`,
                                `L ${kxBot},${kyBot}`,
                                `L ${x1},${lBot}`,
                                `L ${x0},${lBot}`,
                                'Z'
                            ].join(' ')

                        } else {
                            const x0 = squareRight
                            const x1 = squareRight + stubLen
                            const x2 = connRight   - stubLen
                            const x3 = connRight

                            const dYTop = rTop - lTop
                            const dxTop = Math.abs(dYTop) / tanKink
                            const kxTop = Math.min(x1 + dxTop, x2)
                            const kyTop = lTop + Math.sign(dYTop) * Math.min(dxTop, x2 - x1) * tanKink

                            const dYBot = rBot - lBot
                            const dxBot = Math.abs(dYBot) / tanKink
                            const kxBot = Math.min(x1 + dxBot, x2)
                            const kyBot = lBot + Math.sign(dYBot) * Math.min(dxBot, x2 - x1) * tanKink

                            d = [
                                `M ${x0},${lTop}`,
                                `L ${x1},${lTop}`,
                                `L ${kxTop},${kyTop}`,
                                `L ${x2},${rTop}`,
                                `L ${x3},${rTop}`,
                                `L ${x3},${rBot}`,
                                `L ${x2},${rBot}`,
                                `L ${kxBot},${kyBot}`,
                                `L ${x1},${lBot}`,
                                `L ${x0},${lBot}`,
                                'Z'
                            ].join(' ')
                        }

                        const ribbon = vis.append('path')
                            .classed(`connector-ribbon ${sectorClass} ${sc}`, true)
                            .attr('d', d)
                            .style('stroke', 'none')
                            .style('fill',   `url(#${getGradId(b.sector, s.name)})`)

                        if (animate) {
                            ribbon
                                .style('opacity', 0)
                                .transition()
                                .duration(DataVis.CONFIG.animation.duration)
                                .delay(delay + i * 30 + bi * 10)
                                .style('opacity', 1)
                        }
                    })
                })
            }

            return { streamStartX: connRight }
        },

        renderFlowLines: (vis, annotation, g, options = {}) => {

            const {
                animate        = false,
                delay          = 0,
                bumpByRecovery = false,
                bumpByDisposal = false,
                kinkPositionGen = 0.25,
                kinkPositionDis = 0.75,
            } = options


            const reverseFlow = g.reverseFlow ?? false

            const dur       = DataVis.CONFIG.animation.duration,
                tanKink     = Math.tan(60 * Math.PI / 180),
                elbowSvgX   = reverseFlow ? g.x + g.width - g.elbowX : g.x + g.elbowX,
                genStartX   = reverseFlow
                    ? g.genStartX ?? (g.x + g.width - g.genSquareSize)
                    : g.genStartX ?? (g.x + g.genSquareSize)

            // Kink X for disposal bump
            const minDisposalLen = d3.min(g.streams, s => {
                const i       = g.streams.indexOf(s),
                    tGen      = this.scale.materialFlow(s.generated),
                    tDis      = this.scale.materialFlow(s.disposed),
                    topEdge   = g.lineYs[i] - tGen / 2,
                    disCy     = topEdge + tDis / 2
                return reverseFlow
                    ? elbowSvgX - g.slopeXatY(disCy)
                    : g.slopeXatY(disCy) - elbowSvgX
            })
            const disposalKinkX = reverseFlow
                ? elbowSvgX - kinkPositionDis * minDisposalLen
                : elbowSvgX + kinkPositionDis * minDisposalLen

            // Kink X for generation bump
            const genSectionLen = reverseFlow
                ? genStartX - elbowSvgX
                : elbowSvgX - genStartX
            const genKinkX = reverseFlow
                ? genStartX - kinkPositionGen * genSectionLen
                : genStartX + kinkPositionGen * genSectionLen

            // Disposal gradients
            g.streams.forEach((s, i) => {
                const gradId     = `disposal-grad-${s.name}`.replace(/[\s&]/g, '-')
                const gradStartX = elbowSvgX
                const gradEndX   = reverseFlow ? g.x : g.x + g.width

                this.el.defs.append('linearGradient')
                    .attr('id',            gradId)
                    .attr('gradientUnits', 'userSpaceOnUse')
                    .attr('x1',            gradStartX)
                    .attr('x2',            gradEndX)
                    .attr('y1',            0)
                    .attr('y2',            0)
                    .call(grad => {
                        grad.append('stop')
                            .attr('offset',     '0%')
                            .attr('stop-color', 'var(--generated)')
                        grad.append('stop')
                            .attr('offset',     '100%')
                            .attr('stop-color', 'var(--disposal)')
                    })
            })

            g.streams.forEach((s, i) => {
                const streamClass = DataVis.CONFIG.map.streamClass[s.name],
                    tGen = this.scale.materialFlow(s.generated),
                    tDis = this.scale.materialFlow(s.disposed)

                const genY  = g.stageYs.generated[s.name],
                    recY    = g.stageYs.recovered[s.name],
                    disY    = g.stageYs.disposed[s.name]

                const disFromY = bumpByRecovery ? recY : (() => {
                    const topEdge = genY - tGen / 2
                    return topEdge + tDis / 2
                })()

                const disToY  = bumpByDisposal ? disY : disFromY

                // Where does the disposal line terminate (X)?
                const disEndX = reverseFlow
                    ? Math.max(g.slopeXatY(disToY), g.x)
                    : Math.min(g.slopeXatY(disToY), g.x + g.width)


                ///////////////////////////////
                /// I. GENERATION FLOW LINE ///
                ///////////////////////////////

                if (!bumpByRecovery) {
                    const genLine = vis.append('line')
                        .classed(`generated stream-line ${streamClass}`, true)
                        .attr('x1', genStartX).attr('x2', elbowSvgX)
                        .attr('y1', genY).attr('y2', genY)
                        .attr('stroke-width', animate ? 0 : tGen)

                    if (animate) {
                        genLine.transition().duration(dur).delay(delay + i * 30)
                            .attr('stroke-width', tGen)
                    }

                } else {
                    const deltaY   = recY - genY,
                        diagDx     = Math.abs(deltaY) / tanKink,
                        kinkStartX = reverseFlow
                            ? Math.min(genStartX, genKinkX + diagDx / 2)
                            : Math.max(genStartX, genKinkX - diagDx / 2),
                        kinkEndX   = reverseFlow
                            ? Math.max(elbowSvgX, genKinkX - diagDx / 2)
                            : Math.min(elbowSvgX, genKinkX + diagDx / 2)

                    const pathD = deltaY === 0
                        ? `M ${genStartX},${genY} L ${elbowSvgX},${genY}`
                        : `M ${genStartX},${genY} ` +
                        `L ${kinkStartX},${genY} ` +
                        `L ${kinkEndX},${recY} ` +
                        `L ${elbowSvgX},${recY}`

                    const genPath = vis.append('path')
                        .classed(`generated stream-line ${streamClass}`, true)
                        .attr('fill', 'none')
                        .attr('stroke-width', animate ? 0 : tGen)

                    if (animate) {
                        genPath.attr('d', `M ${genStartX},${genY} L ${genStartX},${genY}`)
                            .transition().duration(dur).delay(delay + i * 30)
                            .attr('d', pathD)
                            .attr('stroke-width', tGen)
                    } else {
                        genPath.attr('d', pathD)
                    }
                }


                //////////////////////////////
                /// II. DISPOSAL FLOW LINE ///
                //////////////////////////////

                if (!bumpByDisposal) {
                    const disLine = vis.append('line')
                        .classed(`landfill stream-line ${streamClass}`, true)
                        .attr('x1', elbowSvgX)
                        .attr('x2', animate ? elbowSvgX : disEndX)
                        .attr('y1', disFromY).attr('y2', disFromY)
                        .style('stroke-width', animate ? 0 : tDis)
                        .style('stroke', `url(#disposal-grad-${s.name.replace(/[\s&]/g, '-')})`)

                    if (animate) {
                        disLine.transition().duration(dur)
                            .delay(delay + dur * 0.5 + i * 30)
                            .attr('x2', disEndX)
                            .attr('stroke-width', tDis)
                    }

                } else {
                    const deltaY     = disToY - disFromY,
                        diagDx       = Math.abs(deltaY) / tanKink,
                        kinkStartX   = reverseFlow
                            ? Math.min(elbowSvgX, disposalKinkX + diagDx / 2)
                            : Math.max(elbowSvgX, disposalKinkX - diagDx / 2),
                        kinkEndX     = reverseFlow
                            ? kinkStartX - diagDx
                            : kinkStartX + diagDx

                    const pathD = deltaY === 0
                        ? `M ${elbowSvgX},${disFromY} L ${disEndX},${disFromY}`
                        : `M ${elbowSvgX},${disFromY} ` +
                        `L ${kinkStartX},${disFromY} ` +
                        `L ${kinkEndX},${disToY} ` +
                        `L ${disEndX},${disToY}`

                    const disPath = vis.append('path')
                        .classed(`landfill stream-line ${streamClass}`, true)
                        .attr('fill', 'none')
                        .attr('stroke-width', animate ? 0 : tDis)
                        .style('stroke', `url(#disposal-grad-${s.name.replace(/[\s&]/g, '-')})`)

                    if (animate) {
                        disPath
                            .attr('d', `M ${elbowSvgX},${disFromY} L ${elbowSvgX},${disFromY}`)
                            .transition().duration(dur)
                            .delay(delay + dur * 0.5 + i * 30)
                            .attr('d', pathD)
                            .attr('stroke-width', tDis)
                    } else {
                        disPath.attr('d', pathD)
                    }
                }


                /////////////////////////
                /// III. STREAM LABEL ///
                /////////////////////////

                const labelOffsetX = g.width * g.labelOffsetRatio,
                    labelPadY      = g.width * 0.001,
                    labelPadX      = labelPadY * 6,
                    labelFs        = g.width * 0.01

                const labelY = bumpByRecovery ? recY : genY

                // For reverseFlow, place label measuring from the right
                const labelX = reverseFlow
                    ? g.x + g.width - labelOffsetX
                    : g.x + labelOffsetX

                const labelG = annotation.append('g')
                    .classed(`stream-label stream-${i} `, true)
                    .style('opacity', animate ? 0 : 1)

                if (animate) {
                    labelG.transition().duration(dur * 0.5).delay(delay + i * 30)
                        .style('opacity', 1)
                }

                const bg = labelG.append('rect')
                    .classed('stream-label-bg', true)
                    .attr('y', labelY - labelFs / 2 - labelPadY)
                    .attr('height', labelFs + labelPadY * 2)

                const label = labelG.append('text')
                    .classed(`stream-label ${streamClass} ${g.circleDirection} ${g.invertCircularFlow ? 'invert' : ''}`, true)
                    .attr('x', labelX).attr('y', labelY)
                    .style('font-size', labelFs)
                    .text(s.name)

                requestAnimationFrame(() => requestAnimationFrame(() => {
                    const len = label.node().getComputedTextLength()
                    bg.attr('x', reverseFlow
                            ? labelX - labelPadX
                            : labelX - len - labelPadX)
                        .attr('width', len + labelPadX * 2)
                }))
            })
        },

        renderDisposal: (vis, annotation, g, options = {}) => {

            const { animate = false, delay = 0 } = options
            const dur = DataVis.CONFIG.animation.duration

            const slopeEndX = g.trianglePosition === 'bottom'
                ? g.slopeXatY(g.slopeEndY)
                : g.slopeEndX

            const slopeLine = vis.append('line').classed('disposal slope-line', true)
                .attr('x1', g.slopeStartX).attr('y1', g.slopeStartY)
                .attr('x2', g.slopeEndX).attr('y2', g.slopeEndY)
                .attr('stroke-width', g.tSlopeTotal)
                .style('opacity', animate ? 0 : 1)

            if(animate) slopeLine.transition().duration(dur).delay(delay).style('opacity', 1)

            // Triangle
            const reverseFlow    = g.reverseFlow ?? false
            const slopeAngleDiff = g.slopeAngleDeg - 60,
                translateX = slopeAngleDiff ? g.triSide * 0.2 : 0,
                translateY = slopeAngleDiff ? g.triSide * 0.2 : 0

            const triangleGroup = vis.append('g').classed('disposal-triangle-group', true)
                .attr('transform', reverseFlow
                    ? ` translate(${-g.triSide * 0.6}, ${g.triSide * 0.75}) rotate(${180}, ${g.Bx}, ${g.triTopY})`
                    : `translate(${translateX}, ${-translateY}) rotate(${slopeAngleDiff}, ${g.slopeEndX}, ${g.slopeEndY})`)
                .style('opacity', animate ? 0 : 1)

            if(animate) triangleGroup.transition().duration(dur).delay(delay + 100).style('opacity', 1)

            triangleGroup.append('polygon').classed('disposal triangle', true)
                .attr('points', `${g.Ax},${g.Ay} ${g.Bx},${g.By} ${g.Cx},${g.Cy}`)
                .style('stroke-width', g.triH * 0.05)

            // Labels
            const triCentX  = (g.Ax + g.Bx + g.Cx) / 3,
                triCentY    = (g.Ay + g.By + g.Cy) / 3,
                triFs       = Math.max(g.triH * 0.3, 9),
                pctFs       = triFs * 0.35,
                disposalPct = Math.round(g.disposalRatio * 100)

            const labelRotation = slopeAngleDiff 
                ? -60 - slopeAngleDiff
                : 0

            const labelGroup = triangleGroup.append('g').classed('label-group', true)
                .attr('transform', `rotate(${labelRotation}, ${triCentX}, ${triCentY})`)

            labelGroup.append('text')
                .classed('disposal-triangle-label to-landfill', true)
                .attr('x', triCentX)
                .attr('y', triCentY - triFs * 0.55)
                .style('font-size', triFs * 0.4)
                .text('to landfill')

            const numeral = labelGroup.append('text')
                .classed('disposal-triangle-label value', true)
                .attr('x', triCentX)
                .attr('y', triCentY + triFs * 0.3)
                .style('font-size', triFs)
                .text(disposalPct)

            const pctY = triCentY - triFs * 0.55 + pctFs * 0.72

            const pct = labelGroup.append('text')
                .classed('disposal-triangle-label pct', true)
                .attr('y', pctY)
                .attr('dy', triFs * 0.3)
                .attr('text-anchor', 'start')
                .style('font-size', pctFs)
                .text('%')

            requestAnimationFrame(() => requestAnimationFrame(() => {
                const len = numeral.node().getComputedTextLength()
                pct.attr('x', triCentX + len / 2 + triFs * 0.175)
            }))
        },

        renderRecoveryBreakdown: (vis, annotation, data, g, options = {}) => {

            const { animate = false, delay = 0 } = options

            const recoveryAnnotationGroup = annotation.append('g')
                .classed('recovery-breakdown-annotation', true)

            this.#renderRecoveryBreakdown(data, {
                x:      g.arcCentX,
                y:      g.arcCentY,
                height: DataVis.CONFIG.dims.height - DataVis.CONFIG.dims.margin.bottom - g.arcCentY,
            }, {
                svgGroup:       this.el.vis.recoveryBreakdown,
                annotGroup:     recoveryAnnotationGroup,  
                rotationAngle:  g.rotationAngle,     
                apexX:          g.arcCentX,
                apexY:          g.arcCentY,
                arcOuterR:      g.radii[0] + this.scale.materialFlow(g.streams[0].recovered) / 2,
                recoveryLabelR: g.radii[0] + g.slotH * 1.0,   
                largestArcCy:   (g.lineYs[0] + this.scale.materialFlow(g.streams[0].generated) / 2) - this.scale.materialFlow(g.streams[0].recovered) / 2 + g.radii[0],  
                segments: [
                    { 
                        label: 'processed locally', 
                        class: 'recovered-local',
                        value: data.metrics.Aggregated.recovered.processedLocally 
                    },
                    { 
                        label: 'exported', 
                        class: 'recovered-exported',
                        value: data.metrics.Aggregated.recovered.exported.interstate + data.metrics.Aggregated.recovered.exported.international
                    },
                ],
                animate,
                delay,
            })
        },

        renderWasteFateLabels: (annotation, g, data, options = {}) => {

            const { animate = false, delay = 0 } = options
            const dur = DataVis.CONFIG.animation.duration

            const labelFs = g.slotH * 0.85

            // i. Disposal label
            const disposalG = annotation.append('g').classed('disposal-label-group', true)
                .style('opacity', animate ? 0 : 1)

            if(animate) disposalG.transition().duration(dur).delay(delay).style('opacity', 1)

            disposalG.append('g')
                .attr('transform', `translate(${g.slopeStartX}, ${g.groupTop})`)
                .append('text').classed('disposal-label', true)
                    .attr('x', labelFs * 0.5)
                    .attr('y', -labelFs * 0.75)
                    .style('font-size', labelFs)
                    .style('text-anchor', g.reverseFlow ? 'start' : null)
                    .html(`<tspan class = 'lowercase'>${d3.format("0.1f")(data.metrics.Aggregated.disposed.total /1000000)} Mt</tspan> disposed`)

            // ii. Recovery label arc: this also belongs to renderRecoveryBreakdown
            if(!this.state.render.recoveryBreakdown){
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

                const recLabel = annotation.append('text').classed('recovery-label', true)
                    .style('font-size', labelFs)
                    .style('opacity', animate ? 0 : 1)
                    .append('textPath')
                        .attr('href', `#${arcId}`)
                        .attr('startOffset', '50%')
                        .html(`<tspan class = 'lowercase'>${d3.format("0.1f")(data.metrics.Aggregated.recovered.total /1000000)} Mt</tspan> recovered `)

                if(animate) recLabel.select(function() { return this.parentNode })
                    .transition().duration(dur).delay(delay + 100).style('opacity', 1)
            }
        },

        renderWasteManagementLabels: (annotation, sharedGeom, data, options = {}) => {

            const { animate = false, delay = 0 } = options
            const dur = DataVis.CONFIG.animation.duration

            const fs = sharedGeom.slotH * 0.85

            const group = annotation.append('g').classed('waste-management-label-group', true)
                .attr('transform', `translate(${sharedGeom.x - sharedGeom.slotH * 0.15}, ${sharedGeom.y - sharedGeom.slotH * 0.25})`)
                .style('opacity', animate ? 0 : 1)

            if(animate) group.transition().duration(dur).delay(delay).style('opacity', 1)

            if(sharedGeom.reverseFlow){
                group.append('text').classed('waste-management-label generation-label total', true)
                    .attr('transform', ` translate(${sharedGeom.width + fs}, ${sharedGeom.genSquareSize * 0.05}) rotate(90)`)
                    .html(`<tspan class = 'lowercase'>${d3.format("0.1f")(data.metrics.Aggregated.generated.total /1000000)} Mt</tspan> of waste`)
                    .style('font-size', fs * 1)

                group.append('text').classed('waste-management-label generation-label', true)
                    .attr('transform', ` translate(${sharedGeom.width - 0}, ${sharedGeom.genSquareSize * 0})`)
                    .attr('dy', -fs * 0.375)
                    .text(`generated & collected`)
                    .style('font-size', fs)
                    .style('text-anchor', 'end')

            } else {
                group.append('text').classed('waste-management-label generation-label total', true)
                    .attr('transform', ` translate(${-fs * 0.75}, ${sharedGeom.genSquareSize * 1}) rotate(-90)`)
                    .html(`<tspan class = 'lowercase'>${d3.format("0.1f")(data.metrics.Aggregated.generated.total /1000000)} Mt</tspan> of waste`)
                    .style('font-size', fs * 1)

                group.append('text').classed('waste-management-label generation-label', true)
                    .attr('dy', -fs * 0.375)
                    .text(`generated & collected`)
                    .style('font-size', fs)
            }
        }
    }

    // Standalone graphics
    #renderRecoveryCircleChart(vis, annotation, data, layout, options = {}) {

        // I. POSITION & CONFIG
        const { x, y, width, streamHeight } = layout

        const {
            direction        = 'clockwise',
            sortBy           = 'generated',
            sortDir          = 'desc',
            elbowRatio       = 0.5,
            rMinFactor       = 3,
            showStreamLabels = false,
            showRateLabels   = false,
            labelOffsetRatio = 0.5,
            showCentreLabel  = true,
            counterRotation  = 0,
            animate          = false,
            delay            = 0,
            overrideLineYs   = null,
        } = options

        const clockwise = this.state.flowConfig.circleDirection !== 'anticlockwise',
            sweepFlag = clockwise ? 1 : 0,
            dur       = DataVis.CONFIG.animation.duration

        // II. SVG GROUPS
        const vis_        = vis        ?? this.el.vis.materialFlow,
            annotation_ = annotation ?? this.el.annotation.materialFlow

        // III. DATA
        let streams = Object.entries(data.byStream)
            .map(([name, d]) => ({
                name,
                generated:    d.sectors?.All?.Generated             ?? 0,
                recovered:    d.sectors?.All?.['Recovered - total'] ?? 0,
                disposed:     d.sectors?.All?.Disposed              ?? 0,
                recoveryRate: d.sectors?.All?.['Recovery rate']     ?? 0,
            }))
            .filter(s => s.generated > 0)

        const sortKey = sortBy === 'recoveryRate' ? 'recoveryRate' : sortBy

        streams = streams.sort((a, b) => sortDir === 'asc' ? a[sortKey] - b[sortKey] : b[sortKey] - a[sortKey])

        const n = streams.length

        const { Aggregated } = data.metrics,
            totalGenerated    = Aggregated.generated.total,
            totalRecovered    = Aggregated.recovered.total,
            totalRecoveryRate = Aggregated.recoveryRate.toFixed(1)

        // IV. LAYOUT FOR FLOWS
        const slotH  = streamHeight / n,
            lineYs   = streams.map((_, i) => y + i * slotH + slotH / 2),
            elbowX   = width * elbowRatio,
            rMin     = slotH * rMinFactor,
            radii    = streams.map((_, i) => rMin + (n - 1 - i) * slotH)

        this.scale.recoveryArcs = d3.scaleSqrt()
            .domain([0, streams[0].generated])
            .range([1, slotH * 0.55])

        const resolveLineY = (s, i) =>
            overrideLineYs ? overrideLineYs[s.name] : lineYs[i]

        let sumCy = 0

        streams.forEach((s, i) => {
            const tGen = this.scale.recoveryArcs(s.generated),
                tRec   = this.scale.recoveryArcs(s.recovered),
                lineY  = resolveLineY(s, i),
                recCy  = (lineY + tGen / 2) - tRec / 2
            sumCy += recCy + radii[i]
        })

        const arcCentX = x + elbowX,
            arcCentY   = sumCy / n,
            innerR     = rMin * 0.7

        // V. CALCULATE AND RENDER STREAMS
        streams.forEach((s, i) => {

            const lineY = resolveLineY(s, i),
                r       = radii[i],
                tGen    = this.scale.recoveryArcs(s.generated),
                tRec    = this.scale.recoveryArcs(s.recovered),
                botEdge = lineY + tGen / 2,
                recCy   = botEdge - tRec / 2,
                arcCx   = x + elbowX,
                arcCy   = recCy + r

            // Start angle: top of arc (-π/2), sweep direction based on clockwise
            const startRad = -Math.PI / 2,
                sweepRad   = (s.recoveryRate / 100) * 2 * Math.PI,
                largeArc   = sweepRad > Math.PI ? 1 : 0

            // For anticlockwise, end point is mirrored
            const ax1 = arcCx + r * Math.cos(startRad),
                ay1   = arcCy + r * Math.sin(startRad)

            const endRad = clockwise ? startRad + sweepRad : startRad - sweepRad
            const ax2    = arcCx + r * Math.cos(endRad),
                ay2      = arcCy + r * Math.sin(endRad)

            const sc = DataVis.CONFIG.map.streamClass[s.name]

            const hexPalette = {
                generated:      '#b0b0b0',
                recovered:      '#00B4E1',
                recoveredMid:   '#C3D700',
                recoveredFinal: '#033643',
            }

            const color = d3.scaleLinear()
                .domain([0, 0.33, 0.66, 1])
                .range([hexPalette.generated, hexPalette.recoveredMid, hexPalette.recovered, hexPalette.recoveredFinal])
                .interpolate(d3.interpolateHcl)

            const finalD = `M ${ax1},${ay1} A ${r},${r} 0 ${largeArc},${sweepFlag} ${ax2},${ay2}`

            if (animate) {
                const arcGroup = vis_.append('g').classed(`recovered stream-arc-group ${sc}`, true)

                const dummy = vis_.append('path')
                    .attr('fill', 'none')
                    .attr('stroke', 'none')
                    .attr('d', `M ${ax1},${ay1} A ${r},${r} 0 0,${sweepFlag} ${ax1},${ay1}`)

                dummy.transition()
                    .duration(dur)
                    .delay(delay + dur * 0.3 + i * 40)
                    .attrTween('d', function() {
                        const interp = d3.interpolate(0, s.recoveryRate / 100)
                        return t => {
                            if (!isFinite(ax1) || !isFinite(ay1) || !isFinite(r)) return 'M 0,0'

                            const sweep  = interp(t) * 2 * Math.PI,
                                la       = sweep > Math.PI ? 1 : 0,
                                endR     = clockwise ? startRad + sweep : startRad - sweep,
                                ex       = arcCx + r * Math.cos(endR),
                                ey       = arcCy + r * Math.sin(endR)

                            if (!isFinite(ex) || !isFinite(ey)) return 'M 0,0'

                            const d      = `M ${ax1},${ay1} A ${r},${r} 0 ${la},${sweepFlag} ${ex},${ey}`,
                                tempPath = vis_.append('path').attr('d', d),
                                quads    = SystemVis.#quads(SystemVis.#samplePath(tempPath.node(), 8))

                            tempPath.remove()
                            arcGroup.selectAll('path').remove()

                            quads.forEach(q => {
                                if (!q[1] || !q[2]) return
                                const joinD = SystemVis.#lineJoin(q[0], q[1], q[2], q[3], tRec)
                                if (!joinD || joinD.includes('NaN')) return
                                arcGroup.append('path')
                                    .classed(`recovered stream-arc ${sc}`, true)
                                    .style('fill',   color(q.t * interp(t)))
                                    .style('stroke', color(q.t * interp(t)))
                                    .attr('d',       joinD)
                            })

                            return d
                        }
                    })
                    .on('end', () => dummy.remove())
            
            } else {
                const tempPath = vis_.append('path').attr('d', finalD),
                    quads      = SystemVis.#quads(SystemVis.#samplePath(tempPath.node(), 8))
                tempPath.remove()

                quads.forEach(q => {
                    vis_.append('path')
                        .classed(`recovered stream-arc ${sc}`, true)
                        .style('fill',   color(q.t * (s.recoveryRate / 100)))
                        .style('stroke', color(q.t * (s.recoveryRate / 100)))
                        .attr('d',       SystemVis.#lineJoin(q[0], q[1], q[2], q[3], tRec))
                })
            }

            // iv. Stream labels
            if (showStreamLabels || showRateLabels) {
                const labelG     = annotation_.append('g').classed(`arc-stream-label arc-stream-${i}`, true),
                    labelFs      = slotH * 0.8,
                    labelOffsetX = width * labelOffsetRatio

                if (showStreamLabels) {
                    const bg = labelG.append('rect').classed('stream-label-bg', true)
                        .attr('y', lineY - labelFs / 2 - 2)
                        .attr('height', labelFs + 4)

                    const label = labelG.append('text').classed(`stream-label ${direction}`, true)
                        .attr('x', x + labelOffsetX).attr('y', lineY)
                        .style('font-size', labelFs)
                        .text(s.name)

                    requestAnimationFrame(() => requestAnimationFrame(() => {
                        const len = label.node().getComputedTextLength()
                        bg.attr('x', x + labelOffsetX - len - 4)
                            .attr('width', len + 8)
                    }))
                }

                if (showRateLabels) {
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

        // VI. RENDER CENTRAL RECOVERY RATE LABEL + DONUT
        if (showCentreLabel) {
            const labelGroup = annotation_.append('g')
                .classed('recovery-rate-label-group', true)
                .attr('transform', `rotate(${counterRotation}, ${arcCentX}, ${arcCentY})`)
                .style('opacity', animate ? 0 : 1)

            if(animate) labelGroup.transition().duration(dur).delay(delay + dur * 0.5).style('opacity', 1)

            const pieData     = Object.entries(data.metrics.Aggregated.recovered.bySector),
                pieGenerator  = d3.pie().value(d => d[1]),
                sectorRecoveredPicArc = d3.arc()
                    .innerRadius(innerR * 0.8)
                    .outerRadius(innerR * 0.9)

            const recoveryPie = labelGroup.append('g').classed('recovery-pie-group', true)
                .attr('transform', `translate(${arcCentX}, ${arcCentY})`)

            recoveryPie.selectAll("path")
                .data(pieGenerator(pieData))
                .enter()
                .append("path")
                .attr("d", sectorRecoveredPicArc)
                .attr('class', d => `${DataVis.CONFIG.map.sectorClass[d.data[0]]} recovery-sector-segment`)

            const labelBgArc = d3.arc()
                .innerRadius(innerR * 0.9)
                .outerRadius(innerR * 1.2)
                .startAngle(0)
                .endAngle(Math.PI * 2)

            labelGroup.append("path")
                .classed('recovery-rate-label bg', true)
                .attr('transform', `translate(${arcCentX}, ${arcCentY})`)
                .attr("d", labelBgArc)

            ;[0, 120, 240].forEach((offset, i) => {
                const startAngle = (offset - 90) * Math.PI / 180,
                    endAngle     = (offset + 90) * Math.PI / 180,
                    x1 = arcCentX + Math.cos(startAngle) * innerR,
                    y1 = arcCentY + Math.sin(startAngle) * innerR,
                    x2 = arcCentX + Math.cos(endAngle)   * innerR,
                    y2 = arcCentY + Math.sin(endAngle)    * innerR

                const pathD = `M ${x1},${y1} A ${innerR},${innerR} 0 0,1 ${x2},${y2}`

                this.el.defs.append('path')
                    .attr('id', `recRate-textPath_${data.year}_${i}`)
                    .attr('d', pathD)

                labelGroup.append('text')
                    .classed('recovery-rate-label outer-description', true)
                    .style('font-size', innerR * 0.15)
                    .append('textPath')
                        .attr('href', `#recRate-textPath_${data.year}_${i}`)
                        .attr('startOffset', '50%')
                        .style('letter-spacing', innerR * 0.02)
                        .text(`Recovery rate ${data.year}`)
            })

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
                .attr('dx', -numFontSize * 0.05)
                .attr('dy', numFontSize * 0.25)
                .style('font-size', pctFontSize)
                .text('%')

            requestAnimationFrame(() => requestAnimationFrame(() => {
                const len = numeral.node().getComputedTextLength()
                pct.attr('x', arcCentX + len / 2 + innerR * 0.01)
            }))
        }
    }

    #renderRecoveryBreakdown(data, layout, options = {}) {

        const { x, y, height } = layout

        const {
            svgGroup,
            annotGroup,
            showLabels      = true,
            apexX:          geomApexX,
            apexY:          geomApexY,
            segments:       directSegments = null,
            labelFontSize   = height * 0.03,
            arcOuterR       = null,
            segmentPadding  = height * 0.15,
            segmentThick    = height * 0.05,
            outerLabelPad   = 20,
            innerLabelPad   = 0,
            recoveryLabelR  = null,
            largestArcCy    = null,
            rotationAngle   = 0,
            animate         = false,
            delay           = 0,
        } = options

        const dur = DataVis.CONFIG.animation.duration

        const maxTriH   = arcOuterR != null ? arcOuterR * 2 : height,
            triHeight   = Math.min(height, maxTriH)

        const labelRotation = 180 - rotationAngle 

        const apexX = x,           
            apexY   = y,           
            baseY   = y + triHeight,  
            side    = (2 * triHeight) / Math.sqrt(3),
            halfW   = side / 2,
            leftX   = apexX - halfW,
            rightX  = apexX + halfW

        const segments = directSegments ?? [],
            total    = d3.sum(segments, s => s.value)

        if (total === 0) return

        //////////////////////////
        /// I. BACKGROUND TRI  ///
        //////////////////////////

        const triPoly = svgGroup.append('polygon')
            .classed('recovery-triangle-bg', true)
            .attr('points', `${apexX},${apexY} ${leftX},${baseY} ${rightX},${baseY}`)
            .style('opacity', animate ? 0 : 1)

        if(animate) triPoly.transition().duration(dur).delay(delay).style('opacity', 1)

        //////////////////////////
        /// II. PIE SEGMENTS   ///
        //////////////////////////

        const spanStartDeg = 150, 
            spanEndDeg   = 210,
            spanTotalDeg = spanEndDeg - spanStartDeg

        const toRad = deg => deg * Math.PI / 180

        const exportedSeg = segments.find(s => s.class === 'recovered-exported'),
            localSeg    = segments.find(s => s.class === 'recovered-local'),
            exportedVal = exportedSeg?.value ?? 0,
            localVal    = localSeg?.value    ?? 0

        const exportPct  = exportedVal / total,
            splitDeg     = spanStartDeg + exportPct * spanTotalDeg

        const innerR = arcOuterR + segmentPadding,
            outerR   = innerR + segmentThick 

        const arcGen = d3.arc()
            .innerRadius(innerR)
            .outerRadius(outerR)

        const segDefs = [
            { label: exportedSeg.label, volValue: exportedVal,  class: 'recovered-exported', startDeg: spanStartDeg, endDeg: splitDeg   },
            { label: localSeg.label,    volValue: localVal,     class: 'recovered-local',    startDeg: splitDeg,     endDeg: spanEndDeg  },
        ]

        const volFormat = d3.format('0.1f'),
            volLabel  = v => `${volFormat(v / 1_000_000)} Mt`

        segDefs.forEach((seg, si) => {
            if (seg.startDeg >= seg.endDeg) return

            const startRad = toRad(seg.startDeg), 
                endRad   = toRad(seg.endDeg)

            const segPath = svgGroup.append('path')
                .classed(`recovery-segment ${seg.class}`, true)
                .attr('transform', `translate(${apexX}, ${apexY})`)
                .attr('d', arcGen({ startAngle: startRad, endAngle: endRad }))
                .style('opacity', animate ? 0 : 1)

            if(animate) segPath.transition().duration(dur).delay(delay + 100 + si * 80).style('opacity', 1)

            if (!showLabels) return

            annotGroup.append('g').classed('recovery-breakdown-labels', true)
        })

        ///////////////////////////////////
        /// III. SEGMENT SUMMARY LABEL  ///
        ///////////////////////////////////

        if (showLabels) {
            const arcId = `recoverySegmentLabelArc_${data.year}`

            const outerLabelR  = innerR + labelFontSize * 1.25 + segmentThick

            this.el.defs.append('path')
                .attr('id', arcId)
                .attr('d', `M ${apexX + outerLabelR},${largestArcCy} A ${outerLabelR},${outerLabelR} 0 1,0 ${apexX - outerLabelR},${largestArcCy}`)
                .attr('transform', `rotate(${labelRotation}, ${apexX}, ${largestArcCy})`)

            const segLabel = annotGroup.append('text').classed('recovery-breakdown-label', true)
                .style('font-size', labelFontSize * 1)
                .style('opacity', animate ? 0 : 1)
                .append('textPath')
                    .attr('href', `#${arcId}`)
                    .attr('startOffset', '50%')
                    .text(`${volLabel(segDefs[1].volValue)} ${segDefs[1].label} vs ${volLabel(segDefs[0].volValue)} ${segDefs[0].label} `)

            if(animate) segLabel.select(function() { return this.parentNode })
                .transition().duration(dur).delay(delay + 300).style('opacity', 1)
        }

        //////////////////////////
        /// V. RECOVERY LABEL ///
        //////////////////////////

        if (showLabels && recoveryLabelR && largestArcCy) {
            const arcId = `recoveryLabelArc_${data.year}`
            const padding = labelFontSize

            this.el.defs.append('path')
                .attr('id', arcId)
                .attr('d', `M ${apexX + recoveryLabelR + padding},${largestArcCy} A ${recoveryLabelR + padding},${recoveryLabelR + padding} 0 1,0 ${apexX - recoveryLabelR - padding},${largestArcCy}`)
                .attr('transform', `rotate(${labelRotation}, ${apexX}, ${largestArcCy})`)

            const recLabel = annotGroup.append('text').classed('recovery-label', true)
                .style('font-size', labelFontSize * 1.25)
                .style('opacity', animate ? 0 : 1)
                .append('textPath')
                    .attr('href', `#${arcId}`)
                    .attr('startOffset', '50%')
                    .html(`<tspan class='lowercase'>${d3.format("0.1f")(data.metrics.Aggregated.recovered.total / 1000000)} Mt</tspan> recovered `)

            if(animate) recLabel.select(function() { return this.parentNode })
                .transition().duration(dur).delay(delay + 300).style('opacity', 1)
        }

        //////////////////////////
        /// IV. BASE LABEL    ///
        //////////////////////////

        if (showLabels) {
            const recoveredMarketValue = data.metrics.Aggregated.recovered?.marketValue,
                label = recoveredMarketValue ? `$${d3.format(".1f")(recoveredMarketValue /1000)} billion in market value` : ''

            const baseLabel = svgGroup.append('g')
                .classed('recovery-breakdown-labels', true)
                .style('opacity', animate ? 0 : 1)

            baseLabel.append('text')
                .classed('recovery-base-label', true)
                .attr('x', (leftX + rightX) / 2)
                .attr('y', baseY - labelFontSize * 1.2)
                .attr('text-anchor', 'middle')
                .style('font-size', labelFontSize * 1.5)
                .text(label)

            if(animate) baseLabel.transition().duration(dur).delay(delay + 400).style('opacity', 1)
        }
    }

    #renderWasteIndustryIllustration(data, layout, options = {}) {
        const { x, y, w } = layout
        const { width, height, margin } = DataVis.CONFIG.dims

        const canvasWidth   = width - margin.left - margin.right
        const scale         = w / canvasWidth
        const componentScale = 0.6

        // Clone nodes from the source doc before any are appended
        const truckCollection = SystemVis.#svgDoc.getElementById('truck-collection')?.cloneNode(true)
        const truckDisposal   = SystemVis.#svgDoc.getElementById('truck-disposal')?.cloneNode(true)
        const facility        = SystemVis.#svgDoc.getElementById('waste-facility')?.cloneNode(true)
        const bins            = SystemVis.#svgDoc.getElementById('collection-bins')?.cloneNode(true)

        const illustrationGroup = this.el.vis.wasteIndustry
            .append('g').classed('illustration-group-wrapper', true)
            .attr('transform', `translate(${x}, ${y}) scale(${scale})`)

        // Append 
        illustrationGroup.append(() => bins)
            .attr('transform', `translate(${w * -0.85  / scale}, 0) scale(${componentScale})`)

        illustrationGroup.append(() => facility)
            .attr('transform', `translate(${w * 0}, 0) scale(${componentScale})`)

        illustrationGroup.append(() => truckCollection)
            .attr('transform', `translate(${ w * -0.675 / scale }, 0) scale(${-componentScale}, ${componentScale})`)

        const disposalPosition = width * 0.595
        illustrationGroup.append(() => truckDisposal)
            .attr('transform', `translate(${ disposalPosition }, 0) scale(${componentScale})`)
            .style('filter', 'grayscale(70%)')
    }

    // Update helpers
    #getLayout(data) {
        const { width, height, margin } = DataVis.CONFIG.dims

        const canvasWidth  = width  - margin.left - margin.right,
            canvasHeight = height - margin.top  - margin.bottom,
            flowY        = margin.top + canvasHeight * this.state.flowConfig.yPosition,        // Vertical position of flow vis
            streamHeight = height * this.state.flowConfig.flowHeightMultiple,
            rotateCx     = width * 0.5 

        const { arcCentY: rotateCy } = SystemVis.#computeFlowGeometry(
            data, DataVis.CONFIG.dims,
            { 
                rMinFactor: this.state.flowConfig.circularFlowMultiple, 
                streamHeight, 
                flowY, 
                reverseFlow: this.state.flowConfig.reverseFlow,    
            }
        )

        const rotationAngle = this.state.flowConfig.rotateByRecoveryRate
            ? this.#flowRotationAngle( data.metrics.Aggregated.recovered.total, data.metrics.Aggregated.generated.total)
            : 0

        // => Return layout config
        return { width, height, margin, canvasWidth, canvasHeight,
                flowY, streamHeight, rotateCx, rotateCy, rotationAngle }
    }

    #flowRotationAngle(totalRecovered, totalGenerated, maxAngle = 30) {
        // Applies to horizontal based 
        // Maps 0–100% recovery to a rotation range: at 50% recovery → 0° (flat). At 100% → +maxAngle° (tilted up). At 0% → -maxAngle°°.
        const recoveryRate = totalRecovered / totalGenerated,            // 0–1
            rotationAngle  = - (recoveryRate - 0.5) * 2 * maxAngle * 1     // +/- maxAngle° 

        switch(this.state.layout){
            case 't': case 'T':
                return this.state.flowConfig.rotateByRecoveryRate ? rotationAngle : 0
            case 'd': case 'D':
                // return 0
                return 60
            case 'six': case '6':  case 6: 
                return -60
            case 'snail':
                return this.state.flowConfig.rotateByRecoveryRate ? rotationAngle : 0

        }

        // => Return rotation
        return rotationAngle
    }

    #draw(data, layout, options = {}) {

        // I. Options and layout
        const { animate = false } = options
        const { width, height, margin, canvasWidth, canvasHeight, flowY, streamHeight, rotationAngle } = layout

        // II. Calculate component layout
        const illustrationBuffer = canvasHeight * 0.225
        const ceMetricsHeight =  canvasHeight - (canvasHeight - flowY) - illustrationBuffer

        // III. RENDER: Composition components
        if(this.state.render.ceMetrics)
            this.#renderCircularMetrics(data, {
                x:    width * 0.5 - ceMetricsHeight * 0.5,
                y:    margin.top,
                size: ceMetricsHeight,
            })

        if(this.state.render.flows)
            this.#renderMaterialFlow(data, {
                x:     margin.left,
                y:     flowY,
                width: canvasWidth * 1,
            }, {
                slopeAngleDeg:     this.state.layout === 't' || this.state.layout === 'T' ? 60 : 120,
                streamHeight,
                rMinFactor:      this.state.flowConfig.circularFlowMultiple,   
                slopePad:        width * 0.01,    // Disposal slope to triangle padding
                rotationAngle,
                animate,
                generationMode:  'sectorBands',  // sectorBands | 'treemap' 
                connectorStyle:  'angular',
            })

        if(this.state.render.illustration)
            this.#renderWasteIndustryIllustration(data, {
                x: width * 0.5,
                y: margin.top + height * 0.28,
                w: width * 0.5,
            })
    }

    #clearDynamic() {
        this.el.vis.circularMetricsShapes.selectAll('*').remove()
        this.el.annotation.circularMetrics.selectAll('*').remove()
        this.el.vis.materialFlow.selectAll('*').remove()
        this.el.annotation.materialFlow.selectAll('*').remove()
        this.el.vis.wasteIndustry.selectAll('*').remove()
        this.el.vis.recoveryBreakdown.selectAll('*').remove()
        this.el.annotation.group.selectAll('.recovery-breakdown-labels').remove()
        this.el.defs.selectAll('path[id*="Arc_"]').remove()
        this.el.defs.selectAll('path[id*="textPath_"]').remove()
    }


    ///////////////////////////////////
    //// STATIC CONFIG AND METHODS ////
    ///////////////////////////////////

    static #computeFlowGeometry(data, dims, options = {}) {
        const { width, height, margin } = dims
        const {
            rMinFactor   = 5,
            streamHeight = (height - margin.top - margin.bottom) / 8,
            flowY        = margin.top + (height - margin.top - margin.bottom) * 0.5,
            reverseFlow  = false,    
        } = options

        const streams = Object.entries(data.byStream)
            .map(([name, d]) => ({
                name,
                generated: d.sectors?.All?.Generated             ?? 0,
                recovered: d.sectors?.All?.['Recovered - total'] ?? 0,
            }))
            .filter(s => s.generated > 0)
            .sort((a, b) => b.generated - a.generated)

        const n      = streams.length
        const slotH  = streamHeight / n
        const lineYs = streams.map((_, i) => flowY + i * slotH + slotH / 2)
        const rMin   = slotH * rMinFactor
        const radii  = streams.map((_, i) => rMin + (n - 1 - i) * slotH)

        const scale = d3.scaleSqrt()
            .domain([0, streams[0].generated])
            .range([1, slotH * 0.55])

        let sumCy = 0
        streams.forEach((s, i) => {
            const tGen = scale(s.generated),
                tRec   = scale(s.recovered),
                recCy  = (lineYs[i] + tGen / 2) - tRec / 2
            sumCy += recCy + radii[i]
        })
        const arcCentY = sumCy / n

        const tGenTop     = scale(streams[0].generated)
        const tGenBot     = scale(streams[n - 1].generated)
        const groupTop    = lineYs[0]     - tGenTop / 2
        const groupBot    = lineYs[n - 1] + tGenBot / 2
        const genSquareSize = groupBot - groupTop

        return { streams, n, slotH, lineYs, rMin, radii, scale,
                arcCentY, groupTop, groupBot, genSquareSize, flowY, streamHeight }
    }

    static #samplePath(pathNode, precision = 8) {
        const n = pathNode.getTotalLength()
        const t = [0]
        let i = 0
        while ((i += precision) < n) t.push(i)
        t.push(n)
        return t.map(t => {
            const p = pathNode.getPointAtLength(t)
            const a = [p.x, p.y]
            a.t = t / n
            return a
        })
    }

    static #quads(points) {
        return d3.range(points.length - 1).map(i => {
            const a = [
                i > 0                    ? points[i - 1] : null,
                points[i],
                points[i + 1],
                i < points.length - 2   ? points[i + 2] : null,
            ]
            a.t = (points[i].t + points[i + 1].t) / 2
            return a
        })
    }

    static #lineJoin(p0, p1, p2, p3, width) {
        const u12 = SystemVis.#perp(p1, p2),
            r     = width / 2
        let a = [p1[0] + u12[0] * r, p1[1] + u12[1] * r],
            b = [p2[0] + u12[0] * r, p2[1] + u12[1] * r],
            c = [p2[0] - u12[0] * r, p2[1] - u12[1] * r],
            d = [p1[0] - u12[0] * r, p1[1] - u12[1] * r]

        if (p0 != null) {
            const u01 = SystemVis.#perp(p0, p1),
                e     = [p1[0] + u01[0] + u12[0], p1[1] + u01[1] + u12[1]]
            a = SystemVis.#lineIntersect(p1, e, a, b)
            d = SystemVis.#lineIntersect(p1, e, d, c)
        }
        if (p3 != null) {
            const u23 = SystemVis.#perp(p2, p3),
                e     = [p2[0] + u23[0] + u12[0], p2[1] + u23[1] + u12[1]]
            b = SystemVis.#lineIntersect(p2, e, a, b)
            c = SystemVis.#lineIntersect(p2, e, d, c)
        }
        return `M${a}L${b} ${c} ${d}Z`
    }

    static #lineIntersect(a, b, c, d) {
        const x1 = c[0], x3 = a[0], x21 = d[0] - x1, x43 = b[0] - x3,
            y1    = c[1], y3 = a[1], y21 = d[1] - y1, y43 = b[1] - y3,
            ua    = (x43 * (y1 - y3) - y43 * (x1 - x3)) / (y43 * x21 - x43 * y21)
        return [x1 + ua * x21, y1 + ua * y21]
    }

    static #perp(p0, p1) {
        const u01x = p0[1] - p1[1],
            u01y    = p1[0] - p0[0],
            u01d    = Math.sqrt(u01x * u01x + u01y * u01y)
        return [u01x / u01d, u01y / u01d]
    }

    static #svgDoc = new DOMParser().parseFromString(svgScene, 'image/svg+xml');

    //////////////////////////
    ////  PUBLIC METHODS  ////
    //////////////////////////

    render() {
        const { dataModel } = this.app.module
        const data   = dataModel.data[this.app.state.select.year]
        const layout = this.#getLayout(data)

        this.el.vis.rotationGroup.attr('transform', `rotate(${layout.rotationAngle}, ${layout.rotateCx}, ${layout.rotateCy})`)
        this.el.annotation.rotationGroup.attr('transform', `rotate(${layout.rotationAngle}, ${layout.rotateCx}, ${layout.rotateCy})`)

        this.#draw(data, layout, { animate: true })
    }

    update() {
        const { dataModel } = this.app.module
        const data = dataModel.data[this.app.state.select.year]
        if (!data) return console.warn(`No data for year ${data}`)
        const layout = this.#getLayout(data)

        this.el.vis.rotationGroup
            .transition().duration(DataVis.CONFIG.animation.duration)
            .attr('transform', `rotate(${layout.rotationAngle}, ${layout.rotateCx}, ${layout.rotateCy})`)

        this.el.annotation.rotationGroup
            .transition().duration(DataVis.CONFIG.animation.duration)
            .attr('transform', `rotate(${layout.rotationAngle}, ${layout.rotateCx}, ${layout.rotateCy})`)

        this.#clearDynamic()
        this.#draw(data, layout, { animate: true })
    }
}