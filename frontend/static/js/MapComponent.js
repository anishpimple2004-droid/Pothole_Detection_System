// MapComponent.js
import React, { useEffect, useRef, useState } from 'react';

const MapComponent = ({ userRole, complaints, specificComplaintId = null }) => {
  const mapRef = useRef(null);
  const [map, setMap] = useState(null);
  const [markers, setMarkers] = useState([]);
  
  // Initialize map
  useEffect(() => {
    if (!mapRef.current) return;
    
    const googleMap = new window.google.maps.Map(mapRef.current, {
      center: { lat: 37.7749, lng: -122.4194 }, // Default center
      zoom: 10,
      mapTypeControl: false,
    });
    
    setMap(googleMap);
  }, [mapRef]);
  
  // Filter and display markers based on user role
  useEffect(() => {
    if (!map || !complaints) return;
    
    // Clear existing markers
    markers.forEach(marker => marker.setMap(null));
    const newMarkers = [];
    
    // Filter complaints based on user role
    let filteredComplaints = [];
    
    if (specificComplaintId) {
      // For modal view - show only the specific complaint
      filteredComplaints = complaints.filter(
        complaint => complaint.id === specificComplaintId
      );
      
      // If we found the complaint, center the map on it
      if (filteredComplaints.length > 0) {
        const complaint = filteredComplaints[0];
        map.setCenter({ lat: complaint.lat, lng: complaint.lng });
        map.setZoom(15); // Zoom in closer for specific view
      }
    } else if (userRole === 'contractor') {
      // For contractor - show only their complaints
      filteredComplaints = complaints.filter(
        complaint => complaint.assignedContractorId === getCurrentContractorId()
      );
    } else if (userRole === 'admin') {
      // For admin - show all complaints
      filteredComplaints = complaints;
    }
    
    // Create markers for filtered complaints
    filteredComplaints.forEach(complaint => {
      const marker = new window.google.maps.Marker({
        position: { lat: complaint.lat, lng: complaint.lng },
        map: map,
        title: complaint.title,
      });
      
      // Add click event to marker
      marker.addListener('click', () => {
        openComplaintDetails(complaint.id);
      });
      
      newMarkers.push(marker);
    });
    
    setMarkers(newMarkers);
    
    // Auto-fit bounds if we have multiple markers
    if (newMarkers.length > 1) {
      const bounds = new window.google.maps.LatLngBounds();
      newMarkers.forEach(marker => {
        bounds.extend(marker.getPosition());
      });
      map.fitBounds(bounds);
    }
  }, [map, complaints, userRole, specificComplaintId]);
  
  // Helper function to get current contractor ID from auth context
  const getCurrentContractorId = () => {
    // Replace with your actual auth implementation
    // Example: return authContext.user.contractorId;
    return 'current-contractor-id';
  };
  
  // Helper function to open complaint details
  const openComplaintDetails = (complaintId) => {
    // Replace with your application's navigation logic
    console.log(`Opening complaint: ${complaintId}`);
  };
  
  return (
    <div className="map-container">
      <div 
        ref={mapRef} 
        style={{ width: '100%', height: '400px' }}
      />
    </div>
  );
};

export default MapComponent;