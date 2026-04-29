// Global variables
let currentComplaintId = null;
let complaintData = {};
let contractorMap;
let contractorMarkers = [];
let modalMap;
let modalMarker;

// Initialize dashboard when the DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('[INIT] Dashboard initializing...');
    
    const contractorEmail = sessionStorage.getItem('contractorEmail');
    console.log('[INIT] Contractor email:', contractorEmail);
    
    if (contractorEmail) {
        loadDashboardData(contractorEmail);
    } else {
        console.error('[INIT] No contractor email found in session!');
        alert('Please login again');
        window.location.href = '/login/contractor';
    }
    
    setupEventListeners();
});

// Fetch dashboard data from API
function loadDashboardData(email) {
    console.log('[LOAD] Fetching dashboard data for:', email);
    
    fetch(`/api/contractor/dashboard_data?email=${email}`)
        .then(response => {
            console.log('[LOAD] Response status:', response.status);
            return response.json();
        })
        .then(complaints => {
            console.log('[LOAD] Received complaints:', complaints.length);
            
            if (!Array.isArray(complaints)) {
                console.error('[LOAD] Expected array, got:', complaints);
                return;
            }

            complaintData = complaints.reduce((obj, item) => {
                obj[item.id] = item;
                return obj;
            }, {});
            
            updateStatusCounts(complaints);
            populateComplaintCards(complaints);
        })
        .catch(error => {
            console.error('[LOAD] Error:', error);
            alert('Failed to load dashboard data. Check console for details.');
        });
}

// Update the status card counts
function updateStatusCounts(complaints) {
    const pendingCount = complaints.filter(c => c.status === 'pending' || c.status === 'assigned').length;
    const progressCount = complaints.filter(c => c.status === 'in progress').length;
    const completedCount = complaints.filter(c => c.status === 'completed').length;
    
    document.getElementById('pending-count').textContent = pendingCount;
    document.getElementById('progress-count').textContent = progressCount;
    document.getElementById('completed-count').textContent = completedCount;
    
    console.log('[STATUS] Counts updated - Pending:', pendingCount, 'Progress:', progressCount, 'Completed:', completedCount);
}

// Populate the complaints grid with cards
function populateComplaintCards(complaints) {
    const activeComplaints = complaints.filter(c => c.status !== 'completed');
    const fixedComplaints = complaints.filter(c => c.status === 'completed');
    
    const activeContainer = document.getElementById('manage-complaints').querySelector('.complaints-grid');
    activeContainer.innerHTML = '';
    
    if (activeComplaints.length === 0) {
        activeContainer.innerHTML = '<p class="no-complaints">No active complaints assigned to you.</p>';
    } else {
        activeComplaints.forEach(complaint => {
            activeContainer.appendChild(createComplaintCard(complaint, false));
        });
    }
    
    const fixedContainer = document.getElementById('fixed-complaints').querySelector('.complaints-grid');
    fixedContainer.innerHTML = '';
    
    if (fixedComplaints.length === 0) {
        fixedContainer.innerHTML = '<p class="no-complaints">No fixed complaints yet.</p>';
    } else {
        fixedComplaints.forEach(complaint => {
            fixedContainer.appendChild(createComplaintCard(complaint, true));
        });
    }
}

// Create a complaint card element
function createComplaintCard(complaint, isFixed) {
    const card = document.createElement('div');
    card.className = 'complaint-card';
    
    let severityClass = 'medium';
    if (complaint.severity === 'high') severityClass = 'high';
    else if (complaint.severity === 'low') severityClass = 'low';
    
    let statusTag = 'pending';
    if (complaint.status === 'in progress') statusTag = 'progress';
    else if (complaint.status === 'assigned') statusTag = 'assigned';
    
    if (isFixed) {
        card.innerHTML = `
            <div class="complaint-image">
                <div class="fixed-tag">Fixed</div>
                <img src="${complaint.fixed_image_url || '../static/images/placeholder.jpg'}" alt="Fixed pothole">
            </div>
            <div class="complaint-info">
                <h3>Complaint ${complaint.id.substring(0, 6)}</h3>
                <div class="location">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 13C13.1046 13 14 12.1046 14 11C14 9.89543 13.1046 9 12 9C10.8954 9 10 9.89543 10 11C10 12.1046 10.8954 13 12 13Z" fill="#6B7280"/>
                        <path d="M12 22C8 18 6 14 6 11C6 7.68629 8.68629 5 12 5C15.3137 5 18 7.68629 18 11C18 14 16 18 12 22Z" stroke="#6B7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    <span>${complaint.location}</span>
                </div>
                <div class="date-info">
                    <p>Reported: ${complaint.date_reported}</p>
                    <p>Fixed: ${complaint.date_fixed || 'N/A'}</p>
                </div>
                <p class="description">${complaint.description}</p>
                <button class="btn btn-secondary view-details" data-id="${complaint.id}">View Details</button>
            </div>
        `;
    } else {
        card.innerHTML = `
            <div class="complaint-image">
                <div class="severity-tag ${severityClass}">${complaint.severity || 'Medium'}</div>
                <img src="${complaint.image_url || '../static/images/placeholder.jpg'}" alt="Pothole">
            </div>
            <div class="complaint-info">
                <h3>Complaint ${complaint.id.substring(0, 6)}</h3>
                <div class="location">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 13C13.1046 13 14 12.1046 14 11C14 9.89543 13.1046 9 12 9C10.8954 9 10 9.89543 10 11C10 12.1046 10.8954 13 12 13Z" fill="#6B7280"/>
                        <path d="M12 22C8 18 6 14 6 11C6 7.68629 8.68629 5 12 5C15.3137 5 18 7.68629 18 11C18 14 16 18 12 22Z" stroke="#6B7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    <span>${complaint.location}</span>
                </div>
                <p class="description">${complaint.description}</p>
                <div class="status-tag ${statusTag}">${complaint.status}</div>
                <button class="btn btn-secondary view-details" data-id="${complaint.id}">View Details</button>
            </div>
        `;
    }

    const viewBtn = card.querySelector('.view-details');
    if (viewBtn) {
        viewBtn.addEventListener('click', function () {
            openComplaintModal(this.getAttribute('data-id'));
        });
    }
    
    return card;
}

// Open the complaint details modal
function openComplaintModal(complaintId) {
    currentComplaintId = complaintId;
    const complaint = complaintData[complaintId];

    if (!complaint) {
        console.error('[MODAL] Complaint not found:', complaintId);
        return;
    }

    console.log('[MODAL] Opening complaint:', complaintId);

    document.getElementById('modal-title').textContent = `Complaint Details - ${complaintId.substring(0, 6)}`;
    document.getElementById('modal-image').src = complaint.image_url || '../static/images/placeholder.jpg';
    document.getElementById('modal-date-reported').textContent = complaint.date_reported;
    document.getElementById('modal-location').textContent = complaint.location;
    document.getElementById('modal-severity').textContent = complaint.severity || 'Medium';
    document.getElementById('modal-severity').className = `severity-text ${complaint.severity || 'medium'}`;
    document.getElementById('modal-description').textContent = complaint.description;
    document.getElementById('modal-reporter').textContent = complaint.reported_by || 'N/A';

    const modalStatus = document.getElementById('modal-status');
    modalStatus.className = `modal-status ${complaint.status}`;
    modalStatus.textContent = complaint.status.charAt(0).toUpperCase() + complaint.status.slice(1);

    const fixedDateContainer = document.getElementById('fixed-date-container');
    if (complaint.date_fixed) {
        fixedDateContainer.style.display = 'flex';
        document.getElementById('modal-date-fixed').textContent = complaint.date_fixed;
    } else {
        fixedDateContainer.style.display = 'none';
    }

    const actionButtons = document.getElementById('modal-actions');
    if (complaint.status === 'completed') {
        actionButtons.style.display = 'none';
    } else {
        actionButtons.style.display = 'flex';
    }

    document.getElementById('complaint-id-input').value = complaintId;
    document.getElementById('complaint-modal').classList.add('active');
    document.querySelector('.overlay').classList.add('active');

    if (modalMap) modalMap = null;

    setTimeout(() => {
        const mapCenter = {
            lat: parseFloat(complaint.latitude),
            lng: parseFloat(complaint.longitude)
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
    }, 200);
}

// Set up all event listeners
function setupEventListeners() {
    console.log('[SETUP] Setting up event listeners...');
    
    // Tab switching
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            tabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.add('hidden');
            });
            
            const tabName = this.getAttribute('data-tab');
            document.getElementById(tabName + '-complaints').classList.remove('hidden');
        });
    });
    
    // Close modal buttons
    document.querySelectorAll('.close-modal').forEach(button => {
        button.addEventListener('click', closeModal);
    });
    
    document.querySelector('.overlay').addEventListener('click', closeModal);
    
    document.querySelectorAll('.modal-content').forEach(modal => {
        modal.addEventListener('click', function(e) {
            e.stopPropagation();
        });
    });
    
    // Mark as fixed button
    const markFixedBtn = document.getElementById('mark-fixed-btn');
    if (markFixedBtn) {
        markFixedBtn.addEventListener('click', function() {
            console.log('[FIX] Opening fix modal for complaint:', currentComplaintId);
            document.getElementById('fix-modal').classList.add('active');
        });
    }
    
    // Cancel fix button
    const cancelBtn = document.querySelector('.cancel-fix');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', function() {
            console.log('[FIX] Cancelling fix');
            document.getElementById('fix-modal').classList.remove('active');
        });
    }
    
    // Fix form submission
    const fixForm = document.getElementById('fix-form');
    if (fixForm) {
        fixForm.addEventListener('submit', submitFixForm);
    }
    
    // Image preview
    const fixImage = document.getElementById('fix-image');
    if (fixImage) {
        fixImage.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                console.log('[PREVIEW] Image selected:', file.name);
                const reader = new FileReader();
                reader.onload = function(e) {
                    document.getElementById('image-preview').src = e.target.result;
                    document.getElementById('image-preview-container').classList.remove('hidden');
                };
                reader.readAsDataURL(file);
            }
        });
    }
}

// Close modals
function closeModal() {
    console.log('[MODAL] Closing modals');
    document.getElementById('complaint-modal').classList.remove('active');
    document.getElementById('fix-modal').classList.remove('active');
    document.querySelector('.overlay').classList.remove('active');
    
    document.getElementById('image-preview-container').classList.add('hidden');
    document.getElementById('image-preview').src = '#';
    
    const fixForm = document.getElementById('fix-form');
    if (fixForm) fixForm.reset();
}

// Submit the fix form - WITH YOLO VERIFICATION HANDLING
function submitFixForm(e) {
    e.preventDefault();
    
    console.log('[SUBMIT] Form submission started');
    
    const submitButton = e.target.querySelector('button[type="submit"]');
    const imageInput = document.getElementById('fix-image');
    const complaintIdInput = document.getElementById('complaint-id-input');
    
    // Validation
    if (!imageInput.files || imageInput.files.length === 0) {
        alert('❌ Please select an image file');
        console.error('[SUBMIT] No image selected');
        return;
    }
    
    if (!complaintIdInput.value) {
        alert('❌ No complaint ID found');
        console.error('[SUBMIT] No complaint ID');
        return;
    }
    
    const formData = new FormData(document.getElementById('fix-form'));
    
    console.log('[SUBMIT] Complaint ID:', formData.get('complaint_id'));
    console.log('[SUBMIT] Image:', formData.get('image')?.name);
    
    // Disable button and show verifying state
    submitButton.disabled = true;
    submitButton.innerHTML = '<span>Verifying...</span>';
    
    fetch('/api/contractor/fix', {
        method: 'POST',
        body: formData
    })
    .then(response => {
        console.log('[SUBMIT] Response status:', response.status);
        return response.json().then(data => ({
            status: response.status,
            data: data
        }));
    })
    .then(({status, data}) => {
        console.log('[SUBMIT] Response data:', data);
        
        submitButton.disabled = false;
        submitButton.textContent = 'Submit';
        
        if (status === 200 && data.success && !data.pothole_detected) {
            // SUCCESS - Pothole verified as fixed
            alert('✅ SUCCESS!\n\n' + data.message + '\n\n✓ No pothole detected\n✓ Status updated to Completed');
            closeModal();
            
            const contractorEmail = sessionStorage.getItem('contractorEmail');
            if (contractorEmail) {
                loadDashboardData(contractorEmail);
            }
        } 
        else if (data.pothole_detected) {
            // REJECTED - Pothole still detected
            const confidencePercent = (data.confidence * 100).toFixed(1);
            alert(
                '❌ VERIFICATION FAILED\n\n' +
                'Pothole Still Detected!\n\n' +
                '━━━━━━━━━━━━━━━━━━━━\n\n' +
                '🔍 AI Detection Result:\n' +
                `   Confidence: ${confidencePercent}%\n\n` +
                '❗ Reason:\n' +
                '   The AI model detected a pothole\n' +
                '   in your image, indicating the repair\n' +
                '   is incomplete.\n\n' +
                '🔧 What to do:\n' +
                '   1. Complete the repair properly\n' +
                '   2. Ensure the area is fully filled\n' +
                '   3. Take a clear photo of the fixed area\n' +
                '   4. Submit again\n\n' +
                '━━━━━━━━━━━━━━━━━━━━'
            );
        }
        else {
            // Other error
            alert('❌ Error: ' + (data.error || data.message || 'Unknown error'));
        }
    })
    .catch(error => {
        console.error('[SUBMIT] Network error:', error);
        submitButton.disabled = false;
        submitButton.textContent = 'Submit';
        
        alert(
            '❌ Network Error\n\n' +
            'Could not connect to server.\n\n' +
            'Details: ' + error.message + '\n\n' +
            'Check:\n' +
            '1. Flask server is running\n' +
            '2. Browser console (F12) for errors'
        );
    });
}

// Google Maps initialization
function initContractorMap() {
    console.log("[MAP] Initializing Google Map");

    const mumbaiCenter = { lat: 19.0760, lng: 72.8777 };

    contractorMap = new google.maps.Map(document.getElementById("google-map-contractor"), {
        center: mumbaiCenter,
        zoom: 12,
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        fullscreenControl: false,
        streetViewControl: false,
        mapTypeControl: false
    });

    loadContractorMapData();
}

function loadContractorMapData() {
    const contractorEmail = sessionStorage.getItem('contractorEmail');
    if (!contractorEmail) {
        console.error("[MAP] No contractor email!");
        return;
    }

    fetch(`/api/contractor/map_data?email=${contractorEmail}`)
        .then(response => response.json())
        .then(complaints => {
            console.log('[MAP] Loaded complaints:', complaints.length);
            
            if (!Array.isArray(complaints)) {
                console.error('[MAP] Expected array, got:', complaints);
                return;
            }

            contractorMarkers.forEach(marker => marker.setMap(null));
            contractorMarkers = [];

            complaints.forEach(complaint => {
                const position = {
                    lat: parseFloat(complaint.latitude),
                    lng: parseFloat(complaint.longitude)
                };

                if (isNaN(position.lat) || isNaN(position.lng)) {
                    console.warn('[MAP] Invalid coordinates:', complaint.id);
                    return;
                }

                const status = complaint.status.toLowerCase();
                let iconColor;
                
                if (status === 'completed') {
                    iconColor = "http://maps.google.com/mapfiles/ms/icons/green-dot.png";
                } else if (status === 'in progress' || status === 'assigned') {
                    iconColor = "http://maps.google.com/mapfiles/ms/icons/blue-dot.png";
                } else {
                    iconColor = "http://maps.google.com/mapfiles/ms/icons/red-dot.png";
                }

                let marker = new google.maps.Marker({
                    position,
                    map: contractorMap,
                    icon: iconColor,
                    title: `Complaint ${complaint.id.substring(0,6)}`
                });

                const infoWindow = new google.maps.InfoWindow({
                    content: `
                        <div style="font-size: 14px;">
                            <strong>Location:</strong> ${complaint.location}<br>
                            <strong>Status:</strong> ${complaint.status}<br>
                            <strong>Severity:</strong> ${complaint.severity}<br>
                            <strong>Description:</strong><br>${complaint.description}
                        </div>
                    `
                });

                marker.addListener('click', () => {
                    infoWindow.open(contractorMap, marker);
                });

                contractorMarkers.push(marker);
            });

            contractorMap.setCenter({ lat: 19.0760, lng: 72.8777 });
            contractorMap.setZoom(12);

            const subtext = document.querySelector('.real-map-section .map-subtext');
            if (subtext) {
                subtext.textContent = `Showing ${complaints.length} potholes assigned to you.`;
            }
        })
        .catch(error => {
            console.error('[MAP] Error:', error);
        });
}