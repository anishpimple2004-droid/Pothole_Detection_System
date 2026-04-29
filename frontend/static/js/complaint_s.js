// Global variables
let currentComplaintId = null;
let complaintData = {};
let contractors = [];
let modalMap;
let modalMarker;

// Initialize dashboard when the DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    loadDashboardData();
    setupEventListeners();
});

// Fetch dashboard data
function loadDashboardData() {
    fetch('/api/admin/dashboard_data')
        .then(response => response.json())
        .then(complaints => {
            complaintData = complaints.reduce((obj, item) => {
                obj[item.id] = item;
                return obj;
            }, {});

            populateMapPoints(complaints);
            populateComplaints(complaints);
        })
        .catch(error => {
            console.error('Error fetching complaints:', error);
        });
}

function populateMapPoints(complaints) {
    const mapContainer = document.querySelector('.map-dots');
    mapContainer.innerHTML = '';

    complaints.forEach((complaint, index) => {
        const dotClass = getStatusDotClass(complaint.status);
        const dot = document.createElement('div');
        dot.className = `dot ${dotClass}`;

        const top = 20 + (index * 15) % 60;
        const left = 15 + (index * 20) % 70;

        dot.style.top = `${top}%`;
        dot.style.left = `${left}%`;
        dot.setAttribute('title', `Complaint ${complaint.id.substring(0, 6)} - ${complaint.location}`);
        mapContainer.appendChild(dot);
    });

    document.querySelector('.map-subtext').textContent = `Map shows ${complaints.length} potholes in your assigned area`;
}

function getStatusDotClass(status) {
    switch(status) {
        case 'completed': return 'green';
        case 'in progress': return 'blue';
        default: return 'red';
    }
}

function populateComplaints(complaints) {
    // Only show active complaints (not completed ones)
    const activeComplaints = complaints.filter(c => c.status !== 'completed');
    const complaintsGrid = document.getElementById('complaints-grid');
    complaintsGrid.innerHTML = '';

    if (activeComplaints.length === 0) {
        complaintsGrid.innerHTML = '<p class="no-complaints">No active complaints to manage.</p>';
    } else {
        activeComplaints.forEach(complaint => {
            complaintsGrid.appendChild(createComplaintCard(complaint));
        });
    }
}

function createComplaintCard(complaint) {
    const card = document.createElement('div');
    card.className = 'complaint-card';

    let severityClass = complaint.severity === 'high' ? 'high' : complaint.severity === 'low' ? 'low' : 'medium';
    let statusTag = complaint.status === 'in progress' ? 'progress' : complaint.status;

    card.innerHTML = `
        <div class="complaint-image">
            <div class="severity-tag ${severityClass}">${complaint.severity || 'Medium'}</div>
            <img src="${complaint.image_url || '../static/images/placeholder.jpg'}" alt="Pothole image">
        </div>
        <div class="complaint-info">
            <h3>Complaint ${complaint.id.substring(0, 6)}</h3>
            <div class="location">
                <span>${complaint.location}</span>
            </div>
            <p class="description">${complaint.description}</p>
            <div class="status-tag ${statusTag}">${complaint.status}</div>
            <button class="btn btn-secondary view-details" data-id="${complaint.id}">View Details</button>
        </div>`;

    card.querySelector('.view-details').addEventListener('click', () => openComplaintModal(complaint.id));
    return card;
}

function openComplaintModal(complaintId) {
    const complaint = complaintData[complaintId];
    if (!complaint) return;

    document.getElementById('modal-title').textContent = `Complaint Details - ${complaintId.substring(0, 6)}`;
    document.getElementById('modal-image').src = complaint.image_url || '../static/images/placeholder.jpg';
    document.getElementById('modal-date-reported').textContent = complaint.date_reported;
    document.getElementById('modal-location').textContent = complaint.location;
    document.getElementById('modal-severity').textContent = complaint.severity || 'Medium';
    document.getElementById('modal-severity').className = `severity-text ${complaint.severity || 'medium'}`;
    document.getElementById('modal-description').textContent = complaint.description;
    document.getElementById('modal-reporter').textContent = complaint.reported_by || 'N/A';

    document.getElementById('modal-status').textContent = complaint.status;
    document.getElementById('modal-status').className = `modal-status ${complaint.status}`;

    // Load modal map from /api/admin/map_data
    fetch('/api/admin/map_data')
    .then(response => response.json())
    .then(complaints => {
        const targetComplaint = complaints.find(c => c.id === complaintId);

        if (!targetComplaint || !targetComplaint.latitude || !targetComplaint.longitude) {
            console.warn('Complaint location not available');
            document.getElementById("modal-map").innerHTML = "<p style='text-align:center; padding:20px;'>Location data unavailable</p>";
            return;
        }

        const mapCenter = {
            lat: parseFloat(targetComplaint.latitude),
            lng: parseFloat(targetComplaint.longitude)
        };

        modalMap = new google.maps.Map(document.getElementById('modal-map'), {
            center: mapCenter,
            zoom: 16,
            mapTypeId: google.maps.MapTypeId.ROADMAP,
            fullscreenControl: false,
            streetViewControl: false,
            mapTypeControl: false
        });

        modalMarker = new google.maps.Marker({
            position: mapCenter,
            map: modalMap,
            title: `Complaint ${complaintId.substring(0, 6)}`
        });
    })
    .catch(error => {
        console.error('Error loading map data for modal:', error);
    });



    const contractorContainer = document.getElementById('contractor-container');
    contractorContainer.style.display = (complaint.assigned_to && ['assigned', 'in progress'].includes(complaint.status)) ? 'flex' : 'none';
    document.getElementById('modal-contractor').textContent = complaint.assigned_to || 'N/A';

    const fixedDateContainer = document.getElementById('fixed-date-container');
    fixedDateContainer.style.display = complaint.date_fixed ? 'flex' : 'none';
    document.getElementById('modal-date-fixed').textContent = complaint.date_fixed || '';

    const ratingContainer = document.getElementById('rating-container');
    if (complaint.status === 'completed' && complaint.rating) {
        ratingContainer.style.display = 'block';
        const stars = ratingContainer.querySelectorAll('.star');
        stars.forEach((s, i) => s.classList.toggle('active', i < complaint.rating));
        document.getElementById('modal-review').textContent = complaint.review || 'No review provided.';
    } else {
        ratingContainer.style.display = 'none';
    }

    document.getElementById('complaint-modal').classList.add('active');
    document.querySelector('.overlay').classList.add('active');
    currentComplaintId = complaintId;
}

function setupEventListeners() {
    document.querySelectorAll('.close-modal').forEach(btn => btn.addEventListener('click', closeModal));
    document.querySelector('.overlay').addEventListener('click', closeModal);
}

function closeModal() {
    document.querySelectorAll('.modal').forEach(modal => modal.classList.remove('active'));
    document.querySelector('.overlay').classList.remove('active');
}