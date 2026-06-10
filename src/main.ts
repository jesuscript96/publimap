import { inject } from '@vercel/analytics';
import './style.css';
import mapboxgl from 'mapbox-gl';

// Initialize Vercel Analytics
inject();

// Configure Mapbox token
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || '';

// State Management
let map: mapboxgl.Map;
let billboardsData: any = null;
let selectedLandmark: any = null;
let activeCategoryFilter = 'all';

// Proximity Radius in Kilometers
const PROXIMITY_RADIUS_KM = 2.0;

// SVG paths for specific icons of each landmark
const SVGS = {
  stadium: `<svg class="landmark-marker-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22c5.523 0 10-2.239 10-5V7c0-2.761-4.477-5-10-5S2 4.239 2 7v10c0 2.761 4.477 5 10 5z"/><path d="M22 7c0 2.761-4.477 5-10 5S2 9.761 2 7"/><path d="M2 12c0 2.761 4.477 5 10 5s10-2.239 10-5"/><path d="M12 2v10M6 3.5v9M18 3.5v9M4 5v8M20 5v8"/></svg>`,
  
  zocalo: `<svg class="landmark-marker-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18"/><line x1="12" y1="3" x2="12" y2="21"/><line x1="3" y1="12" x2="21" y2="12"/><circle cx="12" cy="12" r="3"/></svg>`,
  
  chapultepec: `<svg class="landmark-marker-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19V5M12 5a7 7 0 0 0-7 7h14a7 7 0 0 0-7-7zM7 19h10"/></svg>`,
  
  angel: `<svg class="landmark-marker-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 22h20L12 2zM12 6v10M12 22v-3"/></svg>`,
  
  wtc: `<svg class="landmark-marker-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="2" width="12" height="20"/><line x1="10" y1="6" x2="14" y2="6"/><line x1="10" y1="10" x2="14" y2="10"/><line x1="10" y1="14" x2="14" y2="14"/><line x1="10" y1="18" x2="14" y2="18"/></svg>`,
  
  anahuacalli: `<svg class="landmark-marker-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 22h20M4 22l3-9h10l3 9M7 13l2.5-6h5l2.5 6M10 7l1-3h2l1 3"/></svg>`,
  
  roma: `<svg class="landmark-marker-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10H12V2z"/></svg>`,
  
  bucareli: `<svg class="landmark-marker-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  
  garibaldi: `<svg class="landmark-marker-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 15s5-6 10-6 10 6 10 6M6 15c0-4.5 2.7-8 6-8s6 3.5 6 8M12 15v4m-3-1h6"/></svg>`,
  
  mexicana: `<svg class="landmark-marker-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3a6 6 0 0 0-9 9 9 9 0 1 0 18 0 6 6 0 0 0-9-9z"/><path d="M12 12v9"/></svg>`
};

// 10 Landmarks (Cleaned of World Cup references, using standard Google Maps names)
const LANDMARKS = [
  {
    id: 'estadio_azteca',
    name: 'Estadio Azteca',
    coordinates: [-99.1505342, 19.3028608],
    icon: 'stadium'
  },
  {
    id: 'zocalo',
    name: 'Zócalo',
    coordinates: [-99.133208, 19.4326077],
    icon: 'zocalo'
  },
  {
    id: 'chapultepec',
    name: 'Bosque de Chapultepec',
    coordinates: [-99.17750, 19.42140],
    icon: 'chapultepec'
  },
  {
    id: 'angel_independencia',
    name: 'Ángel de la Independencia',
    coordinates: [-99.167683, 19.427021],
    icon: 'angel'
  },
  {
    id: 'wtc_cdmx',
    name: 'World Trade Center Ciudad de México',
    coordinates: [-99.174548, 19.393566],
    icon: 'wtc'
  },
  {
    id: 'anahuacalli',
    name: 'Museo Anahuacalli',
    coordinates: [-99.14410, 19.32280],
    icon: 'anahuacalli'
  },
  {
    id: 'roma_norte',
    name: 'Colonia Roma Norte',
    coordinates: [-99.16270, 19.41720],
    icon: 'roma'
  },
  {
    id: 'bucareli',
    name: 'Calle Bucareli',
    coordinates: [-99.15030, 19.43120],
    icon: 'bucareli'
  },
  {
    id: 'garibaldi',
    name: 'Plaza Garibaldi',
    coordinates: [-99.13940, 19.44070],
    icon: 'garibaldi'
  },
  {
    id: 'la_mexicana',
    name: 'Parque La Mexicana',
    coordinates: [-99.27040, 19.35750],
    icon: 'mexicana'
  }
];

// Helper: Haversine distance in KM
function calculateDistance(coords1: [number, number], coords2: [number, number]): number {
  const [lon1, lat1] = coords1;
  const [lon2, lat2] = coords2;
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const size = 100;

// Generate Canvas-based Pin with Publimex Logo inside for Mapbox
function createBillboardLogoIcon(logoImg: HTMLImageElement): HTMLImageElement {
  const canvas = document.createElement('canvas');
  canvas.width = 44;
  canvas.height = 54;
  const ctx = canvas.getContext('2d');
  
  if (ctx) {
    // 1. Draw Post (miniature black pole)
    ctx.fillStyle = '#000000';
    ctx.fillRect(20, 40, 4, 12);
    
    // 2. Draw Billboard Panel (Square rect) - Solid yellow background with white border
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(2, 2, 40, 38);
    
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, 40, 38);
    
    // 3. Draw the logo inside (aspect ratio 568/402 = 1.41)
    const destW = 34;
    const destH = 34 / 1.41;
    const destX = 5;
    const destY = 4 + (34 - destH) / 2;
    
    ctx.drawImage(logoImg, destX, destY, destW, destH);
  }

  const img = new Image();
  img.src = canvas.toDataURL();
  return img;
}

const pulsingDot = {
  width: size,
  height: size,
  data: new Uint8ClampedArray(size * size * 4),
  context: null as CanvasRenderingContext2D | null,

  onAdd() {
    const canvas = document.createElement('canvas');
    canvas.width = this.width;
    canvas.height = this.height;
    this.context = canvas.getContext('2d');
  },

  render() {
    const duration = 2000; // soft and slow breath (2 seconds)
    const t = (performance.now() % duration) / duration;

    const radius = 5; // very fine inner dot
    const outerRadius = 5 + 10 * t; // expands softly up to 15px
    const ctx = this.context;

    if (!ctx) return false;

    ctx.clearRect(0, 0, this.width, this.height);

    // Draw outer pulsing halo
    ctx.beginPath();
    ctx.arc(this.width / 2, this.height / 2, outerRadius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(0, 230, 118, ${0.35 * (1 - t)})`; // green fading out
    ctx.fill();

    // Draw inner solid dot
    ctx.beginPath();
    ctx.arc(this.width / 2, this.height / 2, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#00c853'; // bright green
    ctx.strokeStyle = '#FFFFFF'; // fine white outline for contrast
    ctx.lineWidth = 1.5;
    ctx.fill();
    ctx.stroke();

    // Update image data
    const imgData = ctx.getImageData(0, 0, this.width, this.height);
    this.data.set(imgData.data);

    // Force map repaint to animate
    map.triggerRepaint();

    return true;
  }
};

// Helper: close sidebar on mobile viewport to reveal map
function closeSidebarOnMobile() {
  if (window.innerWidth < 768) {
    const sidebar = document.getElementById('sidebar');
    const showBtn = document.getElementById('btn-show-sidebar');
    if (sidebar) sidebar.classList.add('hidden');
    if (showBtn) showBtn.classList.remove('hidden');
    setTimeout(() => {
      if (map) map.resize();
    }, 400);
  }
}

// Initialize Map
function initMap() {
  const isMobile = window.innerWidth < 768;
  
  if (!mapboxgl.supported()) {
    console.error('WebGL not supported');
    const appEl = document.getElementById('app');
    if (appEl) {
      appEl.innerHTML = `
        <div style="padding: 40px; text-align: center; color: #FFFFFF; background: #E30613; height: 100vh; height: 100dvh; display: flex; flex-direction: column; justify-content: center; align-items: center; font-family: var(--font-primary), sans-serif; box-sizing: border-box; border: 4px solid #FFFFFF;">
          <h1 style="font-size: 2rem; font-weight: 800; margin-bottom: 20px; text-transform: uppercase;">Navegador no compatible</h1>
          <p style="font-size: 1.1rem; max-width: 600px; line-height: 1.6; margin-bottom: 20px;">
            Lo sentimos, pero tu navegador o dispositivo no soporta <strong>WebGL</strong>, necesario para renderizar el mapa interactivo de Publimex.
          </p>
          <p style="font-size: 0.9rem; opacity: 0.8;">
            Por favor, activa WebGL en la configuración de tu navegador o intenta utilizar una versión actualizada de Safari, Chrome o Firefox.
          </p>
        </div>
      `;
    }
    return;
  }
  
  map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/light-v11', // Switch to light-v11 map style
    center: [-99.16270, 19.41720], // Center on Roma Norte
    zoom: isMobile ? 13.0 : 13.8, // Start closer, focused on the key neighborhoods
    pitch: 0,
    bearing: 0,
    maxZoom: 17,
    minZoom: 8
  });

  // Controls
  map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');

  map.on('load', () => {
    // Adjust map base layers to look elegant, desaturated, and cold grey for high red contrast
    const lightLayers = [
      { id: 'background', prop: 'background-color', val: '#F2F4F7' },
      { id: 'water', prop: 'fill-color', val: '#DCE1E7' },
      { id: 'building', prop: 'fill-color', val: '#EAECEF' },
      { id: 'landuse', prop: 'fill-color', val: '#EFF1F3' },
      { id: 'national-park', prop: 'fill-color', val: '#EFF1F3' }
    ];
    
    lightLayers.forEach(layer => {
      if (map.getLayer(layer.id)) {
        map.setPaintProperty(layer.id, layer.prop as any, layer.val);
      }
    });

    // Highlight neighborhood/barrio labels (Roma, Condesa, Escandón, San Miguel Chapultepec, etc.) in uppercase red
    if (map.getLayer('settlement-subdivision-label')) {
      map.setPaintProperty('settlement-subdivision-label', 'text-color', '#E30613');
      map.setPaintProperty('settlement-subdivision-label', 'text-halo-color', '#FFFFFF');
      map.setPaintProperty('settlement-subdivision-label', 'text-halo-width', 2.5);
      map.setLayoutProperty('settlement-subdivision-label', 'text-transform', 'uppercase');
      map.setLayoutProperty('settlement-subdivision-label', 'text-size', [
        'interpolate', ['linear'], ['zoom'],
        12, 10,
        14, 13,
        16, 16
      ]);
    }

    // Add pulsing dot image
    map.addImage('pulsing-dot', pulsingDot as any);

    // Load custom WebGL Pin Image using Publimex Logo
    const logoImg = new Image();
    logoImg.src = '/logo.png';
    logoImg.onload = () => {
      const pinImage = createBillboardLogoIcon(logoImg);
      pinImage.onload = () => {
        map.addImage('publimex-logo', pinImage);
        
        // Fetch and load GeoJSON after logo is loaded
        fetch('/billboards.geojson')
          .then(res => res.json())
          .then(data => {
            billboardsData = data;
            setupBillboardLayers();
            updateStats();
          })
          .catch(err => console.error('Error loading GeoJSON:', err));
      };
    };
      
    // Load Landmark markers
    setupLandmarkMarkers();
  });
}

// Setup Mapbox Layers for WebGL High Performance
function setupBillboardLayers() {
  if (!map || !billboardsData) return;

  // Add GeoJSON Source
  map.addSource('billboards', {
    type: 'geojson',
    data: billboardsData
  });

  // Proximity area block (flat square region)
  map.addSource('active-landmark-radius', {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: []
    }
  });

  map.addLayer({
    id: 'landmark-radius-glow',
    type: 'circle',
    source: 'active-landmark-radius',
    paint: {
      'circle-radius': 0,
      'circle-radius-transition': { duration: 500 },
      'circle-color': 'rgba(227, 6, 19, 0.05)', // Transparent red area
      'circle-stroke-width': 3,
      'circle-stroke-color': '#E30613', // Corporate red border
      'circle-stroke-opacity': 0.85
    }
  });

  // Connecting lines
  map.addSource('connecting-lines', {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: []
    }
  });

  map.addLayer({
    id: 'glow-lines',
    type: 'line',
    source: 'connecting-lines',
    paint: {
      'line-color': '#E30613', // Red connecting lines
      'line-opacity': 0.85,
      'line-width': 2.5,
      'line-dasharray': [1, 2] // Straight dashed lines in red
    }
  });

  // Publimex Billboards WebGL Symbol Layer (Mini-Billboards!)
  map.addLayer({
    id: 'billboards-layer',
    type: 'symbol',
    source: 'billboards',
    layout: {
      'icon-image': [
        'case',
        ['coalesce', ['get', 'is_top_15'], false],
        'publimex-logo',
        'pulsing-dot'
      ],
      'icon-size': [
        'interpolate', ['linear'], ['zoom'],
        8, [
          'case',
          ['coalesce', ['get', 'is_top_15'], false],
          0.3,
          0.5
        ],
        12, [
          'case',
          ['coalesce', ['get', 'is_top_15'], false],
          0.55,
          0.8
        ],
        16, [
          'case',
          ['coalesce', ['get', 'is_top_15'], false],
          0.85,
          1.2
        ]
      ],
      'icon-allow-overlap': true,
      'icon-ignore-placement': true
    }
  });

  // Highlight layer for selection (Black glow ring on light map)
  map.addLayer({
    id: 'billboards-highlight',
    type: 'circle',
    source: 'billboards',
    filter: ['==', ['get', 'id'], -1],
    paint: {
      'circle-radius': [
        'interpolate', ['linear'], ['zoom'],
        8, 12,
        12, 20,
        16, 28
      ],
      'circle-color': '#000000',
      'circle-opacity': 0.25,
      'circle-stroke-width': 2.5,
      'circle-stroke-color': '#000000',
      'circle-stroke-opacity': 0.95
    }
  });

  // Layer interaction
  map.on('click', 'billboards-layer', (e) => {
    if (e.features && e.features[0]) {
      const feat = e.features[0];
      const props = feat.properties || {};
      highlightBillboard(props.id);
      showBillboardPopup(feat);
      
      // Scroll sidebar card into view if active
      if (selectedLandmark) {
        const cardEl = document.getElementById(`card-${props.id}`);
        if (cardEl) {
          cardEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
          
          // Highlight card
          document.querySelectorAll('.billboard-card').forEach(c => c.classList.remove('highlighted'));
          cardEl.classList.add('highlighted');
        }
      }
    }
  });

  // Hover cursor style
  map.on('mouseenter', 'billboards-layer', () => {
    map.getCanvas().style.cursor = 'pointer';
  });
  map.on('mouseleave', 'billboards-layer', () => {
    map.getCanvas().style.cursor = '';
  });

  applyMapFilters();
}

// Highlight Billboard
function highlightBillboard(id: number) {
  if (map.getLayer('billboards-highlight')) {
    map.setFilter('billboards-highlight', ['==', ['get', 'id'], id]);
  }
}

// Show Billboard Popup (Square corners, red background, white text)
let currentPopup: mapboxgl.Popup | null = null;
function showBillboardPopup(feature: any) {
  if (currentPopup) currentPopup.remove();

  const props = feature.properties || {};
  const coords = feature.geometry.coordinates;

  const popupContent = `
    <div style="font-family: var(--font-primary); color: #FFFFFF; padding: 4px; max-width: 200px;">
      <div style="font-size: 0.65rem; font-weight: 800; text-transform: uppercase; color: #00e676;">
        Disponible
      </div>
      <div style="font-size: 0.85rem; font-weight: 800; margin-top: 2px;">${props.address || ''}</div>
      <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 4px;">Categoría: ${props.category || ''}</div>
      <div style="font-size: 0.7rem; color: var(--text-muted);">Medidas: ${props.size || ''}</div>
    </div>
  `;

  currentPopup = new mapboxgl.Popup({ closeButton: false, offset: 12 })
    .setLngLat(coords)
    .setHTML(popupContent)
    .addTo(map);
}

// Setup Custom HTML Landmark Markers (Square, Large, with specific SVGs & Text labels below!)
function setupLandmarkMarkers() {
  LANDMARKS.forEach(landmark => {
    // 1. Outer Container
    const container = document.createElement('div');
    container.className = 'landmark-marker-container';
    container.id = `container-${landmark.id}`;
    
    // 2. Icon Square Box
    const iconEl = document.createElement('div');
    iconEl.className = 'landmark-marker';
    iconEl.id = `marker-${landmark.id}`;
    
    // Load custom generated red-and-white illustration
    iconEl.style.backgroundImage = `url('/images/${landmark.id}.png')`;
    
    const svgContent = SVGS[landmark.icon as keyof typeof SVGS] || SVGS.stadium;
    iconEl.innerHTML = svgContent;
    
    // 3. Text Label (Permanently visible!)
    const labelEl = document.createElement('div');
    labelEl.className = 'landmark-marker-label';
    labelEl.innerText = landmark.name;
    
    // Assemble
    container.appendChild(iconEl);
    container.appendChild(labelEl);

    // Click handler to select landmark
    iconEl.addEventListener('click', (e) => {
      e.stopPropagation();
      selectLandmarkItem(landmark);
    });

    new mapboxgl.Marker({ element: container })
      .setLngLat(landmark.coordinates as [number, number])
      .addTo(map);
  });
}

// Select a Landmark
function selectLandmarkItem(landmark: any) {
  selectedLandmark = landmark;
  
  // Update map state
  const isMobile = window.innerWidth < 768;
  map.flyTo({
    center: landmark.coordinates as [number, number],
    zoom: isMobile ? 13.5 : 14.2,
    pitch: 50,
    bearing: -15,
    duration: 1800,
    essential: true
  });

  // Reset highlighted billboard
  highlightBillboard(-1);
  if (currentPopup) currentPopup.remove();

  // Draw Proximity Circle
  drawProximityCircle(landmark.coordinates);

  // Filter Nearby Billboards
  const nearbyBillboards = filterNearbyBillboards(landmark.coordinates);
  
  // Draw connecting lines
  drawConnectingLines(landmark.coordinates, nearbyBillboards);

  // Update UI Sidebar
  updateActiveSidebarView(landmark, nearbyBillboards);
  
  // Show sidebar (desktop) or hide on mobile to reveal the map
  const sidebar = document.getElementById('sidebar');
  const showBtn = document.getElementById('btn-show-sidebar');
  if (window.innerWidth < 768) {
    if (sidebar) sidebar.classList.add('hidden');
    if (showBtn) showBtn.classList.remove('hidden');
    setTimeout(() => {
      if (map) map.resize();
    }, 400);
  } else {
    if (sidebar) sidebar.classList.remove('hidden');
    if (showBtn) showBtn.classList.add('hidden');
  }

  // Show reset button
  const resetBtn = document.getElementById('btn-reset-view');
  if (resetBtn) resetBtn.classList.remove('hidden');
}

// Draw a circle of 2km
function drawProximityCircle(center: number[]) {
  const source = map.getSource('active-landmark-radius') as mapboxgl.GeoJSONSource;
  if (!source) return;

  source.setData({
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: center
        },
        properties: {}
      }
    ]
  });

  map.setPaintProperty('landmark-radius-glow', 'circle-pitch-alignment', 'map');
  
  const metersToPixels = (meters: number, latitude: number, zoom: number) => {
    const earthCircumference = 40075017;
    const latitudeRadians = latitude * Math.PI / 180;
    const metersPerPixel = earthCircumference * Math.cos(latitudeRadians) / Math.pow(2, zoom + 8);
    return meters / metersPerPixel;
  };

  const updateRadius = () => {
    const zoom = map.getZoom();
    const radiusInPixels = metersToPixels(PROXIMITY_RADIUS_KM * 1000, center[1], zoom);
    map.setPaintProperty('landmark-radius-glow', 'circle-radius', radiusInPixels);
  };

  updateRadius();
  map.on('zoom', updateRadius);
}

// Draw straight dashed lines
function drawConnectingLines(center: number[], billboards: any[]) {
  const source = map.getSource('connecting-lines') as mapboxgl.GeoJSONSource;
  if (!source) return;

  const lines = billboards.map(b => ({
    type: 'Feature' as const,
    geometry: {
      type: 'LineString' as const,
      coordinates: [center, b.geometry.coordinates]
    },
    properties: {}
  }));

  source.setData({
    type: 'FeatureCollection' as const,
    features: lines
  } as any);
}

// Filter Billboards within range
function filterNearbyBillboards(center: number[]): any[] {
  if (!billboardsData) return [];
  
  return billboardsData.features.filter((feat: any) => {
    const dist = calculateDistance(center as [number, number], feat.geometry.coordinates as [number, number]);
    feat.properties.distance = dist.toFixed(2);
    return dist <= PROXIMITY_RADIUS_KM;
  });
}

// Apply Filters on Map Layer
function applyMapFilters() {
  if (!map || !map.getLayer('billboards-layer')) return;

  const filters: any[] = ['all'];

  // Category Filter
  if (activeCategoryFilter === 'top-15') {
    filters.push(['coalesce', ['get', 'is_top_15'], false]);
  } else if (activeCategoryFilter !== 'all') {
    filters.push(['in', activeCategoryFilter, ['get', 'category']]);
  }

  // Proximity Filter
  if (selectedLandmark) {
    const center = selectedLandmark.coordinates;
    const nearbyIds = billboardsData.features
      .filter((feat: any) => {
        const dist = calculateDistance(center as [number, number], feat.geometry.coordinates as [number, number]);
        return dist <= PROXIMITY_RADIUS_KM;
      })
      .map((feat: any) => feat.properties.id);

    filters.push(['in', ['get', 'id'], ['literal', nearbyIds]]);
  }

  // Apply filter expression
  if (filters.length > 1) {
    map.setFilter('billboards-layer', filters);
  } else {
    map.setFilter('billboards-layer', null);
  }
  
  // Re-draw connection lines and sidebar if landmark is active
  if (selectedLandmark) {
    const nearby = filterNearbyBillboards(selectedLandmark.coordinates);
    
    const filteredNearby = nearby.filter(feat => {
      const matchCat = activeCategoryFilter === 'all' || 
                       (activeCategoryFilter === 'top-15' && feat.properties.is_top_15) ||
                       (activeCategoryFilter !== 'top-15' && feat.properties.category.includes(activeCategoryFilter));
      const matchAvail = true;
      return matchCat && matchAvail;
    });

    drawConnectingLines(selectedLandmark.coordinates, filteredNearby);
    updateActiveSidebarView(selectedLandmark, filteredNearby);
  }
}

// UI Sidebar Rendering: Default Welcome
function renderDefaultSidebar() {
  const container = document.getElementById('landmarks-container');
  if (!container) return;

  container.innerHTML = LANDMARKS.map(landmark => `
    <div class="landmark-card" data-id="${landmark.id}">
      <div class="landmark-card-info">
        <span class="landmark-card-title">${landmark.name}</span>
      </div>
      <div class="landmark-arrow">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
      </div>
    </div>
  `).join('');

  // Add click listeners to cards
  document.querySelectorAll('.landmark-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.getAttribute('data-id');
      const landmark = LANDMARKS.find(l => l.id === id);
      if (landmark) selectLandmarkItem(landmark);
    });
  });
}

// UI Sidebar Rendering: Active Selected Landmark View
function updateActiveSidebarView(landmark: any, nearbyBillboards: any[]) {
  // Toggle Views
  document.getElementById('sidebar-default-view')?.classList.remove('active');
  document.getElementById('sidebar-active-view')?.classList.add('active');

  // Fill Details
  const nameEl = document.getElementById('active-landmark-name');
  const countEl = document.getElementById('active-nearby-count');
  
  if (nameEl) nameEl.innerText = landmark.name;
  if (countEl) countEl.innerText = nearbyBillboards.length.toString();

  // Populate Carousel Cards
  const carousel = document.getElementById('active-billboards-carousel');
  if (!carousel) return;

  if (nearbyBillboards.length === 0) {
    carousel.innerHTML = `
      <div style="width: 100%; padding: 40px 20px; text-align: center; color: var(--text-muted);">
        <p style="font-size: 0.9rem; font-weight: 700;">No hay espacios de Publimex disponibles que coincidan con los filtros en este radio.</p>
      </div>
    `;
    return;
  }

  carousel.innerHTML = nearbyBillboards.map(b => {
    const props = b.properties || {};
    const isAvailable = true;
    const catClass = props.category.toLowerCase().includes('digital') ? 'pantalla' : 'muro';
    const distText = props.distance ? `${props.distance} km de distancia` : '';

    return `
      <div class="billboard-card" id="card-${props.id}">
        <div class="card-details">
          <div class="card-badge-row">
            <div class="card-badge ${catClass}">${props.category}</div>
            <div class="availability-tag ${isAvailable ? '' : 'reserved'}">
              ${isAvailable ? 'Disponible' : 'Reservado'}
            </div>
          </div>
          
          <div class="card-address-block">
            <h3 class="card-address">${props.address}</h3>
            <p style="font-size: 0.7rem; color: #FFFFFF; font-weight: 700;">${distText}</p>
          </div>
          <p class="card-ref">${props.reference || 'Excelente visibilidad en vialidad de alto flujo.'}</p>
          
          <div class="card-spec-grid">
            <div class="spec-item">
              <span class="spec-label">Dimensiones</span>
              <span class="spec-val">${props.size || '12.00 x 8.00 M'}</span>
            </div>
            <div class="spec-item">
              <span class="spec-label">Formato</span>
              <span class="spec-val">${props.category.split(' + ')[0]}</span>
            </div>
          </div>
          
          <div class="card-actions">
            <button class="btn-locate" data-id="${props.id}">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5">
                <rect x="3" y="3" width="18" height="18" rx="0" ry="0"></rect>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
              Ubicar en Mapa
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Locate buttons listeners
  carousel.querySelectorAll('.btn-locate').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = parseInt(btn.getAttribute('data-id') || '0');
      const feat = billboardsData.features.find((f: any) => f.properties.id === id);
      if (feat) {
        map.flyTo({
          center: feat.geometry.coordinates as [number, number],
          zoom: 15.5,
          pitch: 45,
          duration: 1000
        });
        highlightBillboard(id);
        showBillboardPopup(feat);
        closeSidebarOnMobile();
        
        carousel.querySelectorAll('.billboard-card').forEach(c => c.classList.remove('highlighted'));
        document.getElementById(`card-${id}`)?.classList.add('highlighted');
      }
    });
  });
}

// Reset view to Full Map
function resetView() {
  selectedLandmark = null;
  highlightBillboard(-1);
  if (currentPopup) currentPopup.remove();

  const radiusSource = map.getSource('active-landmark-radius') as mapboxgl.GeoJSONSource;
  if (radiusSource) {
    radiusSource.setData({ type: 'FeatureCollection', features: [] });
  }

  const linesSource = map.getSource('connecting-lines') as mapboxgl.GeoJSONSource;
  if (linesSource) {
    linesSource.setData({ type: 'FeatureCollection', features: [] });
  }

  const isMobile = window.innerWidth < 768;
  map.flyTo({
    center: [-99.16270, 19.41720], // Reset back to Roma Norte
    zoom: isMobile ? 13.0 : 13.8,
    pitch: 0,
    bearing: 0,
    duration: 1500
  });

  // Reset UI View
  document.getElementById('sidebar-active-view')?.classList.remove('active');
  document.getElementById('sidebar-default-view')?.classList.add('active');

  // Hide reset button
  document.getElementById('btn-reset-view')?.classList.add('hidden');

  // Re-apply filters
  applyMapFilters();

  // Hide sidebar on mobile on reset, show on desktop
  const sidebar = document.getElementById('sidebar');
  const showBtn = document.getElementById('btn-show-sidebar');
  if (window.innerWidth < 768) {
    if (sidebar) sidebar.classList.add('hidden');
    if (showBtn) showBtn.classList.remove('hidden');
  } else {
    if (sidebar) sidebar.classList.remove('hidden');
    if (showBtn) showBtn.classList.add('hidden');
  }
  setTimeout(() => {
    if (map) map.resize();
  }, 400);
}

// Update Global Stats
function updateStats() {
  if (!billboardsData) return;
  
  const totalEl = document.getElementById('total-billboards-count');
  const availEl = document.getElementById('available-billboards-count');
  
  if (totalEl) totalEl.innerText = "+100";
  if (availEl) availEl.innerText = "+100";
}

// Setup Event Listeners
function setupEvents() {
  // Back button
  document.getElementById('active-back-btn')?.addEventListener('click', resetView);
  
  // Reset view button
  document.getElementById('btn-reset-view')?.addEventListener('click', resetView);

  // Category buttons filtering (Sync with format cards)
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeCategoryFilter = btn.getAttribute('data-category') || 'all';
      
      // Update formats cards active styles
      document.querySelectorAll('.format-card').forEach(c => c.classList.remove('active'));
      if (activeCategoryFilter !== 'all' && activeCategoryFilter !== 'top-15') {
        const matchingCard = document.querySelector(`.format-card[data-format="${activeCategoryFilter}"]`);
        matchingCard?.classList.add('active');
      }
      
      applyMapFilters();
      closeSidebarOnMobile();
    });
  });

  // Premium Selection Banner (CTA) click
  const top15Cta = document.getElementById('top-15-cta');
  if (top15Cta) {
    top15Cta.addEventListener('click', (e) => {
      e.stopPropagation();
      activeCategoryFilter = 'top-15';
      
      // Update active filter buttons
      document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-category') === 'top-15') {
          btn.classList.add('active');
        }
      });
      
      // Reset format cards
      document.querySelectorAll('.format-card').forEach(c => c.classList.remove('active'));
      
      applyMapFilters();
      closeSidebarOnMobile();
    });
  }



  // Interactive Format Showcase Cards in Default View
  document.querySelectorAll('.format-card').forEach(card => {
    card.addEventListener('click', () => {
      const format = card.getAttribute('data-format') || 'all';
      
      // Toggle category filter
      if (activeCategoryFilter === format) {
        activeCategoryFilter = 'all';
        card.classList.remove('active');
      } else {
        activeCategoryFilter = format;
        document.querySelectorAll('.format-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
      }

      // Sync with filter buttons
      document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-category') === activeCategoryFilter) {
          btn.classList.add('active');
        }
      });

      applyMapFilters();
      closeSidebarOnMobile();
    });
  });

  // Toggle Hide/Show Sidebar
  const sidebar = document.getElementById('sidebar');
  const hideBtn = document.getElementById('btn-hide-sidebar');
  const showBtn = document.getElementById('btn-show-sidebar');

  if (hideBtn && showBtn && sidebar) {
    // Hide Action
    hideBtn.addEventListener('click', () => {
      sidebar.classList.add('hidden');
      showBtn.classList.remove('hidden');
      setTimeout(() => {
        if (map) map.resize(); // Recalculate dimensions for map container
      }, 400);
    });

    // Show Action
    showBtn.addEventListener('click', () => {
      sidebar.classList.remove('hidden');
      showBtn.classList.add('hidden');
      setTimeout(() => {
        if (map) map.resize();
      }, 400);
    });
  }
}

// Run App
document.addEventListener('DOMContentLoaded', () => {
  initMap();
  setupEvents();
  renderDefaultSidebar();

  // Hide sidebar by default on mobile on load
  if (window.innerWidth < 768) {
    const sidebar = document.getElementById('sidebar');
    const showBtn = document.getElementById('btn-show-sidebar');
    if (sidebar) sidebar.classList.add('hidden');
    if (showBtn) showBtn.classList.remove('hidden');
  }

  // CTA button scroll and focus behavior
  const ctaContactBtn = document.getElementById('cta-contact');
  const ctaInfoBtn = document.getElementById('cta-info');
  const contactSection = document.querySelector('.sidebar-contact-section');
  
  const scrollToForm = () => {
    if (contactSection) {
      contactSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Focus on Nombre input
      setTimeout(() => {
        (document.getElementById('form-nombre') as HTMLInputElement | null)?.focus();
      }, 500);
    }
  };

  if (ctaContactBtn) ctaContactBtn.addEventListener('click', scrollToForm);
  if (ctaInfoBtn) ctaInfoBtn.addEventListener('click', scrollToForm);

  // Form submission handling (within the same window)
  const form = document.getElementById('contact-form') as HTMLFormElement | null;
  const successMsg = document.getElementById('contact-success');
  const resetFormBtn = document.getElementById('btn-reset-form');

  if (form && successMsg) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const nombre = (document.getElementById('form-nombre') as HTMLInputElement).value;
      const empresa = (document.getElementById('form-empresa') as HTMLInputElement).value;
      const correo = (document.getElementById('form-correo') as HTMLInputElement).value;
      const comentario = (document.getElementById('form-comentario') as HTMLTextAreaElement).value;

      console.log('Contacto Recibido:', { nombre, empresa, correo, comentario });

      // Hide the form and show the success message in the same container
      form.classList.add('hidden');
      successMsg.classList.remove('hidden');
    });
  }

  if (resetFormBtn && form && successMsg) {
    resetFormBtn.addEventListener('click', () => {
      form.reset();
      form.classList.remove('hidden');
      successMsg.classList.add('hidden');
    });
  }
});
