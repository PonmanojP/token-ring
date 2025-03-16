const socket = io();
socket.on('updateDashboard', (data) => {
    // Reload the page to reflect updates
    window.location.reload();
});