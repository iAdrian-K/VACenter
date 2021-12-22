//Data Stores
let pirepHours = 0;
let pirepTicker = 0;
const routeCounter = new Map();
const craftCounter = new Map();
const countryCounter = new Map();
const flownRoutesMap = new Map();
const typeCounter = new Map();
const airportMap = new Map();
const airportArray = [];
const loadedPortsRoutes = new Map();
const loadedPortsFlown = new Map();

//Total Flights Stats
pireps.forEach(flight =>{
    if(flight.status == "a"){
        pirepTicker ++;
    }
})
document.getElementById('stat_total_flights').innerHTML = pirepTicker;

//Total Flight Hours Stats
pireps.forEach(flight =>{
    if(flight.status == "a"){
        pirepHours += parseInt(flight.flightTime);
    }
})
document.getElementById('stat_total_hours').innerHTML = pirepHours / 60;

//Common Flight
pireps.forEach(flight =>{
    if(flight.status == "a"){
        if(routeCounter.has(`${flight.depICAO}_${flight.arrICAO}`)){
            let route = routeCounter.get(`${flight.depICAO}_${flight.arrICAO}`);
            route++;
            routeCounter.set(`${flight.depICAO}_${flight.arrICAO}`, route);
        }else{
            routeCounter.set(`${flight.depICAO}_${flight.arrICAO}`, 1);
        }
    }
})
let maxRoute = [...routeCounter.entries()].reduce((a, e) => e[1] > a[1] ? e : a);
document.getElementById('stat_common_flight').innerHTML = maxRoute[0].split("_").join(" &#10142; ");

//Common Vehicle
pireps.forEach(flight => {
    if (flight.status == "a") {
        if (craftCounter.has(flight.vehiclePublic)) {
            let craft = craftCounter.get(flight.vehiclePublic);
            craft++;
            craftCounter.set(flight.vehiclePublic, craft);
        } else {
            craftCounter.set(flight.vehiclePublic, 1);
        }
    }
})
let maxCraft = [...craftCounter.entries()].reduce((a, e) => e[1] > a[1] ? e : a);
document.getElementById('stat_common_plane').innerHTML = maxCraft[0].split("_").join(" &#10142; ");

//Airport Info Required
function getAirportList(){
    pireps.forEach(flight =>{
        airportArray.push(flight.depICAO);
        airportArray.push(flight.arrICAO);
    })
    routes.forEach(route =>{
        airportArray.push(route.depICAO);
        airportArray.push(route.arrICAO);
    })
}

function getAirportInfo(code){
    return new Promise((resolve, reject) =>{
        const settings = {
            "async": true,
            "crossDomain": true,
            "url": "https://api.va-center.com/VVCL/getAirport",
            "method": "GET",
            "headers": {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            "data": {
                "code": code,
            }
        };

        $.ajax(settings).done(function (response) {
            const data = JSON.parse(response);
            airportMap.set(data.icaoCode, data);
            resolve();
        });
    })
}

function dataLoaded() {
    //Common Country
    pireps.forEach(flight =>{
        if(flight.status == "a"){
            const depPort = airportMap.get(flight.depICAO);
            const arrPort = airportMap.get(flight.arrICAO);
            if (countryCounter.has(depPort.country)) {
                let country = countryCounter.get(depPort.country);
                country++;
                countryCounter.set(depPort.country, country);
            } else {
                countryCounter.set(depPort.country, 1);
            }
            if (countryCounter.has(arrPort.country)) {
                let country = countryCounter.get(arrPort.country);
                country++;
                countryCounter.set(arrPort.country, country);
            } else {
                countryCounter.set(arrPort.country, 1);
            }
        }
    })
    let maxCountry = [...countryCounter.entries()].reduce((a, e) => e[1] > a[1] ? e : a);
    document.getElementById('stat_common_country').innerHTML = ['<span class="flag-icon rounded flag-icon-', maxCountry[0].toLowerCase(), '"></span> ', maxCountry[0]].join("")
    //Common Type
    pireps.forEach(flight => {
        if (flight.status == "a") {
            const depPort = airportMap.get(flight.depICAO);
            const arrPort = airportMap.get(flight.arrICAO);
            if (typeCounter.has(depPort.type)) {
                let type = typeCounter.get(depPort.type);
                type++;
                typeCounter.set(depPort.type, type);
            } else {
                typeCounter.set(depPort.type, 1);
            }
            if (typeCounter.has(arrPort.type)) {
                let type = typeCounter.get(arrPort.type);
                type++;
                typeCounter.set(arrPort.type, type);
            } else {
                typeCounter.set(arrPort.type, 1);
            }
        }
    })
    let maxType = [...typeCounter.entries()].reduce((a, e) => e[1] > a[1] ? e : a);
    document.getElementById('stat_common_type').innerHTML = maxType[0];

    //All Routes Map
    document.getElementById('allRoutesMap').style.height = "50vh";
    document.getElementById('loadingIndicator').classList.add('d-none');
    var map = L.map('allRoutesMap').setView([0, 0], 3);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
        //Load Ports
        routes.forEach(route =>{
            if(loadedPortsRoutes.has(route.depICAO) == false){
                loadedPortsRoutes.set(route.depICAO, true);
                const dataDepPort = airportMap.get(route.depICAO);
                L.marker([dataDepPort.latitude, dataDepPort.longitude], {
                    icon: airportIcon
                }).addTo(map)
                    .bindPopup(`<strong>${dataDepPort.name}</strong><br>${dataDepPort.icaoCode} | ${dataDepPort.type}`)
            }
            if (loadedPortsRoutes.has(route.arrICAO) == false) {
                loadedPortsRoutes.set(route.arrICAO, true);
                const dataArrPort = airportMap.get(route.arrICAO);
                L.marker([dataArrPort.latitude, dataArrPort.longitude], {
                    icon: airportIcon
                }).addTo(map)
                    .bindPopup(`<strong>${dataArrPort.name}</strong><br>${dataArrPort.icaoCode} | ${dataArrPort.type}`)
            }
        })
        //Load Routes
        routes.forEach(route =>{
            const start = airportMap.get(route.depICAO);
            const end = airportMap.get(route.arrICAO);
            var polygon = L.polygon([
                [start.latitude, start.longitude],
                [end.latitude, end.longitude]
            ])
            polygon.bindPopup(`<strong>${config.code}${route.num}:</strong> ${route.depICAO} &#10142; ${route.arrICAO}`);
            polygon.addTo(map);

        });
}

async function worker(){
    while(airportArray.length > 0){
        if(airportMap.has(airportArray[0])){
            airportArray.shift();
        }else{
            await getAirportInfo(airportArray[0]);
            airportArray.shift();
        }
    }
    dataLoaded()
}

getAirportList();
worker();

var airportIcon = L.icon({
    iconUrl: '/public/images/airport.svg',

    iconSize: [40, 40], // size of the icon
    iconAnchor: [20, 20], // point of the icon which will correspond to marker's location
    popupAnchor: [0, -20] // point from which the popup should open relative to the iconAnchor
});