// Global variables
let currentComplaintId = null;
let complaintData = {};
let contractors = [];

// Initialize dashboard when the DOM is loaded
document.addEventListener('DOMContentLoaded', function () {
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

            updateStatusCounts(complaints);
            populateMapPoints(complaints);
            populateComplaintCards(complaints);
        })
        .catch(error => {
            console.error('Error fetching complaints:', error);
        });
}

function updateStatusCounts(complaints) {
    const newCount = complaints.filter(c => c.status.toLowerCase() === 'new').length;
    const assignedCount = complaints.filter(c => c.status.toLowerCase() === 'assigned').length;
    const progressCount = complaints.filter(c => c.status.toLowerCase() === 'in progress').length;
    const completedCount = complaints.filter(c => c.status.toLowerCase() === 'completed').length;

    document.getElementById('new-count').textContent = newCount;
    document.getElementById('assigned-count').textContent = assignedCount;
    document.getElementById('progress-count').textContent = progressCount;
    document.getElementById('completed-count').textContent = completedCount;
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
    switch (status.toLowerCase()) {
        case 'completed': return 'green';
        case 'in progress': return 'blue';
        default: return 'red';
    }
}

function populateComplaintCards(complaints) {
    const activeComplaints = complaints.filter(c => c.status.toLowerCase() !== 'completed');
    const fixedComplaints = complaints.filter(c => c.status.toLowerCase() === 'completed');

    const activeContainer = document.getElementById('manage-complaints').querySelector('.complaints-grid');
    const fixedContainer = document.getElementById('fixed-complaints').querySelector('.complaints-grid');

    activeContainer.innerHTML = '';
    fixedContainer.innerHTML = '';

    if (activeComplaints.length === 0) {
        activeContainer.innerHTML = '<p class="no-complaints">No active complaints to manage.</p>';
    } else {
        activeComplaints.forEach(c => activeContainer.appendChild(createComplaintCard(c, false)));
    }

    if (fixedComplaints.length === 0) {
        fixedContainer.innerHTML = '<p class="no-complaints">No fixed complaints yet.</p>';
    } else {
        fixedComplaints.forEach(c => fixedContainer.appendChild(createComplaintCard(c, true)));
    }
}

function createComplaintCard(complaint, isFixed) {
    const card = document.createElement('div');
    card.className = 'complaint-card';

    let severityClass = complaint.severity === 'high' ? 'high' : complaint.severity === 'low' ? 'low' : 'medium';
    let statusTag = complaint.status === 'in progress' ? 'progress' : complaint.status;

    card.innerHTML = isFixed ? `
        <div class="complaint-image">
            <div class="fixed-tag">Fixed</div>
            <img src="${complaint.fixed_image_url || '../static/images/placeholder.jpg'}" alt="Fixed pothole image">
        </div>
        <div class="complaint-info">
            <h3>Complaint ${complaint.id.substring(0, 6)}</h3>
            <div class="location">
                <span>${complaint.location}</span>
            </div>
            <div class="date-info">
                <p>Reported: ${complaint.date_reported}</p>
                <p>Fixed: ${complaint.date_fixed || 'N/A'}</p>
            </div>
            <p class="description">${complaint.description}</p>
            <button class="btn btn-secondary view-details" data-id="${complaint.id}">View Details</button>
        </div>` : `
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

function setupEventListeners() {
    document.querySelectorAll('.close-modal').forEach(btn => btn.addEventListener('click', closeModal));
    document.querySelector('.overlay').addEventListener('click', closeModal);

    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', function () {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            this.classList.add('active');

            const targetId = this.getAttribute('data-tab');
            document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
            document.getElementById(targetId + '-complaints').classList.remove('hidden');

            // re-render complaints based on current data
            populateComplaintCards(Object.values(complaintData));
        });
    });

    const assignBtn = document.getElementById('assign-btn');
    if (assignBtn) {
        assignBtn.addEventListener('click', showAssignForm);
    }

    const assignForm = document.getElementById('assign-form');
    if (assignForm) {
        assignForm.addEventListener('submit', function (e) {
            e.preventDefault();
            assignComplaint();
        });
    }
}

function closeModal() {
    document.querySelectorAll('.modal').forEach(modal => modal.classList.remove('active'));
    document.querySelector('.overlay').classList.remove('active');
}

function showAssignForm() {
    document.getElementById('modal-details').classList.remove('active');
    document.getElementById('assign-form-container').classList.add('active');
}