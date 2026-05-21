// Base DataVis class

export class DataVis {

    ///////////////////////////////////
    //// STATIC CONFIG AND METHODS ////
    ///////////////////////////////////

    static CONFIG = {
        dims: {
            width:      1200,
            height:     1200,
            margin: { 
                top: 50, bottom: 50, left: 50, right: 50 
            }
        },
        map: {
            sectorClass: {
                'MSW': 'msw', 'C&I': 'ci', 'C&D': 'cd'
            }, 
            sectorLabel: {
                'MSW': 'Municipal', 'C&I': 'Commercial & industrial', 'C&D': 'Construction & demolition'
            }, 
            streamClass: {
                'Aggregate, masonry and soils':  'aggregate-masonry-and-soils',
                'Organics':                     'organics',
                'Paper and cardboard':          'paper-and-cardboard',
                'Metals':                       'metals',
                'Plastic':                      'plastic',
                'Glass':                        'glass',
                'Textiles':                     'textiles',
                'Tyres and rubber':             'tyres-and-rubber'
            }        
        },
        animation: {
            duration: 1500,
        }
    }

    /////////////////////
    //// CONSTRUCTOR ////
    /////////////////////

    constructor(app, queryConfig) {
        // Store app reference
        this.app = app
    }

}