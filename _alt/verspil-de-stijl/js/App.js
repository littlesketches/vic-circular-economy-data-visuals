// => App class
export class App {


    static CONFIG = {
        seed: [3, 4, 14, 22, 24, 27, 29, 37, 38, 41, 43, 48, 56, 57, 64, 71, 77, 81, 83, 84, 87, 88, 91, 102]
    }


    module = {}
    state = {
        select: {
            year:           2024,
            showSidebar:    true,
            outerSeed:      App.CONFIG.seed[0],
            innerSeed:      1
        }
    }


    /////////////////////
    //// CONSTRUCTOR ////
    /////////////////////

    constructor(queryConfig) {
        this.#initSettings(queryConfig)
    }


    ///////////////////////////
    ////  PRIVATE METHODS  ////
    ///////////////////////////

    #initSettings(queryConfig) {

        // I. Set query config state
        if(queryConfig.isPrimary)  document.getElementById('data-vis').classList.remove('mondrian')

    }

    //////////////////////////
    ////  PUBLIC METHODS  ////
    //////////////////////////


    initUI() {

        //////////////////////////////
        /// DATA DRIVEN SELECTORS  ///
        //////////////////////////////

        const { vis, dataModel } = this.module

        // i. Year selector
        const yearSelect = document.getElementById('year-select')

        const years = dataModel.schema.years,
            latestYear = years[years.length - 1]

        years.forEach(d => {
            const option = new Option(d.financial_year, d.year)
            yearSelect.append(option)
        })

        yearSelect.value = this.state.select.year = this.state.select.year ?? latestYear.year

        // ii. Outer seed
        const seedSelect = document.getElementById('composition-select')

        App.CONFIG.seed.forEach(seed => {
            const option = new Option(aphexName(seed), seed)
            seedSelect.append(option)
        })

        seedSelect.value = this.state.select.outerSeed = App.CONFIG.seed[0]
    }


    addHandlers() {

        // Module references
        const { vis, dataModel } = this.module


        /////////////////////////////////
        /// I. EVENT HANDLERS METHODS ///
        /////////////////////////////////

        this.handle = {
            update: (e) => {
                this.state.select.year = +e.srcElement.value
                vis.update()
            },
            updateOuterSeed: (e) => {
                this.state.select.outerSeed = +e.srcElement.value
                vis.update(this.state.select.outerSeed , this.state.select.innerSeed )
            },
            updateInnerSeed: (e) => {
                this.state.select.innerSeed = +e.srcElement.value
                vis.update(this.state.select.outerSeed , this.state.select.innerSeed )
            }

        }

        ////////////////////////////
        /// II. ATTACH HANDLERS  ///
        ////////////////////////////

        const yearSelect = document.getElementById('year-select')
        yearSelect.addEventListener('change', this.handle.update)


        const seedSelect = document.getElementById('composition-select')
        seedSelect.addEventListener('change', this.handle.updateOuterSeed)

        const variantSelect = document.getElementById('variation-no')
        variantSelect.addEventListener('change', this.handle.updateInnerSeed)
    }
}


function aphexName(seed) {
    const starts = [
        "fl", "dr", "ph", "sk", "vr",
        "qx", "tw", "bl", "syn", "kr"
    ]

    const vowels = [
        "a", "e", "i", "o", "u", "ae", "y"
    ]

    const ends = [
        "m", "n", "x", "th", "k",
        "rn", "q", "t", "sk", "l"
    ]

    // deterministic pseudo-random
    function rnd(n) {
        return Math.abs(
            Math.sin(n * 9999) * 10000
        ) % 1
    }

    const start =
        starts[Math.floor(rnd(seed) * starts.length)]

    const vowel =
        vowels[Math.floor(rnd(seed + 1) * vowels.length)]

    const end =
        ends[Math.floor(rnd(seed + 2) * ends.length)]

    // compact number fragment
    const tag = Math.abs(seed)
        .toString(36)
        .slice(-2)

    let name = start + vowel + end + tag

    // trim to <= 10 chars
    name = name.slice(0, 10)

    // capitalize
    return name.charAt(0).toUpperCase() + name.slice(1)
}

