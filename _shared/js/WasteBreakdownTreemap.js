// Libs and data
import * as d3      from "https://cdn.jsdelivr.net/npm/d3@7/+esm";


// => Waste sector and material treemap class
export class WasteBreakdownTreemap {

    static CONFIG = {
        squareSeed:  [3, 4, 14, 22, 24, 27, 29, 37, 38, 41, 43, 48, 56, 57, 64, 71, 77, 81, 83, 84, 87, 88, 91, 102  ]   // Squure
    }

    ////////////////////////
    /// STATIC / CONFIG  ///
    ////////////////////////

    static defaultOptions = {
        seedOuter:         24,          // 3
        seedInner:          9,
        showAnnotation:     true,
        showTooltips:       true,
        paddingOuter:       0.0035,       // Proportion of width
        paddingInner:       0.0025,        // Proportion of width
        tooltip:            null,
        onHover:            null,
    }

    static fromDataVisData(data, streamClassMap = {}, sectors = ['MSW', 'C&I', 'C&D']) {
        return {
            sectors,
            streams: [...new Set(
                sectors.flatMap(s => Object.keys(data.bySector[s] || {}))
            )].map(name => ({
                name,
                streamClass: streamClassMap[name] ?? null,
                cells: sectors
                    .map(sector => ({
                        sector,
                        generated: data.bySector[sector]?.[name]?.['Generated']      ?? 0,
                        recovery:  (data.bySector[sector]?.[name]?.['Recovery rate'] ?? 0) / 100,
                    }))
                    .filter(c => c.generated > 0)
            }))
        }
    }

    static #sectorClass(sector) {
        return { 'MSW': 'msw', 'C&I': 'ci', 'C&D': 'cd' }[sector] ?? ''
    }

    static #streamClass(stream) {
        return {
                'Aggregate, masonry and soils':  'aggregate-masonry-and-soils',
                'Organics':                     'organics',
                'Paper and cardboard':          'paper-and-cardboard',
                'Metals':                       'metals',
                'Plastic':                      'plastic',
                'Glass':                        'glass',
                'Textiles':                     'textiles',
                'Tyres and rubber':             'tyres-and-rubber'
            }[stream] ?? ''
    }

    static #hashFlip(str) {
        let h = 0
        for (let i = 0; i < str.length; i++)
            h = (Math.imul(31, h) + str.charCodeAt(i)) | 0

        return Math.abs(h) % 2
    }

    static #deterministicShuffle(arr, seed) {
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

    static #getBestSplit(name) {
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


    ////////////////
    ///  FIELDS  ///
    ////////////////

    #container  = null
    #group      = null
    #options    = {}
    #layout     = {}
    #data       = null


    /////////////////////
    ///  CONSTRUCTOR  ///
    /////////////////////

    constructor(container, layout, data, options = {}) {
        this.#container = container instanceof d3.selection ? container : d3.select(container)
        this.#options   = { ...WasteBreakdownTreemap.defaultOptions, ...options }
        this.#layout    = layout
        this.#data      = data

        this.#group = this.#container.append('g')
            .classed('waste-breakdown-treemap', true)

        this.#render()
    }


    /////////////////////////
    ///  PRIVATE METHODS  ///
    /////////////////////////

    #render() {
        const { x, y, width, height } = this.#layout
        const { showAnnotation, showTooltips } = this.#options

        this.#group.attr('transform', `translate(${x}, ${y})`)

        this.#group.append('rect')
            .classed('treemap-bg', true)
            .attr('width', width)
            .attr('height', height)

        const { allLeaves, outerHierarchy } = this.#computeLeaves()
        const cells = this.#renderCells(allLeaves)

        if (showAnnotation) this.#renderAnnotation(outerHierarchy)
        if (showTooltips)   this.#renderTooltips(cells)
    }

    #clear() {
        this.#group.selectAll('*').remove()
    }

    // Treemap rendering methods 
    #computeLeaves() {

        // I. LAYOUT
        const { width, height } = this.#layout
        const { seedOuter, seedInner, paddingOuter, paddingInner } = this.#options
        const { streams } = this.#data

        const pOuter = width * paddingOuter,        // padding === cell borders
            pInner =  width * paddingInner        // And set as proportion of width for relative sizing

        const outerTreemap = d3.treemap()
            .size([width - 2 * pOuter, height - 2 * pOuter])  // shrink the layout area
            .tile(d3.treemapBinary)
            .paddingOuter(pOuter)
            .paddingInner(pOuter / 2)


        // II. DATA HIERARCHY AND STRUCTURING
        const outerHierarchy = d3.hierarchy({
            name: 'root',
            children: WasteBreakdownTreemap.#deterministicShuffle(
                streams.map(s => ({ name: s.name, value: d3.sum(s.cells, c => c.generated) })),
                seedOuter
            )
        }).sum(d => d.value)

        outerTreemap(outerHierarchy)

        outerHierarchy.children.forEach(node => {
            node.x0 += pOuter
            node.x1 += pOuter
            node.y0 += pOuter
            node.y1 += pOuter
        })

        // III. DATA AT LEAF (STREAM) LEVEL
        const allLeaves = []

        outerHierarchy.children.forEach(streamNode => {
            const { name } = streamNode.data
            const sw     = streamNode.x1 - streamNode.x0
            const sh     = streamNode.y1 - streamNode.y0
            const stream = streams.find(s => s.name === name)

            const innerHierarchy = d3.hierarchy({
                name,
                children: WasteBreakdownTreemap.#deterministicShuffle(
                    stream.cells.map(c => ({
                        name:        c.sector,
                        stream:      name,
                        streamClass: stream.streamClass ?? null,
                        sector:      c.sector,
                        total:       c.generated,
                        recovery:    c.recovery,
                    })),
                    seedInner
                )
            }).sum(d => d.total)

            d3.treemap()
                .size([sw, sh])
                .tile(d3.treemapBinary)
                .paddingOuter(pOuter)
                .paddingInner(pInner)
                (innerHierarchy)

            innerHierarchy.leaves().forEach(leaf => {
                leaf.x0 += streamNode.x0
                leaf.x1 += streamNode.x0
                leaf.y0 += streamNode.y0
                leaf.y1 += streamNode.y0
                allLeaves.push(leaf)
            })
        })

        // => Return leaves and heirarchy data
        return { allLeaves, outerHierarchy }
    }

    #renderCells(allLeaves) {
        // I. Layout
        const { width } = this.#layout

        const borderDisposalRecovered = width * this.#options.paddingInner ?? width * 0.0025 //  Set to the same as pInner

        const cells = this.#group.selectAll('g.treemap-cell')
            .data(allLeaves)
            .join('g')
            .classed('treemap-cell', true)
            .attr('transform', d => `translate(${d.x0}, ${d.y0})`)

        cells.each(function(d) {

            // i. Get (and test for valid) cell dimensions
            const cw = Math.max(0, d.x1 - d.x0),
                ch = Math.max(0, d.y1 - d.y0)

            if (cw < 1 || ch < 1) return

            // ii. Cell configuration
            const g             = d3.select(this),
                r               = d.data.recovery,
                half            = borderDisposalRecovered * 0.5,
                sectorClass     = WasteBreakdownTreemap.#sectorClass(d.data.sector),
                streamClass     = d.data.streamClass ?? '',
                isFlipped       = WasteBreakdownTreemap.#hashFlip(d.data.stream + d.data.sector),
                isHorizontal    = cw >= ch,
                recoveredClass  = `${sectorClass} recovered ${streamClass}`.trim(),
                disposedClass   = `${sectorClass} landfill  ${streamClass}`.trim()

            /// iii. a. Add horizontal aspect rectangular cell
            if (isHorizontal) {
                const rw = cw * r,
                    dw = cw - rw

                if (rw > 0) g.append('rect').classed(recoveredClass, true)
                    .attr('x',      isFlipped ? dw + half : 0)
                    .attr('y',      0)
                    .attr('width',  Math.max(0, rw - half))
                    .attr('height', ch)

                if (dw > 0) g.append('rect').classed(disposedClass, true)
                    .attr('x',      isFlipped ? 0 : rw + half)
                    .attr('y',      0)
                    .attr('width',  Math.max(0, dw - half))
                    .attr('height', ch)

            /// iii. a. Add vertical aspect rectangular cell
            } else {
                const rh = ch * r,
                    dh = ch - rh

                if (rh > 0) g.append('rect').classed(recoveredClass, true)
                    .attr('x',      0)
                    .attr('y',      isFlipped ? 0 : dh + half)
                    .attr('width',  cw)
                    .attr('height', Math.max(0, rh - half))

                if (dh > 0) g.append('rect').classed(disposedClass, true)
                    .attr('x',      0)
                    .attr('y',      isFlipped ? rh + half : 0)
                    .attr('width',  cw)
                    .attr('height', Math.max(0, dh - half))
            }
        })

        // => Return cell group
        return cells
    }

    #renderAnnotation(outerHierarchy) {

        /////////////////////////////
        // I. LAYOUT DIMENSTIONS  ///
        /////////////////////////////

        const { width, height } = this.#layout

        const pOuter   = this.#options.paddingOuter * width ,
            EPS = pOuter * 2 + 1,
            labelPad = width * 0.02,
            labelFs  = width * 0.02

        // i. Add label helper => accepts rRotatio with position set for each label, depending on position
        const addLabel = (lx, ly, anchor, rotate, text, streamClass) => {

            this.#group.append('text')
                .classed(`stream-label ${streamClass}`, true)
                .attr('x', lx).attr('y', ly)
                .attr('text-anchor', anchor)
                .attr('font-size', labelFs)
                .attr('transform', rotate
                    ? `rotate(${rotate[0]}, ${rotate[1]}, ${rotate[2]})`
                    : null)
                .text(text)
        }

        /////////////////////////////////////////
        /// II. MATERIAL LABELS ON OUTER EDGE ///
        /////////////////////////////////////////

        outerHierarchy.children.forEach(streamNode => {

            // i. Get material stream and cell layout
            const { x0, x1, y0, y1 } = streamNode

            const  cx   = (x0 + x1) / 2,
                cy   = (y0 + y1) / 2,
                sw   = x1 - x0,
                sh   = y1 - y0

            const name = streamNode.data.name,
                streamClass = WasteBreakdownTreemap.#streamClass(name)

            // ii. Detect if outer cell/material is on a corner
            const tT = y0 <= EPS,
                tB = y1 >= height - EPS,
                tL = x0 <= EPS,
                tR = x1 >= width  - EPS

            const isCorner = (tT || tB) && (tL || tR)

            // iii. a. Corners have split text wrapped around the corner
            if (isCorner) { 
                const [a, b] = WasteBreakdownTreemap.#getBestSplit(name) || [name, name]
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
                corners[key].forEach(args => addLabel(...args, streamClass))

            // iii. b. Edges are centered on cell edge
            } else {
                const preferV = sh > sw
                const edges = [
                    [preferV && tL, x0 - labelPad, cy,            'middle', [-90, x0 - labelPad, cy]],
                    [preferV && tR, x1 + labelPad, cy,            'middle', [ 90, x1 + labelPad, cy]],
                    [tT,            cx,             y0 - labelPad, 'middle', null],
                    [tB,            cx,             y1 + labelPad, 'middle', null],
                    [tL,            x0 - labelPad, cy,            'middle', [-90, x0 - labelPad, cy]],
                    [tR,            x1 + labelPad, cy,            'middle', [ 90, x1 + labelPad, cy]],
                ]
                const match = edges.find(([cond]) => cond)
                if (match) {
                    const [, lx, ly, anchor, rotate] = match
                    addLabel(lx, ly, anchor, rotate, name, streamClass)
                }
            }
        })
    }

    #renderTooltips(cells) {
        const { onHover, tooltip } = this.#options
        const tip = tooltip ?? document.querySelector('#tooltip')

        cells.append('rect')
            .classed('treemap-hit-area', true)
            .attr('x', 0).attr('y', 0)
            .attr('width',  d => Math.max(0, d.x1 - d.x0))
            .attr('height', d => Math.max(0, d.y1 - d.y0))

        cells
            .on('mousemove', (event, d) => {
                if (onHover) { onHover(d.data); return }
                if (!tip) return
                const pctRecovered = Math.round(d.data.recovery * 100)
                const pctLandfill  = 100 - pctRecovered
                const tipParent    = tip.offsetParent ?? document.body          // ← use tooltip's own offset parent
                const parentRect   = tipParent.getBoundingClientRect()          // ← not the SVG rect
                tip.style.opacity  = 1
                tip.style.left     = (event.clientX - parentRect.left + 14) + 'px'
                tip.style.top      = (event.clientY - parentRect.top  - 10) + 'px'
                tip.innerHTML      = `<strong>${d.data.stream}</strong><br>${d.data.sector}<br>
                                    ${pctRecovered}% recovered<br>${pctLandfill}% to landfill`
            })
            .on('mouseleave', () => {
                if (tip) tip.style.opacity = 0
            })
    }


    ////////////////////////
    ///  PUBLIC METHODS  ///
    ////////////////////////

    update(data, layout, options = {}) {
        this.#data    = data    ?? this.#data
        this.#layout  = layout  ?? this.#layout
        this.#options = { ...this.#options, ...options }

        this.#clear()
        this.#render()
    }

    resize(layout) {
        this.update(null, layout)
    }

    destroy() {
        this.#group.remove()
    }

    get node() { return this.#group}
}