
    // #renderAreaBumpChart(data, layout, options = {}) {

    //     // ── 0. Guards + option defaults ────────────────────────────────────────
    //     if (!data?.length) return

    //     const {
    //         animate             = false,
    //         orientation         = 'vertical',
    //         streamPad           = 2,
    //         sortMetric          = 'generated',
    //         sortMode            = 'linear',       //'linear' | 'mountain'  
    //         reverseTime         = true,             // reverse time along the A-axi
    //         showStartAnnotation = true,
    //         showEndAnnotation   = true,
    //     } = options

    //     const isVertical = orientation === 'vertical'

    //     const { width, height, margin } = layout

    //     // ── 1. Derive chart data ──────────────────────────────
    //     const years = data.map(d => d.year).sort((a, b) => a - b),
    //         streams = Object.keys(DataVis.CONFIG.map.streamClass)

    //     const streamData = {}

    //     for (const stream of streams) {
    //         streamData[stream] = years.map(year => {
    //             const yearObj   = data.find(d => d.year === year),
    //                 streamObj = yearObj?.byStream?.[stream]?.sectors?.All ?? {},
    //                 population = yearObj?.metrics?.Population 

    //             return {
    //                 year,
    //                 generated: streamObj['Generated']  /    population     ?? 0,
    //                 recovered: streamObj['Recovered - total'] / population  ?? 0,
    //             }
    //         })
    //     }

    //     // ── 2. Chart dimensions and Axis semantics ───────────────────────────────────────────────
    //     const LABEL_PAD_L = 100,
    //         LABEL_PAD_R     = 100,
    //         CHART_LEFT    = margin.left + LABEL_PAD_L,
    //         CHART_RIGHT   = width - margin.right - LABEL_PAD_R,
    //         CHART_TOP     = layout.y,
    //         CHART_BOTTOM  = layout.y + height,
    //         CHART_W       = CHART_RIGHT - CHART_LEFT,
    //         CHART_H       = CHART_BOTTOM - CHART_TOP
       
    //     const A_START = isVertical ? CHART_TOP    : CHART_LEFT,         // A-axis = direction time flows  (x in horizontal, y in vertical)
    //         A_END   = isVertical ? CHART_BOTTOM : CHART_RIGHT,
    //         B_START = isVertical ? CHART_LEFT   : CHART_TOP,             // B-axis = direction streams stack (y in horizontal, x in vertical)
    //         B_END   = isVertical ? CHART_RIGHT  : CHART_BOTTOM,
    //         B_SPAN  = B_END - B_START

    //     const A_LABEL_PAD = isVertical ? 0 : 0      // Rotated labels in vertical mode need headroom at both A-axis ends

    //     // ── 3. Time-axis scale:  reverseTime flips the A-axis so newest year is at A_START (top in vertical)
    //     const aRange = reverseTime ? [A_END - A_LABEL_PAD, A_START + A_LABEL_PAD] : [A_START + A_LABEL_PAD, A_END - A_LABEL_PAD]

    //     const aScale = d3.scalePoint()
    //         .domain(years)
    //         .range(aRange)
    //         .padding(0.1)


    //     // ── 4. Sort helpers ────────────────────────────────────────────────────
    //     // sortMode 'mountain': fixed order from the latest year, interleaved so the largest stream is centre and magnitude decreases to both edges.  Bumping is disabled — a stream cannot cross the centre axis.
    //     // sortMode 'linear': per-year bump sort, largest at leading edge.

    //     const mountainInterleave = desc => {
    //         // Walk weakest→strongest, placing alternately at hi/lo so the strongest lands in the centre slot.
    //         const out = new Array(desc.length)
    //         let lo = 0, hi = desc.length - 1
    //         for (let i = desc.length - 1; i >= 0; i--) {
    //             if ((desc.length - 1 - i) % 2 === 0) out[hi--] = desc[i]
    //             else                                 out[lo++] = desc[i]
    //         }
    //         return out
    //     }

    //     const descForYear = year => {
    //         const valueOf = s => {
    //             const d = streamData[s].find(d => d.year === year)
    //             return sortMetric === 'recovered' ? (d?.recovered ?? 0) : (d?.generated ?? 0)
    //         }
    //         return [...streams].sort((a, b) => valueOf(b) - valueOf(a))
    //     }

    //     const anchorYear         = years[years.length - 1]
    //     const fixedMountainOrder = sortMode === 'mountain' ? mountainInterleave(descForYear(anchorYear)) : null

    //     const sortStreams = year => sortMode === 'mountain' ? fixedMountainOrder : descForYear(year)

    //     // ── 5. Compute layout_data ─────────────────────────────────────────────
    //     // layout_data[year][stream] = { b0, b1, bMid, rb0, rb1 }
    //     //   b1/b0  = leading/trailing band edges in B-axis pixels
    //     //   bMid   = band centre
    //     //   rb0/rb1 = recovered overlay edges, centred within the band

    //     const yearTotals = years.map(year => d3.sum(streams, s => streamData[s].find(d => d.year === year)?.generated ?? 0) ),
    //         maxTotal   = d3.max(yearTotals),
    //         totalPad   = streamPad * (streams.length - 1),
    //         STACK_SCALE = (B_SPAN * 0.92 - totalPad) / maxTotal

    //     const layout_data = {}

    //     for (const year of years) {
    //         const sorted  = sortStreams(year),
    //             total   = yearTotals[years.indexOf(year)],
    //             stackPx = total * STACK_SCALE + totalPad,
    //             bOrigin = B_START + B_SPAN / 2 - stackPx / 2

    //         let cumulative = 0
    //         layout_data[year] = {}

    //         for (let i = 0; i < sorted.length; i++) {
    //             const stream = sorted[i]
    //             const { generated, recovered } = streamData[stream].find(d => d.year === year),
    //                 bandPx    = generated * STACK_SCALE,
    //                 recoverPx = recovered * STACK_SCALE

    //             const b1   = bOrigin + cumulative,
    //                 b0   = b1 + bandPx,
    //                 bMid = (b0 + b1) / 2,
    //                 rb0  = bMid - recoverPx / 2,
    //                 rb1  = bMid + recoverPx / 2

    //             layout_data[year][stream] = { b0, b1, bMid, rb0, rb1 }
    //             cumulative += bandPx + (i < sorted.length - 1 ? streamPad : 0)
    //         }
    //     }

    //     // ── 6. Path generators ─────────────────────────────────────────────────
    //     const makeAreaPath = (leadFn, trailFn) => {
    //         if (!isVertical) {
    //             return d3.area()
    //                 .x(year  => aScale(year))
    //                 .y0(year => trailFn(year))
    //                 .y1(year => leadFn(year))
    //                 .curve(d3.curveCatmullRom.alpha(0.5))(years)
    //         } else {
    //             const lineA = d3.line()
    //                 .x(year => leadFn(year))
    //                 .y(year => aScale(year))
    //                 .curve(d3.curveCatmullRom.alpha(0.5))
    //             const lineB = d3.line()
    //                 .x(year => trailFn(year))
    //                 .y(year => aScale(year))
    //                 .curve(d3.curveCatmullRom.alpha(0.5))
    //             const fwd = lineA(years)
    //             const rev = lineB([...years].reverse())

    //             return fwd + rev.replace(/^M/, 'L') + 'Z'
    //         }
    //     }

    //     const genAreaPath = stream => makeAreaPath( year => layout_data[year]?.[stream]?.b1 ?? 0, year => layout_data[year]?.[stream]?.b0 ?? 0 )

    //     const recAreaPath = stream =>  makeAreaPath( year => layout_data[year]?.[stream]?.rb0 ?? 0,  year => layout_data[year]?.[stream]?.rb1 ?? 0 )

    //     // ── 7. DOM setup ───────────────────────────────────────────────────────

    //     let chartG = this.el.vis.wasteFlows
    //     if (chartG.empty()) chartG = group.append('g').classed('area-bump-chart', true)
    //     else chartG.selectAll('*').remove()

    //     const defs = this.el.defs
    //     defs.selectAll('#clip-area-bump').remove()
    //     defs.append('clipPath')
    //         .attr('id', 'clip-area-bump')
    //         .append('rect')
    //         .attr('x', CHART_LEFT).attr('y', CHART_TOP)
    //         .attr('width', CHART_W).attr('height', CHART_H)

    //     // ── 8. Gridlines + year labels ─────────────────────────────────────────
    //     const axisG = chartG.append('g').classed('year-axis', true)

    //     axisG.selectAll('line.year-tick')
    //         .data(years)
    //         .join('line')
    //         .classed('year-tick', true)
    //         .attr('x1', year => isVertical ? CHART_LEFT  : aScale(year))
    //         .attr('x2', year => isVertical ? CHART_RIGHT : aScale(year))
    //         .attr('y1', year => isVertical ? aScale(year) : CHART_TOP)
    //         .attr('y2', year => isVertical ? aScale(year) : CHART_BOTTOM)
    //         .attr('stroke-dasharray', '3,4')

    //     const fyLabel = year => {
    //         const fy = data.find(o => o.year === year)?.financial_year ?? String(year)
    //         return fy.replace(/^20(\d\d)-(\d\d)$/, '$1–$2').replace(/^20(\d\d)-20(\d\d)$/, '$1–$2')
    //     }

    //     // Vertical: year labels on the right so the left is free for stream labels
    //     axisG.selectAll('text.year-label')
    //         .data(years)
    //         .join('text')
    //         .classed('year-label', true)
    //         .attr('x',                 year => isVertical ? CHART_RIGHT + 8 : aScale(year))
    //         .attr('y',                 year => isVertical ? aScale(year)     : CHART_TOP - 8)
    //         .attr('text-anchor',       isVertical ? 'start'  : 'middle')
    //         .attr('dominant-baseline', isVertical ? 'middle' : 'auto')
    //         .text(fyLabel)

    //     // ── 9. Stream bands ───────────────────────────────────────────────────
    //     const streamsG = chartG.append('g')
    //         .classed('streams', true)
    //         .attr('clip-path', 'url(#clip-area-bump)')

    //     for (const stream of streams) {

    //         const streamG = streamsG.append('g')
    //             .classed('stream', true)
    //             .attr('data-stream', stream)

    //         const genPath = streamG.append('path')
    //             .classed(`disposal-area ${DataVis.CONFIG.map.streamClass[stream]}`, true)
    //             .attr('d', genAreaPath(stream))

    //         const recPath = streamG.append('path')
    //             .classed(`recovered-area ${DataVis.CONFIG.map.streamClass[stream]}`, true)
    //             .attr('d', recAreaPath(stream))

    //         if (animate) {
    //             genPath.attr('opacity', 0)
    //                 .transition().duration(600).ease(d3.easeCubicOut)
    //                 .attr('opacity', 1)

    //             const totalLen = recPath.node().getTotalLength?.() ?? 800
    //             recPath
    //                 .attr('stroke-dasharray', `${totalLen} ${totalLen}`)
    //                 .attr('stroke-dashoffset', totalLen)
    //                 .transition().duration(900).ease(d3.easeCubicOut)
    //                 .attr('stroke-dashoffset', 0)
    //                 .on('end', () => recPath.attr('stroke-dasharray', null).attr('stroke-dashoffset', null))
    //         }
    //     }

    //     // ── X. Centre-spine dot markers ───────────────────────────────────────
    //     // const dotsG = chartG.append('g').classed('rec-dots', true)

    //     // for (const stream of streams) {
    //     //     dotsG.selectAll(`circle.dot.${DataVis.CONFIG.map.streamClass[stream]}`)
    //     //         .data(years)
    //     //         .join('circle')
    //     //         .attr('class', `dot ${DataVis.CONFIG.map.streamClass[stream]}`)
    //     //         .attr('cx', year => isVertical ? (layout_data[year]?.[stream]?.bMid ?? 0) : aScale(year))
    //     //         .attr('cy', year => isVertical ? aScale(year) : (layout_data[year]?.[stream]?.bMid ?? 0))
    //     //         .attr('r', 7)
    //     // }

    //     // ── 10. Stream labels ──────────────────────────────────────────────────
    //     const shortName = s => s
    //         .replace('Aggregate, masonry and soils', 'Aggregate & soils')
    //         .replace('Paper and cardboard', 'Paper & cardboard')
    //         .replace('Tyres and rubber', 'Tyres & rubber')

    //     const firstYear = years[0],
    //         lastYear  = years[years.length - 1],
    //         startYear = reverseTime ? lastYear  : firstYear,
    //         endYear   = reverseTime ? firstYear : lastYear,
    //         labelsG   = chartG.append('g').classed('stream-labels', true)

    //     if (!isVertical) {
    //         const fs = width * 0.0125

    //         labelsG.selectAll('text.label-left')
    //             .data(streams)
    //             .join('text')
    //             .attr('class', d => `label-left label ${DataVis.CONFIG.map.streamClass[d]}`)
    //             .attr('x', aScale(startYear) - 10)
    //             .attr('y', d => layout_data[startYear]?.[d]?.bMid ?? 0)
    //             .attr('font-size', fs)
    //             .text(d => shortName(d))

    //         labelsG.selectAll('text.label-right')
    //             .data(streams)
    //             .join('text')
    //             .attr('class', d => `label-right label ${DataVis.CONFIG.map.streamClass[d]}`)
    //             .attr('x', aScale(endYear) + 10)
    //             .attr('y', d => layout_data[endYear]?.[d]?.bMid ?? 0)
    //             .attr('font-size', fs)
    //             .text(d => {
    //                 const gen = streamData[d].find(o => o.year === endYear)?.generated ?? 0
    //                 return `${shortName(d)}  ${d3.format(',.0f')(gen / 1000)}kt`
    //             })

    //     } else {
    //         // Vertical: rotated labels at top (entry) and bottom (exit) of chart.
    //         // After rotate(-90): text-anchor 'start' → text extends upward (away from chart edge)
    //         //                    text-anchor 'end'   → text extends downward (away from chart edge)
    //         // bMid is the B-axis (x) centre of each stream band at that edge year.

    //         const entryYear = reverseTime ? lastYear  : firstYear,
    //             exitYear = reverseTime ? firstYear : lastYear,
    //             fs = width * 0.02

    //         // Entry labels — above the topmost gridline (or below if reversed)
    //         labelsG.selectAll('text.label-entry')
    //             .data(streams)
    //             .join('text')
    //             .attr('class', d => `label-entry label ${DataVis.CONFIG.map.streamClass[d]}`)
    //             .attr('transform', d => {
    //                 const bMid = layout_data[entryYear]?.[d]?.bMid ?? 0,
    //                     ay   = aScale(entryYear) - 10
    //                 return `translate(${bMid},${ay}) rotate(-90)`
    //             })
    //             .attr('font-size', fs)
    //             .text(d => shortName(d))

    //         // Exit labels — below the bottommost gridline (or above if reversed)
    //         labelsG.selectAll('text.label-exit')
    //             .data(streams)
    //             .join('text')
    //             .attr('class', d => `label-exit label ${DataVis.CONFIG.map.streamClass[d]}`)
    //             .attr('transform', d => {
    //                 const bMid = layout_data[exitYear]?.[d]?.bMid ?? 0,
    //                     ay   = aScale(exitYear) + 10
    //                 return `translate(${bMid},${ay}) rotate(-90)`
    //             })
    //             .attr('font-size', fs)
    //             .text(d => {
    //                 const gen = streamData[d].find(o => o.year === exitYear)?.generated ?? 0
    //                 return `${shortName(d)}  ${d3.format(',.0f')(gen / 1000)}kt`
    //             })
    //     }

    //     // ── 11. Edge annotations ───────────────────────────────────────────────
    //     // Dashed rules + per-stream stub lines at the start and/or end edges.
    //     // Stubs mark the rb0/rb1 recovered band extents — these become the
    //     // connection points for #renderCircularFlow.

    //     const renderEdgeAnnotation = (edgeYear, side) => {
    //         const aPos   = aScale(edgeYear),
    //             annotG = chartG.append('g').classed(`annotation-edge annotation-${side}`, true),
    //             dir    = side === 'end' ? 1 : -1,
    //             STUB   = 8

    //         if (!isVertical) {
    //             annotG.append('line')
    //                 .classed('annotation-edge', true)
    //                 .attr('x1', aPos).attr('x2', aPos)
    //                 .attr('y1', B_START - 6).attr('y2', B_END + 6)
    //                 .attr('stroke-width', 1.5)
    //                 .attr('stroke-dasharray', '4,3')

    //             for (const stream of streams) {
    //                 const d = layout_data[edgeYear]?.[stream]; if (!d) continue
    //                 // const colour = STREAM_COLOURS[stream]
    //                 for (const edge of [d.rb0, d.rb1]) {
    //                     annotG.append('line')
    //                         .classed('annotation-edge', true)
    //                         .attr('x1', aPos).attr('x2', aPos + dir * STUB)
    //                         .attr('y1', edge).attr('y2', edge)
    //                         .attr('stroke-width', 1.5)
    //                 }
    //             }
    //         } else {

    //             annotG.append('line')
    //                 .attr('x1', B_START - 6).attr('x2', B_END + 6)
    //                 .attr('y1', aPos).attr('y2', aPos)
    //                 .attr('stroke-width', 1.5)
    //                 .attr('stroke-dasharray', '4,3')

    //             for (const stream of streams) {
    //                 const d = layout_data[edgeYear]?.[stream]; if (!d) continue

    //                 for (const edge of [d.rb0, d.rb1]) {
    //                     annotG.append('line').classed('annotation-edge', true)
    //                         .attr('x1', edge).attr('x2', edge)
    //                         .attr('y1', aPos).attr('y2', aPos + dir * STUB)
    //                         .attr('stroke-width', 1.5)
    //                 }
    //             }
    //         }
    //     }

    //     if (showStartAnnotation) renderEdgeAnnotation(startYear, 'start')
    //     if (showEndAnnotation)   renderEdgeAnnotation(endYear,   'end')

    //     // ==>  Return exit geometry for #renderCircularFlow ──────────────────
    //     // The exit edge is the newest year (endYear), which in the default
    //     // vertical+reverseTime configuration sits at the bottom of the chart.
    //     // exitBands preserves the rendered B-axis order so the circular flow
    //     // can place arcs in the same left→right sequence without crossings.

    //     const exitStreamOrder = sortStreams(endYear)
    //     const exitBands = exitStreamOrder.map(stream => ({
    //         stream,
    //         rb0:    layout_data[endYear][stream].rb0,   // left  edge of recovered band
    //         rb1:    layout_data[endYear][stream].rb1,   // right edge of recovered band
    //         bMid:   layout_data[endYear][stream].bMid,
    //         width:  layout_data[endYear][stream].rb1 - layout_data[endYear][stream].rb0,
    //     }))

    //     return {
    //         exitAPos:    aScale(endYear),           // y pixel of the exit row (vertical: bottom edge)
    //         exitBCentre: (B_START + B_END) / 2,    // x pixel centre of the full chart width
    //         exitBStart:  B_START,
    //         exitBEnd:    B_END,
    //         exitBands,
    //         isVertical,
    //     }
    // } 
