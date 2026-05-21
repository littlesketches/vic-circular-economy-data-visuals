// Libs and data
import * as d3                      from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

/**
 *  MISCELLANEOUS UTILITY METHODS 
 */


const format = {      // Formatting helpers
    date:      d3.timeFormat('%Y-%m-%d'),
    comma:     d3.format(","),
    commaPlus: d3.format("+,"),
    dec1:      d3.format(".1f"),
    dec2:      d3.format(".2f"),
    dec3:      d3.format(".3f"),
    pct1:      d3.format(".1%"),
    toRoman:   (n) => ['I','II','III','IV','V','VI','VII','VIII','IX','X'][n - 1] ?? n
}

function slugify(str) {
    return str
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
}

const getRandomItem = (arr) =>  arr[Math.floor(Math.random() * arr.length)];


// Data parsing with d3.autoType extended to handle of numbers with text
function parseData (object){
    for (let key in object) {
        let value = object[key].trim();
        const commaNumRegex = /^-?\d{1,3}(,\d{3})+(\.\d+)?$/;

        if (commaNumRegex.test(value)) {
            object[key] = +value.replace(/,/g, "");           // Remove commas and convert to a number
        } else {
            object[key] = d3.autoType({ [key]: value })[key];     // Fallback to standard d3.autoType for dates, booleans, and plain numbers
        }
    }
  return object;
};

/** SVG  */
function wrapText(text, width, lineHeight = 1.2) {
    text.each(function () {
        const text      = d3.select(this)
        const words     = text.text().split(/\s+/).reverse()
        const x         = parseFloat(text.attr('x') || 0)   // ← read x from parent
        const y         = parseFloat(text.attr('y') || 0)
        const fontSize  = parseFloat(text.style('font-size'))
        const lineStep  = fontSize * lineHeight

        let line    = []
        let lineNum = 0
        let tspan   = text.text(null)
            .append('tspan')
            .attr('x', x)          // ← was 0
            .attr('y', y)

        let word
        while (word = words.pop()) {
            line.push(word)
            tspan.text(line.join(' '))
            if (tspan.node().getComputedTextLength() > width) {
                line.pop()
                tspan.text(line.join(' '))
                line = [word]
                tspan = text.append('tspan')
                    .attr('x', x)  // ← was 0
                    .attr('y', y + (++lineNum * lineStep))
                    .text(word)
            }
        }
    })
}




export const util = {
    parseData,
    format,
    slugify,
    getRandomItem,
    wrapText
}