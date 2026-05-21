
// Libs and data
import * as d3      from "https://cdn.jsdelivr.net/npm/d3@7/+esm";


// => Data Model class
export class DataModel {

    //////////////////////////////////////////
    ////  STATIC CLASS VARIABLES & FIELDS ////
    //////////////////////////////////////////

    static CONFIG = {
        focus: {
            jurisdiction: 'Victoria'
        },
        // Map VMP-PM sector codes to display names
        sectorMap: {
            'CND': 'C&D',
            'CNI': 'C&I',
            'MSW': 'MSW',
        },
        // Canonical financial year format: normalise both '2022-23' and '2022-2023' to '2022-23'
        normaliseFY: fy => {
            if (!fy) return fy
            // '2022-2023' → '2022-23'
            return fy.replace(/^(\d{4})-(\d{4})$/, (_, a, b) => `${a}-${b.slice(2)}`)
        },
        // Map financial year to calendar year (end year)
        fyToYear: fy => {
            const norm = DataModel.CONFIG.normaliseFY(fy)
            return norm ? 2000 + parseInt(norm.split('-')[1]) : null
        },
    }

    data   = undefined
    schema = undefined

    //////////////////////////////
    //// CONSTRUCTOR + CREATE ////
    //////////////////////////////

    constructor(data, app) {
        this.app   = app
        this.input = data

        this.data   = this.#transformData(this.input)
        this.schema = this.#buildSchema()
        console.log(this)
    }

    ///////////////////////////
    ////  PRIVATE METHODS  ////
    ///////////////////////////

    #transformData({ vmp_pm, ce_metrics, vlgas }) {
        const { normaliseFY, fyToYear } = DataModel.CONFIG

        const financialYears = [...new Set(vmp_pm.map(d => normaliseFY(d['Financial Year'])))]
            .sort()

        const byYear = {}

        for (const fy of financialYears) {
            const year   = fyToYear(fy)
            const pmRows = vmp_pm.filter(d => normaliseFY(d['Financial Year']) === fy)
            const ceRows = ce_metrics.filter(d =>
                normaliseFY(d['Financial Year']) === fy &&
                d['Jurisdiction'] === DataModel.CONFIG.focus.jurisdiction
            )

            const lgaRows = vlgas.filter(d => normaliseFY(d['financial_year']) === fy)  

            // Build bySector and byStream first — then aggregate from them
            const bySector = this.#buildBySector(pmRows)
            const byStream = this.#buildByStream(pmRows)

            // Merge CE metrics + derived CE metrics + aggregated flow metrics
            const metrics = {
                ...this.#buildMetrics(ceRows),
                ...this.#buildAggregateMetrics(pmRows, ceRows), 
                byStream: this.#buildCEMetricsByStream(ceRows),
                ...this.#buildLGAMetrics(lgaRows),    
            }

            byYear[year] = {
                financial_year: fy,
                year,
                metrics,
                bySector,
                byStream,
                byLGA: this.#buildByLGA(lgaRows),    
            }
        }

        return byYear
    }

    // Aggregate all VMP-PM flow volumes across all streams and sectors
    #buildAggregateMetrics(pmRows, ceRows) {   
        const { sectorMap } = DataModel.CONFIG

        // Helper: sum a column across a set of rows
        const sum = (rows, col) => d3.sum(rows, d => +d[col] || 0)

        // ── Generated ─────────────────────────────────────────────
        const generatedTotal = sum(pmRows, 'Total Generation')

        const generatedBySector = Object.fromEntries(
            Object.entries(sectorMap).map(([code, sector]) => {
                const rows = pmRows.filter(d => d['Source Sector'] === code)
                return [sector, sum(rows, 'Total Generation')]
            })
        )

        const generatedByStream = Object.fromEntries(
            [...d3.group(pmRows, d => d['Material Type'])].map(([stream, rows]) => [
                stream, sum(rows, 'Total Generation')
            ])
        )

        // ── Disposed ──────────────────────────────────────────────
        const disposedTotal = sum(pmRows, 'Disposal')

        const disposedBySector = Object.fromEntries(
            Object.entries(sectorMap).map(([code, sector]) => {
                const rows = pmRows.filter(d => d['Source Sector'] === code)
                return [sector, sum(rows, 'Disposal')]
            })
        )

        const disposedByStream = Object.fromEntries(
            [...d3.group(pmRows, d => d['Material Type'])].map(([stream, rows]) => [
                stream, sum(rows, 'Disposal')
            ])
        )

        // ── Recovered ─────────────────────────────────────────────
        const exportedInternational = sum(pmRows, 'International Export')
        const exportedInterstate    = sum(pmRows, 'Interstate Export')
        const exportedTotal         = exportedInternational + exportedInterstate
        const processedLocally      = sum(pmRows, 'Processed locally (including Waste to Energy)')
        const recoveredTotal        = exportedTotal + processedLocally
        const recoveryRate          = generatedTotal > 0
            ? Math.round(recoveredTotal / generatedTotal * 1000) / 10
            : 0

        const recoveredBySector = Object.fromEntries(
            Object.entries(sectorMap).map(([code, sector]) => {
                const rows  = pmRows.filter(d => d['Source Sector'] === code)
                const total = sum(rows, 'International Export')
                            + sum(rows, 'Interstate Export')
                            + sum(rows, 'Processed locally (including Waste to Energy)')
                return [sector, total]
            })
        )

        const recoveredByStream = Object.fromEntries(
            [...d3.group(pmRows, d => d['Material Type'])].map(([stream, rows]) => {
                const total = sum(rows, 'International Export')
                            + sum(rows, 'Interstate Export')
                            + sum(rows, 'Processed locally (including Waste to Energy)')
                return [stream, total]
            })
        )

        const exportedBySector = Object.fromEntries(
            Object.entries(sectorMap).map(([code, sector]) => {
                const rows = pmRows.filter(d => d['Source Sector'] === code)
                return [sector, {
                    total:         sum(rows, 'International Export') + sum(rows, 'Interstate Export'),
                    international: sum(rows, 'International Export'),
                    interstate:    sum(rows, 'Interstate Export'),
                }]
            })
        )

        const exportedByStream = Object.fromEntries(
            [...d3.group(pmRows, d => d['Material Type'])].map(([stream, rows]) => [
                stream, {
                    total:         sum(rows, 'International Export') + sum(rows, 'Interstate Export'),
                    international: sum(rows, 'International Export'),
                    interstate:    sum(rows, 'Interstate Export'),
                }
            ])
        )

        // ── Market values (summed across streams) ─────────────────
        const parseValue = v => +(String(v).replace(/,/g, ''))
        const marketRows = ceRows.filter(d =>
            d['Source Sector'] === 'All' &&
            d['Material Name'] === 'All' &&
            d['Material Type'] !== 'All'
        )
        const realisedMarketValue  = d3.sum(marketRows.filter(d => d['Metric'] === 'Realised market value'),  d => parseValue(d['Value']))
        const potentialMarketValue = d3.sum(marketRows.filter(d => d['Metric'] === 'Potential market value'), d => parseValue(d['Value']))


        // ── Assembled structure ───────────────────────────────────
        return {
            Aggregated: {
                recoveryRate,
                generated: {
                    total:          generatedTotal,
                    bySector:       generatedBySector,
                    byStream:       generatedByStream,
                },
                disposed: {
                    total:          disposedTotal,
                    bySector:       disposedBySector,
                    byStream:       disposedByStream,
                    marketValue:    potentialMarketValue
                },
                recovered: {
                    total:          recoveredTotal,
                    bySector:       recoveredBySector,
                    byStream:       recoveredByStream,
                    marketValue:    realisedMarketValue,
                    processedLocally,
                    exported: {
                        total:         exportedTotal,
                        international: exportedInternational,
                        interstate:    exportedInterstate,
                        bySector:      exportedBySector,
                        byStream:      exportedByStream,
                    }
                }
            }
        }
    }

    // CE-METRICS top-level economy metrics → flat { metricName: value }
    #buildMetrics(ceRows) {
        const parseValue = v => +(String(v).replace(/,/g, ''))
        const ceObj = Object.fromEntries(
            ceRows
                .filter(d =>
                    d['Source Sector'] === 'All' &&
                    d['Material Type'] === 'All' &&
                    d['Material Name'] === 'All'
                )
                .map(d => [d['Metric'], parseValue(d['Value'])])
        )
        // Add circularity rate
        if(ceRows.length > 0){
            ceObj['Circularity rate'] = ceObj['Secondary Material Consumption (SMC)']  / ceObj['Domestic Material Consumption (DMC)'] 
        }

        // => Return
        return ceObj
    }

    #buildCEMetricsByStream(ceRows) {
        const VALUE_METRICS = [
            'Realised market value',
            'Potential market value',
            'Commodity value',
        ]
        const parseValue = v => +(String(v).replace(/,/g, ''))

        // Filter to stream-level rows: sector=All, materialName=All, materialType is specific
        const rows = ceRows.filter(d =>
            d['Source Sector'] === 'All' &&
            d['Material Name'] === 'All'  &&
            d['Material Type'] !== 'All'  &&
            VALUE_METRICS.includes(d['Metric'])
        )

        const byStream = {}
        for (const row of rows) {
            const stream = row['Material Type']
            if (!byStream[stream]) byStream[stream] = {}
            byStream[stream][row['Metric']] = parseValue(row['Value'])
        }
        return byStream
    }

    // VLGAS 
    #buildLGAMetrics(lgaRows) {
        if (lgaRows.length === 0) return { lga: {}, count: {} }

        const sum = col => d3.sum(lgaRows, d => +d[col] || 0)

        const NOT_AVAILABLE = 'Not available'

        // Frequency counter helper
        const countFrequency = col => {
            const counts = {}
            for (const row of lgaRows) {
                const val = (row[col] === null || row[col] === undefined || row[col] === '' || row[col] !== row[col])
                    ? NOT_AVAILABLE
                    : String(row[col]).trim()
                counts[val] = (counts[val] ?? 0) + 1
            }
            return counts
        }

        // fogo: only 'Yes'/'No' are meaningful — everything else treat as Not available
        const fogoCount = { Yes: 0, No: 0, [NOT_AVAILABLE]: 0 }
        for (const row of lgaRows) {
            const v = row['kerbside_organics_fogo_included']
            if (v === 'Yes')      fogoCount.Yes++
            else if (v === 'No')  fogoCount.No++
            else                  fogoCount[NOT_AVAILABLE]++
        }

        return {
            lga: {
                Population:                                          sum('Population'),
                premises: {
                    residential:                                     sum('premises_residential'),
                    nonresidential:                                  sum('premises_nonresidential'),
                    with_garbage_service_residential:                sum('premises_with_garbage_service_residential'),
                    with_garbage_service_nonresidential:             sum('premises_with_garbage_service_nonresidential'),
                    with_kerbside_recycling_service_residential:     sum('premises_with_kerbside_recycling_service_residential'),
                    with_kerbside_recycling_service_nonresidential:  sum('premises_with_kerbside_recycling_service_nonresidential'),
                    with_kerbside_glass_service_residential:         sum('premises_with_kerbside_glass_service_residential'),
                    with_kerbside_glass_service_nonresidential:      sum('premises_with_kerbside_glass_service_nonresidential'),
                    with_hardwaste_service_residential:              sum('premises_with_access_to_hardwaste_service_residential'),
                    kerbside_organics_residential:                   sum('kerbside_organics_premises_residential'),
                },
                garbage_collected_total_tonnes:                      sum('garbage_collected_total_tonnes'),
                kerbside_recycling_total_collected_tonnes:           sum('kerbside_recycling_total_collected_tonnes'),
                kerbside_recycling_total_recycled_tonnes:            sum('kerbside_recycling_total_recycled_tonnes'),
                kerbside_recycling_glass_all_recycled_tonnes:        sum('kerbside_recycling_glass_all_recycled_tonnes'),
                kerbside_recycling_metal_recycled_tonnes:            sum('kerbside_recycling_metal_recycled_tonnes'),
                kerbside_recycling_paper_all_recycled_tonnes:        sum('kerbside_recycling_paper_all_recycled_tonnes'),
                kerbside_recycling_plastics_all_recycled_tonnes:     sum('kerbside_recycling_plastics_all_recycled_tonnes'),
                kerbside_organics_collected_tonnes:                  sum('kerbside_organics_collected_tonnes'),
                kerbside_organics_processed_tonnes:                  sum('kerbside_organics_processed_tonnes'),
                kerbside_glass_total_collected_tonnes:               sum('kerbside_glass_total_collected_tonnes'),
                dropoff_garbage_collected_tonnes:                    sum('dropoff_garbage_collected_tonnes'),
                dropoff_recycling_collected_tonnes:                  sum('dropoff_recycling_collected_tonnes'),
                hardwaste_collected_tonnes:                          sum('hardwaste_collected_tonnes'),
                hardwaste_disposed_tonnes:                           sum('hardwaste_disposed_tonnes'),
            },
            count: {
                councils:                    lgaRows.length,
                kerbside_organics_fogo:      fogoCount,
                garbage_service_frequency:   countFrequency('garbage_service_frequency'),
                kerbside_organics_bin_frequency: countFrequency('kerbside_organics_bin_frequency'),
            }
        }
    }

    #buildByLGA(lgaRows) {
        const result = {}
        for (const row of lgaRows) {
            const council = row['council']
            if (!council) continue
            result[council] = { ...row }
        }
        return result
    }



    // Compute derived values for a group of VMP-PM rows =>  Returns { Generated, Disposed, Recovered - exported, Recovered - processed locally, Recovered - total, Recovery rate }
    #deriveFlowMetrics(rows) {
        const generated          = d3.sum(rows, d => +d['Total Generation'])
        const disposed           = d3.sum(rows, d => +d['Disposal'])
        const recoveredExport    = d3.sum(rows, d => +d['International Export'] + +d['Interstate Export'])
        const recoveredLocal     = d3.sum(rows, d => +d['Processed locally (including Waste to Energy)'])
        const recoveredTotal     = recoveredExport + recoveredLocal
        const recoveryRate       = generated > 0 ? (recoveredTotal / generated) * 100 : 0

        return {
            'Generated':                    generated,
            'Disposed':                     disposed,
            'Recovered - exported':         recoveredExport,
            'Recovered - processed locally': recoveredLocal,
            'Recovered - total':            recoveredTotal,
            'Recovery rate':                Math.round(recoveryRate * 10) / 10,
        }
    }

    // sector > stream > { ...metrics, materials: { materialName: metrics } }
    #buildBySector(pmRows) {
        const { sectorMap } = DataModel.CONFIG
        const SECTORS = Object.values(sectorMap)   // ['C&D', 'C&I', 'MSW']

        const result = {}

        // i. Per-sector, per-stream
        for (const [code, sector] of Object.entries(sectorMap)) {
            const sectorRows = pmRows.filter(d => d['Source Sector'] === code)
            result[sector]   = {}

            // Group by Material Type (stream)
            const byStream = d3.group(sectorRows, d => d['Material Type'])

            for (const [stream, streamRows] of byStream) {
                // Stream-level metrics (summed across materials)
                const streamMetrics = this.#deriveFlowMetrics(streamRows)

                // Material-level metrics
                const byMaterial = d3.group(streamRows, d => d['Material Name'])
                const materials  = {}
                for (const [material, matRows] of byMaterial) {
                    materials[material] = this.#deriveFlowMetrics(matRows)
                }

                result[sector][stream] = {
                    ...streamMetrics,
                    materials,
                }
            }
        }

        // ii. 'All' sector — aggregate across all sector codes
        result['All'] = {}
        const byStream = d3.group(pmRows, d => d['Material Type'])

        for (const [stream, streamRows] of byStream) {
            const streamMetrics = this.#deriveFlowMetrics(streamRows)

            const byMaterial = d3.group(streamRows, d => d['Material Name'])
            const materials  = {}
            for (const [material, matRows] of byMaterial) {
                materials[material] = this.#deriveFlowMetrics(matRows)
            }

            result['All'][stream] = {
                ...streamMetrics,
                materials,
            }
        }

        return result
    }

    // stream > { sectors: { sectorName: metrics }, materials: { materialName: metrics } }
    #buildByStream(pmRows) {
        const { sectorMap } = DataModel.CONFIG
        const result = {}

        const byStream = d3.group(pmRows, d => d['Material Type'])

        for (const [stream, streamRows] of byStream) {
            // Per-sector metrics for this stream
            const sectors = {}

            // All sectors aggregate
            sectors['All'] = this.#deriveFlowMetrics(streamRows)

            for (const [code, sector] of Object.entries(sectorMap)) {
                const sectorRows = streamRows.filter(d => d['Source Sector'] === code)
                if (sectorRows.length > 0) {
                    sectors[sector] = this.#deriveFlowMetrics(sectorRows)
                }
            }

            // Material-level metrics (All sectors)
            const byMaterial = d3.group(streamRows, d => d['Material Name'])
            const materials  = {}
            for (const [material, matRows] of byMaterial) {
                materials[material] = this.#deriveFlowMetrics(matRows)
            }

            result[stream] = { sectors, materials }
        }

        return result
    }

    #buildSchema() {

        const { normaliseFY, fyToYear } = DataModel.CONFIG
        const { vmp_pm, ce_metrics, vlgas } = this.input

        const financialYears = [...new Set(vmp_pm.map(d => normaliseFY(d['Financial Year'])))].sort()

        const years = financialYears.map(fy => ({
            financial_year: fy,
            year:           fyToYear(fy),
        }))

        const yearToFinancialYear = Object.fromEntries(years.map(({ year, financial_year }) => [year, financial_year]))
        const financialYearToYear = Object.fromEntries(years.map(({ year, financial_year }) => [financial_year, year]))

        // VWMP&PM
        const streams   = [...new Set(vmp_pm.map(d => d['Material Type']))].sort()
        const sectors   = Object.values(DataModel.CONFIG.sectorMap)
        const materials = [...new Set(vmp_pm.map(d => d['Material Name']))].sort()

        const materialsByStream = Object.fromEntries(
            streams.map(stream => [
                stream,
                [...new Set(vmp_pm.filter(d => d['Material Type'] === stream).map(d => d['Material Name']))].sort()
            ])
        )

        // CE metric data
        const jurisdictions = [...new Set(ce_metrics.map(d => d['Jurisdiction']))].sort()
        const ceMetrics = [...new Set(ce_metrics.map(d => d['Metric']))].sort()
        const ceUnits   = Object.fromEntries( d3.rollup(ce_metrics, v => v[0]['Unit'], d => d['Metric']))


        // LGA data

        const councils = [...new Set(vlgas.map(d => d['council']))].filter(Boolean).sort()

        const NOT_AVAILABLE = 'Not available'

        const garbageFrequencies = [
            ...new Set(vlgas.map(d => d['garbage_service_frequency'] || NOT_AVAILABLE))
        ].filter(Boolean).sort()

        const recyclingFrequencies = [
            ...new Set(vlgas.map(d => d['kerbside_recycling_service_frequency'] || NOT_AVAILABLE))
        ].filter(Boolean).sort()

        const organicsFrequencies = [
            ...new Set(vlgas.map(d => d['kerbside_organics_bin_frequency'] || NOT_AVAILABLE))
        ].filter(Boolean).sort()

        // => Return 
        return {
            jurisdictions,
            years,
            yearToFinancialYear,
            financialYearToYear,
            sectors,
            streams,
            materials,
            materialsByStream,
            metrics: {
                ce:    ceMetrics,
                flow:  ['Generated', 'Disposed', 'Recovered - exported', 'Recovered - processed locally', 'Recovered - total', 'Recovery rate'],
                units: ceUnits,
            },
            lga: {
                councils,
                garbageFrequencies,
                recyclingFrequencies,
                organicsFrequencies,
            }
        }
    }
    ///////////////////////////
    ////  PUBLIC  METHODS  ////
    ///////////////////////////

    getUnit(metric) {
        return this.schema.metrics.units[metric]
    }

    getYears() {
        return this.schema.years
    }

    getStreams() {
        return this.schema.streams
    }
}