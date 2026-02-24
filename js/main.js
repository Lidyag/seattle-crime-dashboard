mapboxgl.accessToken = 'pk.eyJ1IjoibGlkeWFnIiwiYSI6ImNta3owcmc4ZjBjdWkzaG9kcHUxNDV4OWYifQ.nt80k6jNOcPMQgRw1Lk8Eg';
const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/dark-v11',
  center: [-122.3321, 47.6062],
  zoom: 11
});

function normalizeName(s) {
  return String(s || '')
    .toUpperCase()
    .trim();
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  const header = lines.shift().split(',');

  const idxName = header.indexOf('Neighborhood');
  const idxCrimes = header.indexOf('Total_crimes');

  const dict = new Map();

  for (const line of lines) {
    if (!line.trim()) continue;

    const parts = line.split(',');
    const name = normalizeName(parts[idxName]);
    const crimes = Number(parts[idxCrimes]) || 0;

    dict.set(name, crimes);
  }

  return dict;
}

map.on('load', async () => {

  const [geojson, csvText] = await Promise.all([
    fetch('data/seattle_neighborhoods.geojson').then(r => r.json()),
    fetch('data/crime_by_neighborhood_matched.csv').then(r => r.text())
  ]);

  const crimeLookup = parseCSV(csvText);
  let totalCrimes = 0;

  crimeLookup.forEach(value => {
      totalCrimes += value;
  });

  document.getElementById('total-number').innerText =
  totalCrimes.toLocaleString();

  const sorted = [...crimeLookup.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 5);

  const labels = sorted.map(d => d[0]);
  const values = sorted.map(d => d[1]);

  c3.generate({
  bindto: '#crime-chart',
  data: {
    columns: [
      ['Crimes', ...values]
    ],
    type: 'bar'
  },
  axis: {
    x: {
      type: 'category',
      categories: labels,
       tick: {
      rotate: 45,
      multiline: false
     }
    }
  },
  color: {
    pattern: ['#cb181d']
  },
  size: {
    height: 300
  }
});



  geojson.features.forEach((f, i) => {

    const rawName =
      f.properties?.L_HOOD ??
      f.properties?.S_HOOD ??
      '';

    const key = normalizeName(rawName);
    const crimes = crimeLookup.get(key) ?? 0;

    f.properties.total_crimes = crimes;
    f.id = i;
  });

  map.addSource('neighborhoods', {
    type: 'geojson',
    data: geojson
  });

  map.addLayer({
    id: 'neighborhood-fill',
    type: 'fill',
    source: 'neighborhoods',
    paint: {
      'fill-color': [
        'interpolate',
        ['linear'],
        ['get', 'total_crimes'],
        0,   '#fee5d9',
        2000,'#fcae91',
        4000,'#fb6a4a',
        8000,'#cb181d'
      ],
      'fill-opacity': [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        0.9,
        0.6
      ]
    }
  });

  map.addLayer({
    id: 'neighborhood-outline',
    type: 'line',
    source: 'neighborhoods',
    paint: {
      'line-color': '#aaaaaa',
      'line-width': 1
    }
  });

  const popup = new mapboxgl.Popup({
    closeButton: false,
    closeOnClick: false
  });

  map.on('mousemove', 'neighborhood-fill', (e) => {

    const f = e.features && e.features[0];
    if (!f) return;

    map.getCanvas().style.cursor = 'pointer';

    const name = f.properties?.L_HOOD ?? 'Unknown';
    const crimes = f.properties?.total_crimes ?? 0;

    popup
      .setLngLat(e.lngLat)
      .setHTML(`<strong>${name}</strong><br/>Total crimes: ${crimes}`)
      .addTo(map);
  });

  map.on('mouseleave', 'neighborhood-fill', () => {
    map.getCanvas().style.cursor = '';
    popup.remove();
  });

});