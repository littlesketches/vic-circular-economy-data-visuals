// waste-scene.svg in text string => availble to DataVis class without async load
export const svgScene = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1700 284">
    <style>
        .palette-01{fill:#f5f0e8}.palette-02{fill:#f4d35e}.palette-03{fill:#e63946}.palette-04{fill:#1d3557}.palette-05{fill:#2d2d2d}
    </style>

    <g id="road">
        <path id="rect185" d="M0 230h1700v54H0z" class="palette-05" />
        <path id="rect187" fill="#3a3a3a" d="M0 230h1700v11H0z" />
        <g id="road-dashes" class="palette-01">
            <path d="M20 234h30v3H20z" />
            <path d="M116 234h30v3h-30z" />
            <path d="M212 234h30v3h-30z" />
            <path d="M308 234h30v3h-30z" />
            <path d="M404 234h30v3h-30z" />
            <path d="M500 234h30v3h-30z" />
            <path d="M596 234h30v3h-30z" />
            <path d="M692 234h30v3h-30z" />
            <path d="M788 234h30v3h-30z" />
            <path d="M884 234h30v3h-30z" />
            <path d="M980 234h30v3h-30z" />
            <path d="M1076 234h30v3h-30z" />
            <path d="M1172 234h30v3h-30z" />
            <path d="M1268 234h30v3h-30z" />
            <path d="M1364 234h30v3h-30z" />
            <path d="M1460 234h30v3h-30z" />
            <path d="M1556 234h30v3h-30z" />
            <path d="M1652 234h30v3h-30z" />
        </g>
    </g>

    <g id="collection-bins" transform="translate(160)">
        <g id="msw-bins" transform="translate(-109)">
            <g id="msw-bin-1">
                <path d="M-25 196h22v34h-22z" class="palette-04" />
                <path d="M-25 188h22v9h-22z" class="palette-03" />
            </g>
            <g id="msw-bin-2">
                <path d="M3 196h22v34H3z" class="palette-04" />
                <path d="M3 188h22v9H3z" class="palette-02" />
            </g>
        </g>
        <g id="ci-bin" transform="translate(-41)">
            <path d="M-33 164.291h66v66h-66z" class="palette-02" />
            <path d="M-32.47 164.821h66v10h-66z" class="palette-04" />
        </g>
        <g id="cd-skip" transform="translate(68)">
            <path d="M-66 168H66v62H-66z" class="palette-03" />
            <path d="M-66 168H66v10H-66z" class="palette-02" />
        </g>
    </g>

    <g id="waste-facility" transform="translate(850)">
        <g id="factory-walls">
            <path id="factory-wall-left" d="M-121 107h92v123h-92z" class="palette-04" />
            <path id="factory-wall-right" d="M-29 132h193v98H-29z" class="palette-03" />
        </g>
        <g id="factory-roofs">
            <path id="factory-roof-left" d="M-121 107V32a75 75 0 0 1 75 75Z" class="palette-03" />
            <g id="factory-roof-right">
                <path d="M-29 132V36a96 96 0 0 1 96 96Z" class="palette-02" />
                <path d="M67 132V36a96 96 0 0 1 96 96Z" class="palette-02" />
            </g>
        </g>
        <path id="factory-awning" d="M-121 107v42a42 42 0 0 1-42-42Z" class="palette-02" />
        <g id="factory-windows-left" class="palette-02">
            <path d="M-108 124h23v23h-23z" />
            <path d="M-73 124h23v23h-23z" />
            <path d="M-108 156h23v23h-23z" />
            <path d="M-73 156h23v23h-23z" />
        </g>
        <g id="factory-windows-right" class="palette-01">
            <path d="M-14 146h25v25h-25z" />
            <path d="M25 146h25v25H25z" />
            <path d="M64 146h25v25H64z" />
            <path d="M-14 179h25v25h-25z" />
            <path d="M25 179h25v25H25z" />
            <path d="M64 179h25v25H64z" />
        </g>
        <g id="factory-logo" transform="translate(134 172)">
            <path d="M-12-6 0-27 12-6z" class="palette-02" transform="translate(-6.802 10.204)" />
            <path d="M-12-6 0-27 12-6z" class="palette-02" transform="rotate(120 -6.347 3.138)" />
            <path d="M-12-6 0-27 12-6z" class="palette-02" transform="rotate(-120 -.456 7.065)" />
        </g>
    </g>

    <g id="truck-collection">
        <path d="M-98.333 207.052H100v16H-98.333z" class="palette-05"/>
        <g id="collection-tray">
            <path d="M87.565 131.58a41.07 41.07 0 0 1 35.57 20.535 41.07 41.07 0 0 1 0 41.071 41.07 41.07 0 0 1-35.57 20.536v-41.071z" class="palette-02"/>
            <path d="M-23.276 131.185H87.565v82.537H-23.276Z" class="palette-04" />
            <path d="M-22.654 187.705H88.187v6h-110.84z" class="palette-02" />
            <path d="M-22.63 202.7H88.21v5H-22.63z" class="palette-02" />
        </g>
        <g id="collection-cab">
            <path d="M-89.958 153.933h60v60h-60z" class="palette-03"/>
            <path d="M-83.156 160.735h25v25h-25z" style="fill:#fff"/>
            <path d="M-92.401 194h8v8h-8z" class="palette-02"/>
        </g>    
        <g id="collection-wheels">
            <g id="collection-wheel-front">
                <circle cx="-72" cy="223" r="16" class="palette-05"/>
                <circle cx="-72" cy="223" r="6" class="palette-01"/>
            </g>
            <g id="collection-wheel-rear-1">
                <circle cx="40" cy="223" r="16" class="palette-05"/>
                <circle cx="40" cy="223" r="6" class="palette-01"/>
            </g>
            <g id="collection-wheel-rear-2">
                <circle cx="76" cy="223" r="16" class="palette-05"/>
                <circle cx="76" cy="223" r="6" class="palette-01"/>
            </g>
        </g>
    </g>

    <g id="truck-disposal">
        <path d="M-98.333 207.052H100v16H-98.333z" class="palette-05"/>
        <g id="disposal-tray" transform="rotate(22.591641,104.10125,210.98094)">
            <path d="m 88.722123,131.20155 a 41.07,41.07 0 0 1 39.033887,-12.77757 41.07,41.07 0 0 1 30.58111,27.41576 41.07,41.07 0 0 1 -8.4528,40.19331 L 119.30321,158.6173 Z" class="palette-02" />
            <path d="M -23.276,131.185 H 87.565 v 82.537 H -23.276 Z" class="palette-04" />
            <path d="M -22.654,187.705 H 88.187 v 6 h -110.84 z" class="palette-02"/>
            <path d="M -22.63,202.7 H 88.21 v 5 H -22.63 Z" class="palette-02"/>
        </g>

        <g id="disposal-cab">
            <path d="M-89.958 153.933h60v60h-60z" class="palette-03"/>
            <path d="M-83.156 160.735h25v25h-25z" style="fill:#fff"/>
            <path d="M-92.401 194h8v8h-8z" class="palette-02"/>
        </g>    
        <g id="disposal-wheels">
            <g id = "disposal-wheel-front">
                <circle cx="-72" cy="223" r="16" class="palette-05"/>
                <circle cx="-72" cy="223" r="6" class="palette-01"/>
            </g>
            <g id = "disposal-wheel-rear-1">
                <circle cx="40" cy="223" r="16" class="palette-05"/>
                <circle cx="40" cy="223" r="6" class="palette-01"/>
            </g>
            <g id = "disposal-wheel-rear-2">
                <circle cx="76" cy="223" r="16" class="palette-05"/>
                <circle cx="76" cy="223" r="6" class="palette-01"/>
            </g>
        </g>
    </g>

</svg>
`;