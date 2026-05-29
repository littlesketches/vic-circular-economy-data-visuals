// => App class
export class App{

    module = {}
    state  = {
        select: {   // 
            year:               undefined,
            showSidebar:        true,
            showCommentary:     true,
        },
        showSidebar:            true,
        showCommentary:         true,
        sidebarEditable:        false,
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
        // I. Set query config state (non data-dependent, e.g. year select require DataModel and schema to have been initialised)
        if(queryConfig.visOnly)         this.state.select.showSidebar = false
        if(queryConfig.noCommentary)    this.state.select.showCommentary = false
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
            firstYear = years[0],
            latestYear = years[years.length -1]

        years.forEach( (d, i) => {   
            if(i === 0) return 

            const option = new Option(`${firstYear.year} - ${d.year}`, d.year)
            yearSelect.append(option)
        })

        yearSelect.value = this.state.select.year 
                         = this.state.select.year ?? latestYear.year


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