//this is global state management: this creates an empty object to store chart instances globally, and it attaches window methods, and this is why we do it like this so chart.js doesn't overlap multiple graphs if the user clicks countries quickly
var charts = {}; 

//this is country loading: this fetches the clean list of countries from the python metrics api and populates both select boxes, and this is why we do it like this to ensure users can only select regions that actually have data
window.populateCountries = function() {
    const supportedCountries = ["Australia", "Brazil", "Canada", "China", "Denmark", "France", "Germany", "India", "Italy", "Japan", "Mexico", "Norway", "South Africa", "South Korea", "Sweden", "United Kingdom", "United States"];
    
    const select1 = document.getElementById('countrySelect');
    const select2 = document.getElementById('countrySelect2');
    
    if (select1 && select2) {
        let optionsHtml1 = '<option value="" disabled selected>choose a country...</option>';
        let optionsHtml2 = '<option value="" selected>compare with... (optional)</option>';
        
        supportedCountries.forEach(country => {
            optionsHtml1 += `<option value="${country}">${country}</option>`;
            optionsHtml2 += `<option value="${country}">${country}</option>`;
        });
        
        select1.innerHTML = optionsHtml1;
        select2.innerHTML = optionsHtml2;
    }
};

//this is dashboard updating: this grabs specific metrics for one or two countries using promise.all to fetch them simultaneously, and it bundles them into arrays for chart.js, and this is why we do it like this so the ui waits for all data before drawing
window.loadDashboard = function() {
    const country1 = document.getElementById('countrySelect').value;
    const country2 = document.getElementById('countrySelect2').value;

    // edge case: abort immediately if the primary country isn't selected yet
    if (!country1) return;

    let fetches = [fetch(`/api/telemetry?country=${encodeURIComponent(country1)}`).then(res => res.json())];
    
    // edge case: conditionally add the second fetch call only if the user picked a comparison country
    if (country2) {
        fetches.push(fetch(`/api/telemetry?country=${encodeURIComponent(country2)}`).then(res => res.json()));
    }

    Promise.all(fetches)
        .then(results => {
            const data1 = results[0];
            const data2 = results.length > 1 ? results[1] : null;

            let co2Datasets = [{ label: country1, data: data1.metrics.co2, color: '#ea580c' }];
            let renewDatasets = [{ label: country1, data: data1.metrics.renewables, color: '#0d9488' }];
            let aqiDatasets = [{ label: country1, data: data1.metrics.aqi, color: '#6366f1' }];
            
            // edge case: tag events with their origin country and a matching color so the vertical lines make sense on a shared graph
            let allEvents = data1.events.map(e => ({ ...e, country: country1, color: 'rgba(234, 88, 12, 0.6)' }));

            if (data2) {
                co2Datasets.push({ label: country2, data: data2.metrics.co2, color: '#f59e0b' });
                renewDatasets.push({ label: country2, data: data2.metrics.renewables, color: '#10b981' });
                aqiDatasets.push({ label: country2, data: data2.metrics.aqi, color: '#8b5cf6' });
                
                const events2 = data2.events.map(e => ({ ...e, country: country2, color: 'rgba(139, 92, 246, 0.6)' }));
                allEvents = allEvents.concat(events2);
            }

            renderChart('chartCo2', 'Metric Tons per Capita', data1.metrics.years, co2Datasets, allEvents);
            renderChart('chartRenewables', '% of Total Energy', data1.metrics.years, renewDatasets, allEvents);
            renderChart('chartAqi', 'Micrograms per Cubic Meter (µg/m³)', data1.metrics.years, aqiDatasets, allEvents);
        })
        .catch(err => console.error("telemetry api error:", err));
};

//this is chart rendering logic: this iterates through an array of dataset objects to draw multiple overlapping lines, defines explicit axis titles, and maps vertical event lines, and this is why we do it like this to visually correlate complex multinational data
function renderChart(canvasId, yAxisLabel, years, datasetsConfig, events) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    
    // edge case: explicitly destroy old chart before drawing new one to prevent canvas memory leaks
    if (charts[canvasId]) {
        charts[canvasId].destroy();
    }

    const annotations = {};
    events.forEach((evt, index) => {
        if(evt.year >= 2010) {
            annotations[`line${index}`] = {
                type: 'line',
                scaleID: 'x',
                value: evt.year,
                borderColor: evt.color,
                borderWidth: 2,
                borderDash: [5, 5],
                label: {
                    display: true,
                    // edge case: inject the country name into the label so users know which policy belongs to which line
                    content: `[${evt.country}] ` + (evt.title.length > 15 ? evt.title.substring(0, 15) + '...' : evt.title),
                    position: 'start',
                    backgroundColor: evt.color.replace('0.6', '0.8'),
                    color: 'white',
                    font: { size: 10 }
                }
            };
        }
    });

    const chartDatasets = datasetsConfig.map(ds => ({
        label: ds.label,
        data: ds.data,
        borderColor: ds.color,
        backgroundColor: ds.color + '20', 
        // edge case: only fill the area under the curve if there is one country, otherwise overlapping fills look muddy and unreadable
        fill: datasetsConfig.length === 1,
        tension: 0.3,
        pointRadius: 3,
        spanGaps: true 
    }));

    charts[canvasId] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: years,
            datasets: chartDatasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                annotation: { annotations: annotations },
                // edge case: force the legend to display so the user knows which color corresponds to which country
                legend: { display: true, position: 'top' }
            },
            scales: {
                x: { 
                    grid: { display: false },
                    title: { display: true, text: 'Observation Year', color: '#78716c', font: { weight: 'bold' } }
                },
                y: { 
                    beginAtZero: false, 
                    grid: { borderDash: [4, 4] },
                    title: { display: true, text: yAxisLabel, color: '#78716c', font: { weight: 'bold' } }
                }
            }
        }
    });
}

//this is telemetry redirect logic: this catches the onclick event from the network graph tooltips and auto-loads the charts for that country, and this is why we do it like this to perfectly bridge the policy and data views
window.openTelemetry = function(country) {
    if (typeof switchTab === 'function') switchTab('dashboard');
    var select = document.getElementById('countrySelect');
    if (select) {
        select.value = country;
        // edge case: trigger the global dashboard loader function manually since setting value via js skips the html onchange event
        if (typeof window.loadDashboard === 'function') window.loadDashboard();
    }
};

document.addEventListener('DOMContentLoaded', window.populateCountries);