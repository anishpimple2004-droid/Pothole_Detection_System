let modalMap;
let modalMarker;



document.addEventListener('DOMContentLoaded', function() {
    fetch('/api/admin/dashboard_data')
        .then(response => response.json())
        .then(complaints => {
            const fixedComplaints = complaints.filter(c => c.status === 'completed');
            populateFixedComplaints(fixedComplaints);
            setupEventListeners();
        })
        .catch(error => {
            console.error('Error loading fixed complaints:', error);
        });
});

function populateFixedComplaints(complaints) {
    const complaintsGrid = document.getElementById('complaints-grid');
    complaintsGrid.innerHTML = '';

    if (complaints.length === 0) {
        complaintsGrid.innerHTML = '<p class="no-complaints">No fixed complaints to show.</p>';
    } else {
        complaints.forEach(complaint => {
            complaintsGrid.appendChild(createComplaintCard(complaint));
        });
    }
}

function createComplaintCard(complaint) {
    const card = document.createElement('div');
    card.className = 'complaint-card';

    card.innerHTML = `
        <div class="complaint-image">
            <div class="fixed-tag">Fixed</div>
            <img src="${complaint.fixed_image_url || '../static/images/placeholder.jpg'}" alt="Fixed pothole image">
        </div>
        <div class="complaint-info">
            <h3>Complaint ${complaint.id.substring(0, 6)}</h3>
            <div class="location">
                <span>${complaint.location}</span>
            </div>
            <p class="description">${complaint.description}</p>
            <div class="status-tag completed">Completed</div>
            <button class="btn btn-secondary view-details" data-id="${complaint.id}">View Details</button>
        </div>`;

    card.querySelector('.view-details').addEventListener('click', () => openComplaintModal(complaint));
    return card;
}

function openComplaintModal(complaint) {
    document.getElementById('modal-title').textContent = `Complaint Details - ${complaint.id.substring(0, 6)}`;
    document.getElementById('modal-image').src = complaint.fixed_image_url || '../static/images/placeholder.jpg';
    document.getElementById('modal-date-reported').textContent = complaint.date_reported || '-';
    document.getElementById('modal-date-fixed').textContent = complaint.date_fixed || '-';
    document.getElementById('modal-location').textContent = complaint.location || '-';
    document.getElementById('modal-severity').textContent = complaint.severity || '-';
    document.getElementById('modal-reporter').textContent = complaint.reported_by || '-';
    document.getElementById('modal-description').textContent = complaint.description || '-';

    document.getElementById('complaint-modal').classList.add('active');
    document.querySelector('.overlay').classList.add('active');

    // 🚀 NEW: Load modal map separately
    fetch('/api/admin/map_data')
        .then(response => response.json())
        .then(complaints => {
            const targetComplaint = complaints.find(c => c.id === complaint.id);

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
                title: `Complaint ${complaint.id.substring(0, 6)}`
            });
        })
        .catch(error => {
            console.error('Error loading map data for modal:', error);
        });
}


function setupEventListeners() {
    document.querySelectorAll('.close-modal').forEach(btn => btn.addEventListener('click', closeModal));
    document.querySelector('.overlay').addEventListener('click', closeModal);
}

function closeModal() {
    document.querySelectorAll('.modal').forEach(modal => modal.classList.remove('active'));
    document.querySelector('.overlay').classList.remove('active');
}
