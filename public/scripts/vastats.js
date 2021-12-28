const diff = (a, b) => {
    return Math.abs(a - b);
}


function calcHighest(array) {
    console.log(array)
    if (array.length == 0 || array.size == 0) {
        return ["None"];
    } else {
        return [...array.entries()].reduce((a, e) => e[1] > a[1] ? e : a);
    }
}


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
let fuelUsed = 0;

//Total Flights Stats
pireps.forEach(flight =>{
    if(flight.status == "a"){
        pirepTicker ++;
        fuelUsed += parseInt(flight.fuel);
    }
})
document.getElementById('stat_total_flights').innerHTML = pirepTicker;
document.getElementById('stat_value_fuel').innerHTML = fuelUsed;

//Total Flight Hours Stats
pireps.forEach(flight =>{
    if(flight.status == "a"){
        pirepHours += parseInt(flight.flightTime);
    }
})
document.getElementById('stat_total_hours').innerHTML = (pirepHours / 60).toFixed(2);

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
let maxRoute = calcHighest(routeCounter);
document.getElementById('stat_common_flight').innerHTML = maxRoute[0].split("_").join(" &#10142; ");

let distanceFlown = 0;

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
let maxCraft = calcHighest(craftCounter)
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

            //Distance
            distanceFlown += calcCrow(depPort.latitude, depPort.longitude, arrPort.latitude, arrPort.longitude);
        }
    })
    document.getElementById('stat_value_distance').innerHTML = distanceFlown.toFixed(2);
    let maxCountry = calcHighest(countryCounter);
    if(maxCountry[0] != "None"){
        document.getElementById('stat_common_country').innerHTML = ['<span class="flag-icon rounded flag-icon-', maxCountry[0].toLowerCase(), '"></span> ', maxCountry[0]].join("")
    }else{
        document.getElementById('stat_common_country').innerHTML = [maxCountry[0]].join("")
    }
    
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
    let maxType = calcHighest(typeCounter)
    document.getElementById('stat_common_type').innerHTML = maxType[0];

    //All Routes Map
    document.getElementById('allRoutesMap').style.height = "50vh";
    document.getElementById('loadingIndicator').classList.add('d-none');
    var map = L.map('allRoutesMap').setView([0, 0], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '<a href="https://va-center.com">VACenter</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
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
            const geodesic = new L.Geodesic([{ lat: start.latitude, lng: start.longitude }, { lat: end.latitude, lng: end.longitude }]).bindPopup(`<strong>${route.operatorCode}${route.num}:</strong> ${route.depICAO} ➞ ${route.arrICAO}`).addTo(map);

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

function calcCrow(lat1, lon1, lat2, lon2) {
    var R = 6371; // km
    var dLat = toRad(lat2 - lat1);
    var dLon = toRad(lon2 - lon1);
    var lat1 = toRad(lat1);
    var lat2 = toRad(lat2);

    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    var d = R * c;
    return d;
}

// Converts numeric degrees to radians
function toRad(Value) {
    return Value * Math.PI / 180;
}