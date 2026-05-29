// => App class
export class App{

    queryParams = {}
    module = {}
    state  = {
        select: {   
            year:                undefined,
        },
        showSidebar:            true,
        showCommentary:         true,
        sidebarEditable:        false,
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
        if(queryConfig.year)            this.state.select.year = +queryConfig.year
        if(queryConfig.visOnly)         this.state.showSidebar = false
        if(queryConfig.noCommentary)    this.state.showCommentary = false
        if(queryConfig.edit)            this.state.sidebarEditable = true
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

        this.state.select.year = this.state.select.year ?? latestYear.year


        //////////////////////////////
        /// II. APPLY LAYOUT STATE ///
        //////////////////////////////

        const main = document.querySelector('main.content__wrapper')
        if(!this.state.showSidebar )    main.classList.add('hide-sidebar')
        if(!this.state.showCommentary ) main.classList.add('hide-commentary')
        if(this.state.sidebarEditable){
            document.querySelector('header').setAttribute('contenteditable', true) 
            document.querySelector('footer').setAttribute('contenteditable', true) 
        }
    }

    addHandlers(){

        // Module references
        const { vis, dataModel } = this.module

        const yearSelect = document.getElementById('year-select')
        yearSelect.value = this.state.select.year

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