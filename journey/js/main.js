// Libs and utils
import * as d3              from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import { util }             from "../../_shared/js/util.js";

// Classes
import { App }              from "./App.js";
import { JourneyVis }     from "./Visualisation.js";
import { DataModel }        from "../../_shared/js/DataModel.js";

// I. Query params 
const params = new URLSearchParams(window.location.search);

// II. Initialise the application and reference app on window
window.app = await initApp()

async function initApp() {

    // i. App/DataVis level queryConfig options
    const queryConfig = {
        visOnly:        params.get('visOnly') === null ? false : true,     
        year:           params.get('year'),    
        view:           params.get('view'),    
    }

    // ii. Init app object
    const app = new App(queryConfig)

    // iii. Load data from static files
    const data = {
        vmp_pm:         await d3.tsv('../../_shared/data/VMP-PM.tsv', util.parseData),
        ce_metrics:     await d3.tsv('../../_shared/data/CE-METRICS.tsv', util.parseData),
        vlgas:          await d3.tsv('../../_shared/data/VLGAS.tsv', util.parseData)
    }

    // iv. Init app modules 
    const dataModel     = app.module.dataModel    = new DataModel(data, app)  
    app.initUI()
    const vis           = app.module.vis          = new JourneyVis(app)
    app.addHandlers()

    // => Return app
    return app
}

