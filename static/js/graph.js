//this is global graph variables: this sets up the data containers and network instance, and this is why we do it like this so the filter functions can destroy and redraw the map without losing the base objects
var network = null;
var nodesDataset = new vis.DataSet();
var edgesDataset = new vis.DataSet();
var pinnedNodeId = null;

//this is network rendering logic: this fetches graph data from the api and configures the vis.js physics engine, and this is why we do it like this to separate raw data fetching from the complex organic styling rules
function drawGraph(search = '', category = '', type = '') {
    var overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.classList.add('visible');

    var url = `/api/graph?search=${encodeURIComponent(search)}&category=${encodeURIComponent(category)}&type=${encodeURIComponent(type)}`;

    fetch(url)
        .then(res => res.json())
        .then(data => {
            var earthyPalette = [
                {bg: '#8b9d83', border: '#4a5944'}, 
                {bg: '#b59273', border: '#735a44'}, 
                {bg: '#7a8c99', border: '#4b5761'}, 
                {bg: '#c9b47c', border: '#8a7a50'}, 
                {bg: '#a18b96', border: '#63535d'}  
            ];
            var groupColors = {};
            var colorIndex = 0;

            data.nodes.forEach(node => {
                if (!groupColors[node.group]) {
                    groupColors[node.group] = earthyPalette[colorIndex % earthyPalette.length];
                    colorIndex++;
                }
                
                node.color = {
                    background: groupColors[node.group].bg,
                    border: groupColors[node.group].border,
                    highlight: { background: groupColors[node.group].bg, border: '#2c3b32' },
                    hover: { background: groupColors[node.group].bg, border: '#2c3b32' }
                };

                // edge case: copy the html to a custom variable and delete the native title to prevent the ugly browser double-tooltip bug
                node.customHtml = node.title;
                node.title = undefined;
            });

            nodesDataset.clear();
            edgesDataset.clear();
            nodesDataset.add(data.nodes);
            edgesDataset.add(data.edges);

            //this is legend generation: this loops through the mapped group colors and builds html dots, and this is why we do it like this so the visual key perfectly matches our custom earthy node injection
            var legendDiv = document.getElementById('legend');
            if (legendDiv) {
                legendDiv.innerHTML = '';
                for (var group in groupColors) {
                    var item = document.createElement('div');
                    item.className = 'legend-item';
                    item.innerHTML = `<div class="legend-dot" style="background-color: ${groupColors[group].bg}; border: 1px solid ${groupColors[group].border};"></div><span>${group}</span>`;
                    legendDiv.appendChild(item);
                }
            }

            if (network !== null) {
                network.destroy();
                network = null;
            }

            var container = document.getElementById('mynetwork');
            var graphData = { nodes: nodesDataset, edges: edgesDataset };
            
            //this is physics configuration: this defines the rules for how nodes repel and connect, and this is why we do it like this using continuous curves to make the network look like an organic biological root system
            var options = {
                nodes: {
                    shape: 'dot',
                    size: 16,
                    borderWidth: 2,
                    font: { size: 14, color: '#2c3b32', face: 'DM Sans' }
                },
                edges: {
                    width: 1.5,
                    color: { color: '#e2e8e4', highlight: '#3b5e4a', hover: '#3b5e4a' },
                    smooth: { type: 'continuous', roundness: 0.5 },
                    hoverWidth: 2
                },
                physics: {
                    solver: 'forceAtlas2Based',
                    forceAtlas2Based: {
                        gravitationalConstant: -70,
                        centralGravity: 0.01,
                        springLength: 120,
                        springConstant: 0.08,
                        damping: 0.4
                    },
                    stabilization: { iterations: 150 }
                },
                interaction: {
                    hover: true,
                    tooltipDelay: 200,
                    zoomView: true
                }
            };

            network = new vis.Network(container, graphData, options);

            network.on("stabilizationIterationsDone", function () {
                if (overlay) overlay.classList.remove('visible');
            });

            //this is custom tooltip interaction: this handles custom html tooltip positioning and content injection using our new customhtml variable
            var tooltip = document.getElementById('customTooltip');
            
            network.on("hoverNode", function (params) {
                if (pinnedNodeId) return;
                var nodeId = params.node;
                var nodePosition = network.canvasToDOM(network.getPositions([nodeId])[nodeId]);
                var nodeData = nodesDataset.get(nodeId);
                
                if (nodeData.customHtml) {
                    tooltip.innerHTML = nodeData.customHtml;
                    tooltip.style.display = 'block';
                    tooltip.style.left = (nodePosition.x + 15) + 'px';
                    tooltip.style.top = (nodePosition.y + 15) + 'px';
                }
            });

            network.on("blurNode", function (params) {
                if (!pinnedNodeId) {
                    tooltip.style.display = 'none';
                }
            });

            //this is tooltip pinning logic: this locks the popup open on double click using our new customhtml variable
            network.on("doubleClick", function (params) {
                if (params.nodes.length > 0) {
                    var nodeId = params.nodes[0];
                    if (pinnedNodeId === nodeId) {
                        pinnedNodeId = null;
                        tooltip.style.display = 'none';
                    } else {
                        pinnedNodeId = nodeId;
                        var nodePosition = network.canvasToDOM(network.getPositions([nodeId])[nodeId]);
                        var nodeData = nodesDataset.get(nodeId);
                        
                        if (nodeData.customHtml) {
                            tooltip.innerHTML = nodeData.customHtml;
                            tooltip.style.display = 'block';
                            tooltip.style.left = (nodePosition.x + 15) + 'px';
                            tooltip.style.top = (nodePosition.y + 15) + 'px';
                        }
                    }
                }
            });

            network.on("click", function (params) {
                if (pinnedNodeId && params.nodes.length === 0) {
                    pinnedNodeId = null;
                    tooltip.style.display = 'none';
                }
            });
            
            network.on("dragStart", function () {
                if (!pinnedNodeId) tooltip.style.display = 'none';
            });
            
            network.on("zoom", function () {
                if (!pinnedNodeId) tooltip.style.display = 'none';
            });

        })
        .catch(err => {
            console.error("graph fetch error:", err);
            if (overlay) overlay.classList.remove('visible');
        });
}

//this is filter execution: this binds frontend inputs to the graph redraw function, and this is why we do it like this so the map reacts instantly to user searches
function applyFilters() {
    var search = document.getElementById('searchInput') ? document.getElementById('searchInput').value : '';
    var category = document.getElementById('categorySelect') ? document.getElementById('categorySelect').value : '';
    var type = document.getElementById('typeSelect') ? document.getElementById('typeSelect').value : '';
    drawGraph(search, category, type);
}

//this is ui initialization: this populates the dropdowns and binds event listeners when the dom loads, and this is why we do it like this to prepare the environment before drawing the initial graph
document.addEventListener('DOMContentLoaded', function() {
    fetch('/api/filters')
        .then(res => res.json())
        .then(data => {
            var catSelect = document.getElementById('categorySelect');
            var typeSelect = document.getElementById('typeSelect');
            
            if (catSelect && data.categories) {
                data.categories.forEach(c => {
                    var opt = document.createElement('option');
                    opt.value = c; opt.textContent = c;
                    catSelect.appendChild(opt);
                });
            }
            
            if (typeSelect && data.types) {
                data.types.forEach(t => {
                    var opt = document.createElement('option');
                    opt.value = t; opt.textContent = t;
                    typeSelect.appendChild(opt);
                });
            }
        })
        .catch(err => console.error("filter fetch error:", err));

    var searchInput = document.getElementById('searchInput');
    var catSelect = document.getElementById('categorySelect');
    var typeSelect = document.getElementById('typeSelect');
    var resetBtn = document.getElementById('resetViewBtn');
    var slider = document.getElementById('spacingSlider');

    if(searchInput) searchInput.addEventListener('input', applyFilters);
    if(catSelect) catSelect.addEventListener('change', applyFilters);
    if(typeSelect) typeSelect.addEventListener('change', applyFilters);
    
    if(resetBtn) {
        resetBtn.addEventListener('click', () => {
            if(searchInput) searchInput.value = '';
            if(catSelect) catSelect.value = '';
            if(typeSelect) typeSelect.value = '';
            if(slider) slider.value = -70; 
            applyFilters();
        });
    }

    if(slider) {
        slider.min = -200;
        slider.max = -10;
        slider.step = 10;
        slider.value = -70;
        slider.addEventListener('input', function() {
            if (network) {
                network.setOptions({
                    physics: {
                        forceAtlas2Based: {
                            gravitationalConstant: parseInt(this.value)
                        }
                    }
                });
            }
        });
    }

    drawGraph();
});