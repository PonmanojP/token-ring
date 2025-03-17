const express = require("express");
const http = require("http");
const socketIo = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.set("view engine", "ejs");
app.use(express.static("public"));

let players = []; // Stores player info
let sharedResource = "Initial Resource"; // The shared text box content
let tokenIndex = 0; // Keeps track of the token holder

const TOTAL_PLAYERS = 25;
const EDIT_PERCENTAGE = 0.4; // 60% can edit
const EDIT_COUNT = Math.floor(TOTAL_PLAYERS * EDIT_PERCENTAGE);

// Initialize Players and Randomly Select 60% Who Can Edit
for (let i = 1; i <= TOTAL_PLAYERS; i++) {
    players.push({ id: i, canEdit: false, isRequesting: false }); // isRequesting controls the green-to-red transition
}

// Randomly Assign 60% of Players as Editors
let editablePlayers = [];
while (editablePlayers.length < EDIT_COUNT) {
    let randomIndex = Math.floor(Math.random() * TOTAL_PLAYERS);
    if (!editablePlayers.includes(randomIndex)) {
        editablePlayers.push(randomIndex);
        players[randomIndex].canEdit = true;
        players[randomIndex].isRequesting = true;
    }
}

// Function to randomly turn a green player red every 10-20 seconds
function toggleRequestAccess() {
    let greenPlayers = players.filter(p => !p.canEdit && !p.isRequesting); // Find non-editing (green) players

    if (greenPlayers.length > 0) {
        let randomGreen = greenPlayers[Math.floor(Math.random() * greenPlayers.length)];
        randomGreen.isRequesting = true; // Turn the green player into a requesting red one

        io.emit("playerUpdated", players); // Notify clients of the update
    }

    let nextInterval = Math.floor(Math.random() * (20000 - 10000) + 10000); // Random 10-20s
    setTimeout(toggleRequestAccess, nextInterval);
}

// Start the random red request cycle

app.get("/", (req, res) => {
    res.render("admin", { players, tokenIndex, sharedResource });
});

// Admin Panel
app.get("/admin", (req, res) => {
    res.render("admin", { players, tokenIndex, sharedResource });
});

// Player Page
app.get("/game/:id", (req, res) => {
    const playerId = parseInt(req.params.id);
    const player = players.find(p => p.id === playerId);

    if (!player) {
        return res.status(404).send("Player not found");
    }

    res.render("game", { player, sharedResource, players, tokenIndex });
});

io.on("connection", (socket) => {
    console.log("A user connected");

    // Token Circulation Logic
    function passToken() {
        tokenIndex = (tokenIndex + 1) % TOTAL_PLAYERS;
        io.emit("updateToken", tokenIndex);
    }

    socket.on("passToken", () => {
        passToken();
    });

    socket.on("updateResource", (data) => {
        const player = players.find(p => p.id === data.playerId);
    
        if (player && player.canEdit) {
            sharedResource = data.value;
            io.emit("resourceUpdated", sharedResource);
            
            // The editor becomes non-editable
            player.canEdit = false;
            player.isRequesting = false;
    
            // Pick a new random green player and turn them red (requesting)
            let greenPlayers = players.filter(p => !p.canEdit && !p.isRequesting);
            if (greenPlayers.length > 0) {
                let randomGreen = greenPlayers[Math.floor(Math.random() * greenPlayers.length)];
                randomGreen.isRequesting = true;
            }
    
            io.emit("playerUpdated", players);
            passToken();
        }
    });
    

    socket.on("disconnect", () => {
        console.log("A user disconnected");
    });
});

server.listen(3000, () => {
    console.log("Server running on port 3000");
});
