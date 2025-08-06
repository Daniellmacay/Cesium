const viewer = new Cesium.Viewer("cesiumContainer", {
  terrainProvider: new Cesium.EllipsoidTerrainProvider(),
  baseLayerPicker: false
});

viewer.scene.screenSpaceCameraController.enableTilt = false;
viewer.scene.skyBox.show = false;
viewer.scene.skyAtmosphere.show = false;
viewer.scene.backgroundColor = Cesium.Color.BLACK;

// === GEOJSON ===
document.getElementById("geojsonFile").addEventListener("change", function (event) {
  const files = event.target.files;
  if (!files.length) return;

  Array.from(files).forEach(file => {
    const reader = new FileReader();
    reader.onload = function (e) {
      try {
        const geojson = JSON.parse(e.target.result);
        Cesium.GeoJsonDataSource.load(geojson, {
          stroke: Cesium.Color.CYAN,
          fill: Cesium.Color.fromAlpha(Cesium.Color.CYAN, 0.2),
          strokeWidth: 2,
          clampToGround: false
        }).then(dataSource => {
          viewer.dataSources.add(dataSource);
          viewer.zoomTo(dataSource);
        });
      } catch (err) {
        alert("Error al leer GeoJSON: " + file.name + " - " + err);
      }
    };
    reader.readAsText(file);
  });
});

// === VARIABLES GLOBALES ===
let nodes = {};
let nodeData = [];
let edgeData = [];
let colorColumn = null;
let colorMap = {};

// === FUNCIONES ===
function parseCSV(content) {
  const rows = content.trim().split("\n").map(r => r.split(","));
  const headers = rows.shift();
  return rows.map(r => Object.fromEntries(r.map((val, i) => [headers[i], val])));
}

const customColorMap = {
  "0": Cesium.Color.TRANSPARENT,
  "1": Cesium.Color.RED,
  "2": Cesium.Color.BLUE,
  "3": Cesium.Color.YELLOW,
  "4": Cesium.Color.GREEN,
  "5": Cesium.Color.PURPLE
};

function getColorForValue(value) {
  return customColorMap[value] || Cesium.Color.GRAY;
}

function renderNodes(data) {
  viewer.entities.removeAll();
  nodes = {};

  data.forEach(node => {
    const id = node.id;
    const lat = parseFloat(node.lat);
    const lon = parseFloat(node.lon);
    const value = node[colorColumn];
    const color = getColorForValue(value);

    nodes[id] = { lat, lon };

    viewer.entities.add({
      id: id,
      name: id,
      position: Cesium.Cartesian3.fromDegrees(lon, lat),
      point: {
        pixelSize: 10,
        color: color
      },
      properties: {
        id: node.id,
        categoria: node.categoria || ""
      }
    });
  });
  renderEdges();
}

function renderEdges() {
  edgeData.forEach(edge => {
    const from = nodes[edge.source];
    const to = nodes[edge.target];
    if (from && to) {
      viewer.entities.add({
        polyline: {
          positions: Cesium.Cartesian3.fromDegreesArray([
            from.lon, from.lat,
            to.lon, to.lat
          ]),
          width: 2,
          material: Cesium.Color.CYAN
        }
      });
    } else {
      console.warn(`No se encontraron coordenadas para la arista entre ${edge.source} y ${edge.target}.`);
    }
  });
}

// === NODOS ===
document.getElementById("nodesFile").addEventListener("change", function (e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (event) {
    nodeData = parseCSV(event.target.result);
    const select = document.getElementById("colorColumnSelect");

    if (select.options.length === 0 && nodeData.length > 0) {
      const headers = Object.keys(nodeData[0]);
      headers.forEach(h => {
        const option = document.createElement("option");
        option.value = h;
        option.text = h;
        select.appendChild(option);
      });
      colorColumn = headers[0];
      select.value = colorColumn;
    }

    console.log("Nodos cargados y listos para ser renderizados.");
    renderNodes(nodeData);
  };
  reader.readAsText(file);
});

// === ARISTAS ===
document.getElementById("edgesFile").addEventListener("change", function (e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (event) {
    edgeData = parseCSV(event.target.result);
    console.log("Aristas cargadas, esperando que los nodos estén listos para renderizar.");
    if (Object.keys(nodes).length > 0) {
      renderEdges();
    } else {
      console.log("Los nodos aún no se han cargado. Las aristas se dibujarán cuando se carguen los nodos.");
    }
  };
  reader.readAsText(file);
});

// === CAMBIO DE COLUMNA ===
document.getElementById("colorColumnSelect").addEventListener("change", function () {
  colorColumn = this.value;
  if (nodeData.length > 0) {
    renderNodes(nodeData);
  }
});

// === TOOLTIP ===
const tooltip = document.getElementById("tooltip");
viewer.screenSpaceEventHandler.setInputAction(function (movement) {
  const picked = viewer.scene.pick(movement.endPosition);
  if (Cesium.defined(picked) && picked.id && picked.id.properties) {
    const props = picked.id.properties;
    const id = props.id?.getValue() || "(sin id)";
    const categoria = props.categoria?.getValue() || "(sin categoría)";

    tooltip.innerHTML = `<strong>ID:</strong> ${id}<br><strong>Categoría:</strong> ${categoria}`;
    tooltip.style.left = movement.endPosition.x + 10 + "px";
    tooltip.style.top = movement.endPosition.y + 10 + "px";
    tooltip.style.display = "block";
  } else {
    tooltip.style.display = "none";
  }
}, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
