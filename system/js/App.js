// => App class
export class App{

    queryParams = {}
    module = {}
    state  = {
        select: {   
            year:                   2024,
            showSidebar:            true,
            minimalAnnotation:      true
        }
    }


    /////////////////////
    //// CONSTRUCTOR ////
    /////////////////////

    constructor(queryConfig){
        this.queryParams = queryConfig
        this.#initSettings(queryConfig)
    }


    ///////////////////////////
    ////  PRIVATE METHODS  ////
    ///////////////////////////

    #initSettings(queryConfig){
        // I. Set query config state (non data-dependent, e.g. year select require DataModel and schema to have been initialised)
        if(queryConfig.visOnly) this.state.select.showSidebar = false
        if(queryConfig.minimalist) this.state.select.minimalAnnotation = false

    }

    //////////////////////////
    ////  PUBLIC METHODS  ////
    //////////////////////////

    initUI(){

        /////////////////////////////////
        /// I. DATA DRIVEN SELECTORS  ///
        /////////////////////////////////

        const { vis, dataModel } = this.module

        // i. Year selector
        const yearSelect = document.getElementById('year-select')

        const years = dataModel.schema.years,
            latestYear = years[years.length -1]

        years.forEach( d => {   
            const option = new Option(d.financial_year, d.year)
            yearSelect.append(option)
        })

        //////////////////////////////
        /// II. APPLY LAYOUT STATE ///
        //////////////////////////////

        const main = document.querySelector('main.content__wrapper')
        if(!this.state.select.showSidebar ) main.classList.add('hide-sidebar')

        if(!this.state.select.minimalAnnotation ) main.classList.add('minimalist')

    }

    addHandlers(){

        // Module references
        const { vis, dataModel } = this.module

        const yearSelect = document.getElementById('year-select')
        yearSelect.value = this.state.select.year 
                         = this.state.select.year ?? latestYear.year

        /////////////////////////////////
        /// I. EVENT HANDLERS METHODS ///
        /////////////////////////////////

        this.handle = {
            update: (e) => {
                this.state.select.year = +e.srcElement.value
                vis.update()
            }

        }

        ////////////////////////////
        /// II. ATTACH HANDLERS  ///
        ////////////////////////////

        yearSelect.addEventListener('change', this.handle.update)

    }
}