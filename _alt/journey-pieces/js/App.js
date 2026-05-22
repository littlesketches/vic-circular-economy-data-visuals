// => App class
export class App{

    module = {}
    state  = {
        select: {   // 
            year:         undefined,
            showSidebar:  true
        }
    }


    /////////////////////
    //// CONSTRUCTOR ////
    /////////////////////

    constructor(queryConfig){
        this.#initSettings(queryConfig)
    }


    ///////////////////////////
    ////  PRIVATE METHODS  ////
    ///////////////////////////

    #initSettings(queryConfig){
        // I. Set query config state
    }

    //////////////////////////
    ////  PUBLIC METHODS  ////
    //////////////////////////


    initUI(){

        //////////////////////////////
        /// DATA DRIVEN SELECTORS  ///
        //////////////////////////////

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

    }


    addHandlers(){

        // Module references
        const { vis, dataModel } = this.module

console.log(vis)
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