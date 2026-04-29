// Google Maps integration for Pothole Detection System
let map;
let markers = [];
let complaintData = {}; // Reference to the global complaintData object

// Initialize Google Maps when the DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    if (typeof google === 'undefined') {
        loadGoogleMapsScript();
    } else {
        initMap();
    }

    // New: Load different data based on user role
    const isAdminDashboard = document.body.classList.contains('admin-dashboard');
    const isContractorDashboard = document.body.classList.contains('contractor-dashboard');

    if (isAdminDashboard) {
        window.loadDashboardData = function() {
            loadAdminMapData();
        };
    } else if (isContractorDashboard) {
        const contractorEmail = sessionStorage.getItem('contractorEmail');
        if (contractorEmail) {
            window.loadDashboardData = function() {
                loadMapData(contractorEmail);
            };
        }
    }
});


// Load Google Maps API script
// Load Google Maps API script
function loadGoogleMapsScript() {
    const script = document.createElement('script');
    script.src = "https://maps.googleapis.com/maps/api/js?key=AIzaSyC7siNY75HjFx4O4BPev1zSRTg-0ZvG-zo&callback=initMap";
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
}


function initMap() {
    console.log("Google Map loaded successfully ✅");

    const defaultCenter = { lat: 19.0760, lng: 72.8777 }; // Center on Mumbai!

    map = new google.maps.Map(document.getElementById('google-map'), {
        center: defaultCenter,
        zoom: 12,
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        fullscreenControl: false,
        streetViewControl: false,
        mapTypeControl: false
    });

    // Detect which dashboard
    const isAdminDashboard = document.body.classList.contains('admin-dashboard');
    const isContractorDashboard = document.body.classList.contains('contractor-dashboard');

    if (isAdminDashboard) {
        loadAdminMapData();   // 🛑 Add this line for admin
    } else if (isContractorDashboard) {
        const contractorEmail = sessionStorage.getItem('contractorEmail');
        if (contractorEmail) {
            loadMapData(contractorEmail);   // Already there for contractor
        }
    }
}


// Load pothole data from API
function loadMapData(email) {
    fetch(`/api/contractor/dashboard_data?email=${email}`)
        .then(response => response.json())
        .then(complaints => {
            if (!Array.isArray(complaints)) {
                console.error('Expected an array, but got:', complaints);
                return;
            }
            
            // Store data in global complaintData object if not already populated
            if (Object.keys(complaintData).length === 0) {
                complaintData = complaints.reduce((obj, item) => {
                    obj[item.id] = item;
                    return obj;
                }, {});
            }
            
            // Clear existing markers
            clearMarkers();
            
            // Collect valid coordinates to determine default map center
            const validComplaints = complaints.filter(complaint => 
                complaint.latitude && complaint.longitude);
            
            // Create markers for each complaint with coordinates
            let validMarkerCount = 0;
            complaints.forEach(complaint => {
                if (addMarker(complaint)) {
                    validMarkerCount++;
                }
            });
            
            // Update the map view
            if (validMarkerCount > 0) {
                fitMapToMarkers();
                
                // Update map subtext
                document.querySelector('.map-subtext').textContent = 
                    `Map shows ${validMarkerCount} potholes in your assigned area`;
                
                // Hide the placeholder text as we have a working map
                const mapCenter = document.querySelector('.map-center');
                if (mapCenter) {
                    mapCenter.style.display = 'none';
                }
            } else if (complaints.length > 0) {
                // We have complaints but no valid coordinates
                document.querySelector('.map-subtext').textContent = 
                    `${complaints.length} potholes assigned (coordinates not available)`;
            }
        })
        .catch(error => {
            console.error('Error loading map data:', error);
        });
}

// Add a marker for a pothole complaint
// Returns true if marker was added successfully
function addMarker(complaint) {
    if (!complaint.latitude || !complaint.longitude) {
        console.warn('Missing coordinates for complaint:', complaint.id);
        return false;
    }

    const position = {
        lat: parseFloat(complaint.latitude),
        lng: parseFloat(complaint.longitude)
    };

    if (isNaN(position.lat) || isNaN(position.lng) ||
        Math.abs(position.lat) > 90 || Math.abs(position.lng) > 180) {
        console.warn('Invalid coordinates for complaint:', complaint.id);
        return false;
    }

    let markerIcon = getMarkerIcon(complaint.status);

    const marker = new google.maps.Marker({
        position: position,
        map: map,
        icon: markerIcon,
        title: `Complaint ${complaint.id.substring(0, 6)}`
    });

    // 🧠 Create an InfoWindow (popup)
    const infoWindow = new google.maps.InfoWindow({
        content: `
            <div style="font-size: 14px;">
                <strong>Location:</strong> ${complaint.location}<br>
                <strong>Severity:</strong> ${complaint.severity}<br>
                <strong>Status:</strong> ${complaint.status}<br>
                <strong>Description:</strong><br>${complaint.description}
            </div>
        `
    });

    // Show InfoWindow when marker is clicked
    marker.addListener('click', () => {
        infoWindow.open(map, marker);
    });

    markers.push(marker);
    return true;
}


// Get marker icon based on complaint status
function getMarkerIcon(status) {
    const baseUrl = "http://maps.google.com/mapfiles/ms/icons/";
    
    switch(status) {
        case 'completed':
            return baseUrl + 'green-dot.png';
        case 'in progress':
            return baseUrl + 'blue-dot.png';
        default:
            return baseUrl + 'red-dot.png';
    }
}

// Clear all markers from the map
function clearMarkers() {
    markers.forEach(marker => marker.setMap(null));
    markers = [];
}

function fitMapToMarkers() {
    if (markers.length === 0) {
        map.setCenter({ lat: 19.0760, lng: 72.8777 });
        map.setZoom(12);
        return;
    }

    const mumbaiCenter = { lat: 19.0760, lng: 72.8777 };
    const bounds = new google.maps.LatLngBounds();

    let mumbaiMarkers = [];

    markers.forEach(marker => {
        const pos = marker.getPosition();
        const distance = haversineDistance(pos.lat(), pos.lng(), mumbaiCenter.lat, mumbaiCenter.lng);
        if (distance <= 100) {  // Only markers within 100 km of Mumbai
            bounds.extend(pos);
            mumbaiMarkers.push(marker);
        }
    });

    if (mumbaiMarkers.length > 0) {
        map.fitBounds(bounds);

        const listener = google.maps.event.addListener(map, 'idle', function() {
            const currentZoom = map.getZoom();
            if (currentZoom > 16) map.setZoom(16);
            if (currentZoom < 12) map.setZoom(12);
            google.maps.event.removeListener(listener);
        });
    } else {
        // No markers near Mumbai, fallback
        map.setCenter(mumbaiCenter);
        map.setZoom(12);
    }
}


// Haversine formula to calculate distance between two points in km
function haversineDistance(lat1, lon1, lat2, lon2) {
    function toRad(x) {
        return x * Math.PI / 180;
    }

    const R = 6371; // Radius of Earth in km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}


// Show modal map when complaint details are viewed
function showModalMap(complaintId) {
    // Get the complaint data
    const complaint = complaintData[complaintId];
    
    if (!complaint || !complaint.latitude || !complaint.longitude) {
        // No valid coordinates, show placeholder
        document.querySelector('.modal-map-placeholder').style.display = 'block';
        document.getElementById('modal-map').style.display = 'none';
        return;
    }
    
    // Hide placeholder, show map
    document.querySelector('.modal-map-placeholder').style.display = 'none';
    document.getElementById('modal-map').style.display = 'block';
    
    const position = {
        lat: parseFloat(complaint.latitude),
        lng: parseFloat(complaint.longitude)
    };
    
    // Create a new map instance for the modal
    const modalMap = new google.maps.Map(document.getElementById('modal-map'), {
        center: position,
        zoom: 16,
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        fullscreenControl: false,
        streetViewControl: false,
        mapTypeControl: false
    });
    
    // Add a marker at the complaint location
    new google.maps.Marker({
        position: position,
        map: modalMap,
        icon: getMarkerIcon(complaint.status)
    });
}

// Add a function to the global scope for the callback
window.initMap = initMap;

// Extend the openComplaintModal function to show the modal map
const originalOpenComplaintModal = window.openComplaintModal;
window.openComplaintModal = function(complaintId) {
    // Call the original function first
    if (typeof originalOpenComplaintModal === 'function') {
        originalOpenComplaintModal(complaintId);
    }
    
    // Then initialize the modal map
    setTimeout(() => {
        showModalMap(complaintId);
    }, 100);
};


// Load all complaints for Admin
function loadAdminMapData() {
    fetch('/api/admin/map_data')
        .then(response => response.json())
        .then(complaints => {
            if (!Array.isArray(complaints)) {
                console.error('Expected array, got:', complaints);
                return;
            }

            // Clear existing markers
            clearMarkers();

            let validMarkerCount = 0;

            // Add markers
            complaints.forEach(complaint => {
                if (addMarker(complaint)) {
                    validMarkerCount++;
                }
            });

            if (validMarkerCount > 0) {
                fitMapToMarkers();
                const mapCenter = document.querySelector('.map-center');
                if (mapCenter) {
                    mapCenter.style.display = 'none';
                }

                // Update subtext
                const subtext = document.querySelector('.map-subtext');
                if (subtext) {
                    subtext.textContent = `Map shows ${validMarkerCount} potholes with valid locations`;
                }
            } else {
                const subtext = document.querySelector('.map-subtext');
                if (subtext) {
                    subtext.textContent = `No valid location data found for complaints`;
                }
            }
        })
        .catch(error => {
            console.error('Error loading admin map data:', error);
            const subtext = document.querySelector('.map-subtext');
            if (subtext) {
                subtext.textContent = `Error loading map data`;
            }
        });
}


document.addEventListener('DOMContentLoaded', function() {
    const refreshButton = document.getElementById('refresh-map-btn');
    if (refreshButton) {
        refreshButton.addEventListener('click', function() {
            console.log("Refreshing map data...");
            loadAdminMapData();  // Call again to reload complaints
        });
    }
});