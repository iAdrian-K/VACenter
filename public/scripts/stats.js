function calcHighest(array){
    console.log(array)
    if(array.length == 0 || array.size == 0){
        return ["None"];
    }else{
        return [...array.entries()].reduce((a, e) => e[1] > a[1] ? e : a);
    }
}


//Get All Airports

const airportMap = new Map();

let pirepTicker = 0;
let pirepHours = 0;
const lineMap = new Map();
const routeCounter = new Map();
const craftCounter = new Map();
const countryCounter = new Map();
const typeCounter = new Map();

let schedule = [];

data.pireps.forEach(async pirep =>{
    console.log(pirep)
    if(pirep.status == "a"){
        pirepTicker++;
        pirepHours += parseInt(pirep.flightTime);
        const depPort = pirep.depICAO;
        const arrPort = pirep.arrICAO;
        const aircraft = pirep.vehiclePublic;
        scheduler(depPort);
        scheduler(arrPort)
        if (!(lineMap.has(`${depPort}-${arrPort}`) || lineMap.has(`${arrPort}-${depPort}`))) {
            lineMap.set(`${depPort}-${arrPort}`, [depPort, arrPort, 1]);
        }else{
            const line = lineMap.get(`${depPort}-${arrPort}`) || lineMap.get(`${arrPort}-${depPort}`);
            lineMap.set(`${depPort}-${arrPort}`, [depPort, arrPort, line[2] + 1]);
        }
        if (routeCounter.has(`${depPort}_${arrPort}`)) {
            let route = routeCounter.get(`${depPort}_${arrPort}`);
            route++;
            routeCounter.set(`${depPort}_${arrPort}`, route);
        } else {
            routeCounter.set(`${depPort}_${arrPort}`, 1);
        }

        if (craftCounter.has(aircraft)) {
            let plane = craftCounter.get(aircraft);
            plane++;
            craftCounter.set(aircraft, plane);
        } else {
            craftCounter.set(aircraft, 1);
        }
    }
})

document.getElementById('stat_total_flights').innerHTML = pirepTicker;

document.getElementById('stat_total_hours').innerHTML = (pirepHours / 60).toFixed(2);

let maxRoute = calcHighest(routeCounter);
document.getElementById('stat_common_flight').innerHTML = maxRoute[0].split("_").join(" &#10142; ");

let maxPlane = calcHighest(craftCounter);
document.getElementById('stat_common_plane').innerHTML = maxPlane[0].split("_").join(" &#10142; ");



function scheduler(code){
    schedule.push(code);
}



function retriever(){
    return new Promise((resolve, reject) =>{
        let code = schedule[0];
        if (airportMap.has(code)) {
            resolve();
        }else{
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
        }
    })
    
}
runner();

var airportIcon = L.icon({
    iconUrl: '/public/images/airport.svg',

    iconSize: [40, 40], // size of the icon
    iconAnchor: [20, 20], // point of the icon which will correspond to marker's location
    popupAnchor: [0, -20] // point from which the popup should open relative to the iconAnchor
});


function onFinish(){
    data.pireps.forEach(pirep =>{
        const depPort = airportMap.get(pirep.depICAO);
        const arrPort = airportMap.get(pirep.arrICAO);
        if(depPort && arrPort){
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
    let maxCountry = calcHighest(countryCounter);
    if (maxCountry[0] != "None") {
        document.getElementById('stat_common_country').innerHTML = ['<span class="flag-icon rounded flag-icon-', maxCountry[0].toLowerCase(), '"></span> ', maxCountry[0]].join("")
    } else {
        document.getElementById('stat_common_country').innerHTML = [maxCountry[0]].join("")
    }


    document.getElementById('map').style.height = "50vh";
    document.getElementById('loadingIndicator').classList.add('d-none');
    var map = L.map('map').setView([0, 0], 3);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    airportMap.forEach(airport =>{
        if(typeCounter.has(airport.type)){
            let type = typeCounter.get(airport.type);
            type ++;
            typeCounter.set(airport.type,type)
        }else{
            typeCounter.set(airport.type,1);
        }
        L.marker([airport.latitude, airport.longitude], {
            icon: airportIcon
        }).addTo(map)
            .bindPopup(`<strong>${airport.name}</strong><br>${airport.icaoCode} | ${airport.type}`)
    })
    let maxType = calcHighest(typeCounter);
    document.getElementById('stat_common_type').innerHTML = maxType[0]
    lineMap.forEach(line =>{
        const start = airportMap.get(line[0]);
        const end = airportMap.get(line[1]);
        const geodesic = new L.Geodesic([{ lat: start.latitude, lng: start.longitude }, { lat: end.latitude, lng: end.longitude }]).bindPopup(`${line[0]} &#8660; ${line[1]} (${line[2]})`).addTo(map);
    })
    
}

async function runner() {
    while (schedule.length > 0) {
        await retriever();
        schedule.shift();
        console.log(airportMap);
    }
    onFinish()
}

