// => App class
export class App{

    module = {}
    state  = {
        select: {   
            year:               2024,
            showSidebar:        true,
            showCommentary:     true,
        }
    }


    /////////////////////
    //// CONSTRUCTOR ////
    /////////////////////

    constructor(queryConfig){
        this._queryConfig = queryConfig 
        this.#initSettings(queryConfig)
    }


    ///////////////////////////
    ////  PRIVATE METHODS  ////
    ///////////////////////////

    #initSettings(queryConfig){
        // I. Set query config state
        if(queryConfig.visOnly) this.state.select.showSidebar = false
        if(queryConfig.year) this.state.select.year = +queryConfig.year
        if(queryConfig.noCommentary) this.state.select.showCommentary = false
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
            firstYear = years[0],
            latestYear = years[years.length -1]

        vis.targetData.forEach( (d, i) => {   
            if(i === 0) return 

            const option = new Option(`${vis.constructor.CONFIG.year.baseline} - ${d.year}`, d.year)
            yearSelect.append(option)
        })

        yearSelect.value = this.state.select.year = this.state.select.year ?? latestYear.year

        //////////////////////////////
        /// II. APPLY LAYOUT STATE ///
        //////////////////////////////

        const main = document.querySelector('main.content__wrapper')
        if(!this.state.select.showSidebar ) main.classList.add('hide-sidebar')
        if(!this.state.select.showCommentary ) main.classList.add('hide-commentary')
    }


    addHandlers(){

        // Module references
        const { vis, dataModel } = this.module

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

        const yearSelect = document.getElementById('year-select')
        yearSelect.addEventListener('change', this.handle.update)

    }
}