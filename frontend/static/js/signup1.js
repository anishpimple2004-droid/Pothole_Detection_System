// Function to create and animate cars
function createCars() {
    const carsContainer = document.getElementById('cars-container');
    if (!carsContainer) return;
    
    const carColors = ['red-car', 'blue-car', 'green-car', 'yellow-car'];
    const numCars = 8;
    
    // Clear any existing cars first
    carsContainer.innerHTML = '';
    
    for (let i = 0; i < numCars; i++) {
      const car = document.createElement('div');
      car.className = `car ${carColors[i % carColors.length]}`;
      
      const isLeftToRight = i % 2 === 0;
      const topPosition = isLeftToRight ? 8 : 28;
      const animationDuration = 8 + Math.random() * 7; // Between 8-15 seconds
      const animationDelay = Math.random() * 5; // Random delay up to 5 seconds
      
      car.style.top = `${topPosition}px`;
      car.style.animationDuration = `${animationDuration}s`;
      car.style.animationDelay = `${animationDelay}s`;
      
      if (isLeftToRight) {
        car.style.animationName = 'driveRight';
        car.style.left = '-50px';
      } else {
        car.style.animationName = 'driveLeft';
        car.style.right = '-50px';
      }
      
      // Add to container
      carsContainer.appendChild(car);
    }
  }
  
  // Handle file input functionality
  function setupFileInput() {
    const fileInput = document.getElementById('gov-id');
    const fileButton = document.getElementById('file-button');
    const fileName = document.getElementById('file-name');
    
    if (!fileInput || !fileButton || !fileName) return;
    
    fileButton.addEventListener('click', function() {
      fileInput.click();
    });
    
    fileInput.addEventListener('change', function() {
      if (fileInput.files.length > 0) {
        fileName.textContent = fileInput.files[0].name;
      } else {
        fileName.textContent = 'No file chosen';
      }
    });
  }
  
  // Initialize the page
  function initPage() {
    // Setup file input handling
    setupFileInput();
    
    // Create and animate cars
    createCars();
    
    // Re-create cars periodically to ensure animation continues
    setInterval(createCars, 30000); // Recreate cars every 30 seconds
  }
  
  // Run when DOM is loaded
  document.addEventListener('DOMContentLoaded', initPage);