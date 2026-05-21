// Libs and data
import * as d3      from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import { svgScene } from "../assets/scene.js";

// Classes
import { DataVis }              from "../../../_shared/js/DataVis.js";
import { WasteBreakdownTreemap } from "../../../_shared/js/WasteBreakdownTreemap.js";


// => Data Visualisation class
export class MondrianWasteVis extends DataVis{


    /////////////////
    //// FIELDS  ////
    /////////////////

    state = {
        treemap: {
            seed:               { outer: 4, inner: 0 },         // Should be set by year?
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
        legend: {
            group:      undefined
        },
        annotation: {
            group:      undefined
        },
        tooltip: {
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
        this.render()           // Renders selected data (reusable to be called on update)
    }


    ///////////////////////////
    ////  PRIVATE METHODS  ////
    ///////////////////////////

    #initVis() {
        // I. Setup SVG and defs use in vs
        const { width, height, margin } = DataVis.CONFIG.dims

        const svg = this.el.svg = d3.select('svg#data-vis')
            .attr('viewBox', [0, 0, width, height])
            .classed('svg-vis', true)

        const defs = this.el.defs = svg.select('defs') ?? svg.append('defs')

        // II. VIS COMPONENT GROUPS 
        const visGroup = this.el.vis.group = svg.append('g').classed('vis-group', true)
        this.el.vis.treemap = visGroup.append('g').classed('treemap-group', true)

        // III. ANNOTATION — split: ce-metrics stays outside rotation, materialFlow inside
        const annotationGroup = this.el.annotation.group = svg.append('g').classed('annotation-group', true)
    }


    //////////////////////////
    ////  PUBLIC METHODS  ////
    //////////////////////////

    render() {
        const { dataModel } = this.app.module
        const data   = dataModel.data[this.app.state.select.year]

        const { width, height, margin } = DataVis.CONFIG.dims

        this.treemap = new WasteBreakdownTreemap(
            this.el.vis.treemap,
            {
                x:              margin.left,
                y:              margin.top,
                width:          width - margin.left - margin.right,
                height:         height - margin.top - margin.bottom,
            },
            WasteBreakdownTreemap.fromDataVisData(data),
            {
                showAnnotation: true,
                showTooltips:   true,
                seedOuter:      this.state.treemap.seed.outer, 
                seedInner:      this.state.treemap.seed.inner 
            }
        )
    }

    update(outerSeed, innerSeed) {
        const { dataModel } = this.app.module
        const data = dataModel.data[this.app.state.select.year]
        if (!data) return console.warn(`No data for year ${data}`)

        if(innerSeed) this.state.treemap.seed.inner = innerSeed
        if(outerSeed) this.state.treemap.seed.outer = outerSeed

        d3.selectAll('.stream-label').remove()
        this.render()
    }
}