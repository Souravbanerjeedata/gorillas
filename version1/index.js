// The state of the game
let state = {};

let isDragging = false;
let dragStartX = undefined;
let dragStartY = undefined;

let previousAnimationTimestamp = undefined;
let animationFrameRequestID = undefined;
let delayTimeoutID = undefined;

let simulationMode = false;
let simulationImpact = {};

const darkModeMediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

// Settings
const settings = {
  numberOfPlayers: 1, // 0 means two computers are playing against each other
  mode: darkModeMediaQuery.matches ? "dark" : "light",
};

const blastHoleRadius = 18;

// The main canvas element and its drawing context
const canvas = document.getElementById("game");
canvas.width = window.innerWidth * window.devicePixelRatio;
canvas.height = window.innerHeight * window.devicePixelRatio;
canvas.style.width = window.innerWidth + "px";
canvas.style.height = window.innerHeight + "px";
const ctx = canvas.getContext("2d");

// Windmill
const windmillDOM = document.getElementById("windmill");
const windmillHeadDOM = document.getElementById("windmill-head");
const windInfoDOM = document.getElementById("wind-info");
const windSpeedDOM = document.getElementById("wind-speed");

// Left info panel
const info1DOM = document.getElementById("info-left");
const name1DOM = document.querySelector("#info-left .name");
const angle1DOM = document.querySelector("#info-left .angle");
const velocity1DOM = document.querySelector("#info-left .velocity");

// Right info panel
const info2DOM = document.getElementById("info-right");
const name2DOM = document.querySelector("#info-right .name");
const angle2DOM = document.querySelector("#info-right .angle");
const velocity2DOM = document.querySelector("#info-right .velocity");

// Instructions panel
const instructionsDOM = document.getElementById("instructions");
const gameModeDOM = document.getElementById("game-mode");

// The bomb's grab area
const bombGrabAreaDOM = document.getElementById("bomb-grab-area");

// Congratulations panel
const congratulationsDOM = document.getElementById("congratulations");
const winnerDOM = document.getElementById("winner");

// Settings toolbar
const settingsDOM = document.getElementById("settings");
const singlePlayerButtonDOM = document.querySelectorAll(".single-player");
const twoPlayersButtonDOM = document.querySelectorAll(".two-players");
const autoPlayButtonDOM = document.querySelectorAll(".auto-play");
const colorModeButtonDOM = document.getElementById("color-mode");

colorModeButtonDOM.addEventListener("click", () => {
  if (settings.mode === "dark") {
    settings.mode = "light";
    colorModeButtonDOM.innerText = "Dark Mode";
  } else {
    settings.mode = "dark";
    colorModeButtonDOM.innerText = "Light Mode";
  }
  draw();
});

darkModeMediaQuery.addEventListener("change", (e) => {
  settings.mode = e.matches ? "dark" : "light";
  if (settings.mode === "dark") {
    colorModeButtonDOM.innerText = "Light Mode";
  } else {
    colorModeButtonDOM.innerText = "Dark Mode";
  }
  draw();
});

newGame();

function newGame() {
  // Reset game state
  state = {
    phase: "aiming", // aiming | in flight | celebrating
    currentPlayer: 1,
    round: 1,
    windSpeed: generateWindSpeed(),
    bomb: {
      x: undefined,
      y: undefined,
      rotation: 0,
      velocity: { x: 0, y: 0 },
      highlight: true,
    },

    // Buildings
    backgroundBuildings: [],
    buildings: [],
    blastHoles: [],

    stars: [],

    scale: 1,
    shift: 0,
  };

  // Generate stars
  for (let i = 0; i < (window.innerWidth * window.innerHeight) / 12000; i++) {
    const x = Math.floor(Math.random() * window.innerWidth);
    const y = Math.floor(Math.random() * window.innerHeight);
    state.stars.push({ x, y });
  }

  // Generate background buildings
  for (let i = 0; i < 17; i++) {
    generateBackgroundBuilding(i);
  }

  // Generate buildings
  for (let i = 0; i < 8; i++) {
    generateBuilding(i);
  }

  calculateScaleAndShift();
  initializeBombPosition();
  initializeWindmillPosition();
  setWindMillRotation();

  // Cancel any ongoing animation and timeout
  cancelAnimationFrame(animationFrameRequestID);
  clearTimeout(delayTimeoutID);

  // Reset HTML elements
  if (settings.numberOfPlayers > 0) {
    showInstructions();
  } else {
    hideInstructions();
  }
  hideCongratulations();
  angle1DOM.innerText = 0;
  velocity1DOM.innerText = 0;
  angle2DOM.innerText = 0;
  velocity2DOM.innerText = 0;

  // Reset simulation mode
  simulationMode = false;
  simulationImpact = {};

  draw();

  if (settings.numberOfPlayers === 0) {
    computerThrow();
  }
}

function showInstructions() {
  singlePlayerButtonDOM.checked = true;
  instructionsDOM.style.opacity = 1;
  instructionsDOM.style.visibility = "visible";
}

function hideInstructions() {
  state.bomb.highlight = false;
  instructionsDOM.style.opacity = 0;
  instructionsDOM.style.visibility = "hidden";
}

function showCongratulations() {
  congratulationsDOM.style.opacity = 1;
  congratulationsDOM.style.visibility = "visible";
}

function hideCongratulations() {
  congratulationsDOM.style.opacity = 0;
  congratulationsDOM.style.visibility = "hidden";
}

function generateBackgroundBuilding(index) {
  const previousBuilding = state.backgroundBuildings[index - 1];

  const x = previousBuilding
    ? previousBuilding.x + previousBuilding.width + 4
    : -300;

  const minWidth = 60;
  const maxWidth = 110;
  const width = minWidth + Math.random() * (maxWidth - minWidth);

  const smallerBuilding = index < 4 || index >= 13;

  const minHeight = 80;
  const maxHeight = 350;
  const smallMinHeight = 20;
  const smallMaxHeight = 150;
  const height = smallerBuilding
    ? smallMinHeight + Math.random() * (smallMaxHeight - smallMinHeight)
    : minHeight + Math.random() * (maxHeight - minHeight);

  state.backgroundBuildings.push({ x, width, height });
}

function generateBuilding(index) {
  const previousBuilding = state.buildings[index - 1];

  const x = previousBuilding
    ? previousBuilding.x + previousBuilding.width + 4
    : 0;

  const minWidth = 80;
  const maxWidth = 130;
  const width = minWidth + Math.random() * (maxWidth - minWidth);

  const smallerBuilding = index <= 1 || index >= 6;

  const minHeight = 40;
  const maxHeight = 300;
  const minHeightGorilla = 30;
  const maxHeightGorilla = 150;

  const height = smallerBuilding
    ? minHeightGorilla + Math.random() * (maxHeightGorilla - minHeightGorilla)
    : minHeight + Math.random() * (maxHeight - minHeight);

  // Generate an array of booleans to show if the light is on or off in a room
  const lightsOn = [];
  for (let i = 0; i < 50; i++) {
    const light = Math.random() <= 0.33 ? true : false;
    lightsOn.push(light);
  }

  state.buildings.push({ x, width, height, lightsOn });
}

function calculateScaleAndShift() {
  const lastBuilding = state.buildings.at(-1);
  const totalWidthOfTheCity = lastBuilding.x + lastBuilding.width;

  const horizontalScale = window.innerWidth / totalWidthOfTheCity ?? 1;
  const verticalScale = window.innerHeight / 500;

  state.scale = Math.min(horizontalScale, verticalScale);

  const sceneNeedsToBeShifted = horizontalScale > verticalScale;

  state.shift = sceneNeedsToBeShifted
    ? (window.innerWidth - totalWidthOfTheCity * state.scale) / 2
    : 0;
}

window.addEventListener("resize", () => {
  canvas.width = window.innerWidth * window.devicePixelRatio;
  canvas.height = window.innerHeight * window.devicePixelRatio;
  canvas.style.width = window.innerWidth + "px";
  canvas.style.height = window.innerHeight + "px";
  calculateScaleAndShift();
  initializeBombPosition();
  initializeWindmillPosition();
  draw();
});

function initializeBombPosition() {
  const building =
    state.currentPlayer === 1
      ? state.buildings.at(1) // Second building
      : state.buildings.at(-2); // Second last building

  const gorillaX = building.x + building.width / 2;
  const gorillaY = building.height;

  const gorillaHandOffsetX = state.currentPlayer === 1 ? -28 : 28;
  const gorillaHandOffsetY = 107;

  state.bomb.x = gorillaX + gorillaHandOffsetX;
  state.bomb.y = gorillaY + gorillaHandOffsetY;
  state.bomb.velocity.x = 0;
  state.bomb.velocity.y = 0;
  state.bomb.rotation = 0;

  // Initialize the position of the grab area in HTML
  const grabAreaRadius = 15;
  const left = state.bomb.x * state.scale + state.shift - grabAreaRadius;
  const bottom = state.bomb.y * state.scale - grabAreaRadius;

  bombGrabAreaDOM.style.left = `${left}px`;
  bombGrabAreaDOM.style.bottom = `${bottom}px`;
}

function initializeWindmillPosition() {
  // Move windmill into position
  const lastBuilding = state.buildings.at(-1);
  let rooftopY = lastBuilding.height * state.scale;
  let rooftopX =
    (lastBuilding.x + lastBuilding.width / 2) * state.scale + state.shift;

  windmillDOM.style.bottom = `${rooftopY}px`;
  windmillDOM.style.left = `${rooftopX - 100}px`;

  windmillDOM.style.scale = state.scale;

  windInfoDOM.style.bottom = `${rooftopY}px`;
  windInfoDOM.style.left = `${rooftopX - 50}px`;
}

function draw() {
  ctx.save();

  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

  drawBackgroundSky();

  // Flip coordinate system upside down
  ctx.translate(0, window.innerHeight);
  ctx.scale(1, -1);

  // Scale and shift view to center
  ctx.translate(state.shift, 0);
  ctx.scale(state.scale, state.scale);

  // Draw scene
  drawBackgroundMoon();
  drawBackgroundBuildings();
  drawBuildingsWithBlastHoles();
  drawGorilla(1);
  drawGorilla(2);
  drawBomb();

  // Restore transformation
  ctx.restore();
}

function drawBackgroundSky() {
  const gradient = ctx.createLinearGradient(0, 0, 0, window.innerHeight);
  if (settings.mode === "dark") {
    gradient.addColorStop(0, "#080b1b");
    gradient.addColorStop(0.48, "#171431");
    gradient.addColorStop(1, "#4b2852");
  } else {
    gradient.addColorStop(0, "#ffb781");
    gradient.addColorStop(0.58, "#f1848b");
    gradient.addColorStop(1, "#5d3d78");
  }

  // Draw sky
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

  const horizonGlow = ctx.createRadialGradient(
    window.innerWidth * 0.52,
    window.innerHeight * 0.72,
    8,
    window.innerWidth * 0.52,
    window.innerHeight * 0.72,
    window.innerWidth * 0.7,
  );
  horizonGlow.addColorStop(
    0,
    settings.mode === "dark"
      ? "rgba(101, 67, 147, 0.34)"
      : "rgba(255, 203, 125, 0.34)",
  );
  horizonGlow.addColorStop(1, "rgba(8, 11, 27, 0)");
  ctx.fillStyle = horizonGlow;
  ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

  // Draw stars
  if (settings.mode === "dark") {
    state.stars.forEach((star, index) => {
      const size = index % 7 === 0 ? 2 : 1;
      ctx.fillStyle = index % 5 === 0 ? "#9df7f3" : "#fff4d1";
      ctx.globalAlpha = index % 3 === 0 ? 0.92 : 0.58;
      ctx.fillRect(star.x, star.y, size, size);
    });
    ctx.globalAlpha = 1;
  }
}

function drawBackgroundMoon() {
  if (settings.mode === "dark") {
    ctx.shadowColor = "rgba(255, 221, 153, 0.55)";
    ctx.shadowBlur = 34;
    const moonX = window.innerWidth / state.scale - state.shift - 200;
    const moonY = window.innerHeight / state.scale - 100;
    const moon = ctx.createRadialGradient(
      moonX - 8,
      moonY - 8,
      2,
      moonX,
      moonY,
      38,
    );
    moon.addColorStop(0, "#fff7d8");
    moon.addColorStop(1, "#f4c77f");
    ctx.fillStyle = moon;
    ctx.beginPath();
    ctx.arc(moonX, moonY, 30, 0, 2 * Math.PI);
    ctx.fill();
    ctx.shadowBlur = 0;
  } else {
    ctx.shadowColor = "rgba(255, 208, 115, 0.58)";
    ctx.shadowBlur = 30;
    ctx.fillStyle = "#ffd786";
    ctx.beginPath();
    ctx.arc(300, 350, 60, 0, 2 * Math.PI);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

function drawBackgroundBuildings() {
  state.backgroundBuildings.forEach((building, index) => {
    const tone = index % 3;
    const gradient = ctx.createLinearGradient(
      building.x,
      building.height,
      building.x + building.width,
      0,
    );
    if (settings.mode === "dark") {
      gradient.addColorStop(0, tone === 1 ? "#203451" : "#26304d");
      gradient.addColorStop(1, tone === 2 ? "#454065" : "#324b6e");
    } else {
      gradient.addColorStop(0, tone === 1 ? "#79506e" : "#775876");
      gradient.addColorStop(1, tone === 2 ? "#b36b78" : "#93607c");
    }
    ctx.fillStyle = gradient;
    ctx.fillRect(building.x, 0, building.width, building.height);
    ctx.fillStyle = settings.mode === "dark"
      ? "rgba(138, 194, 226, 0.24)"
      : "rgba(255, 222, 177, 0.3)";
    ctx.fillRect(building.x, building.height - 2, building.width, 2);
  });
}

function drawBuildingsWithBlastHoles() {
  ctx.save();

  state.blastHoles.forEach((blastHole) => {
    ctx.beginPath();

    // Outer shape clockwise
    ctx.rect(
      0,
      0,
      window.innerWidth / state.scale,
      window.innerHeight / state.scale,
    );

    // Inner shape counterclockwise
    ctx.arc(blastHole.x, blastHole.y, blastHoleRadius, 0, 2 * Math.PI, true);

    ctx.clip();
  });

  drawBuildings();

  ctx.restore();
}

function drawBuildings() {
  state.buildings.forEach((building, index) => {
    // Draw building
    const palettes = settings.mode === "dark"
      ? [
          ["#10213a", "#1a3150"],
          ["#18223d", "#282b51"],
          ["#17233c", "#1e3a54"],
        ]
      : [
          ["#573d63", "#76516d"],
          ["#563d6f", "#805272"],
          ["#493d68", "#685078"],
        ];
    const buildingGradient = ctx.createLinearGradient(
      building.x,
      building.height,
      building.x + building.width,
      0,
    );
    buildingGradient.addColorStop(0, palettes[index % palettes.length][0]);
    buildingGradient.addColorStop(1, palettes[index % palettes.length][1]);
    ctx.fillStyle = buildingGradient;
    ctx.fillRect(building.x, 0, building.width, building.height);

    // Rooftop edge and a subtle lit side give the skyline more depth.
    ctx.fillStyle = settings.mode === "dark"
      ? "rgba(99, 244, 232, 0.72)"
      : "rgba(255, 211, 144, 0.78)";
    ctx.fillRect(building.x, building.height - 2, building.width, 2);
    ctx.fillStyle = settings.mode === "dark"
      ? "rgba(133, 178, 218, 0.12)"
      : "rgba(255, 218, 185, 0.14)";
    ctx.fillRect(building.x, 0, 3, building.height - 2);

    // Draw windows
    const windowWidth = 10;
    const windowHeight = 12;
    const gap = 15;

    const numberOfFloors = Math.ceil(
      (building.height - gap) / (windowHeight + gap),
    );
    const numberOfRoomsPerFloor = Math.floor(
      (building.width - gap) / (windowWidth + gap),
    );

    for (let floor = 0; floor < numberOfFloors; floor++) {
      for (let room = 0; room < numberOfRoomsPerFloor; room++) {
        if (building.lightsOn[floor * numberOfRoomsPerFloor + room]) {
          ctx.save();

          ctx.translate(building.x + gap, building.height - gap);
          ctx.scale(1, -1);

          const x = room * (windowWidth + gap);
          const y = floor * (windowHeight + gap);

          ctx.fillStyle = settings.mode === "dark"
            ? (index % 2 === 0 ? "#68d9d3" : "#ffc96b")
            : (index % 2 === 0 ? "#ffe2a2" : "#ffb7a1");
          ctx.shadowColor = ctx.fillStyle;
          ctx.shadowBlur = 5;
          ctx.fillRect(x, y, windowWidth, windowHeight);
          ctx.shadowBlur = 0;

          ctx.restore();
        }
      }
    }
  });
}

function drawGorilla(player) {
  ctx.save();

  const building =
    player === 1
      ? state.buildings.at(1) // Second building
      : state.buildings.at(-2); // Second last building

  ctx.translate(building.x + building.width / 2, building.height);

  drawGorillaBody(player);
  drawGorillaLeftArm(player);
  drawGorillaRightArm(player);
  drawGorillaFace(player);
  drawGorillaThoughtBubbles(player);

  ctx.restore();
}

function drawGorillaBody(player) {
  const coat = ctx.createLinearGradient(-22, 16, 22, 80);
  if (player === 1) {
    coat.addColorStop(0, "#63f4e8");
    coat.addColorStop(0.18, "#17788e");
    coat.addColorStop(1, "#102c52");
  } else {
    coat.addColorStop(0, "#ff8eb7");
    coat.addColorStop(0.18, "#a13c78");
    coat.addColorStop(1, "#422852");
  }
  ctx.fillStyle = coat;

  ctx.beginPath();
  ctx.moveTo(0, 15);
  ctx.lineTo(-7, 0);
  ctx.lineTo(-20, 0);
  ctx.lineTo(-17, 18);
  ctx.lineTo(-20, 44);

  ctx.lineTo(-11, 77);
  ctx.lineTo(0, 84);
  ctx.lineTo(11, 77);

  ctx.lineTo(20, 44);
  ctx.lineTo(17, 18);
  ctx.lineTo(20, 0);
  ctx.lineTo(7, 0);
  ctx.fill();
}

function drawGorillaLeftArm(player) {
  ctx.strokeStyle = player === 1 ? "#247f91" : "#a14c78";
  ctx.lineWidth = 19;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.beginPath();
  ctx.moveTo(-14, 50);

  if (state.phase === "aiming" && state.currentPlayer === 1 && player === 1) {
    ctx.quadraticCurveTo(
      -44,
      63,
      -28 - state.bomb.velocity.x / 6.25,
      107 - state.bomb.velocity.y / 6.25,
    );
  } else if (state.phase === "celebrating" && state.currentPlayer === player) {
    ctx.quadraticCurveTo(-44, 63, -28, 107);
  } else {
    ctx.quadraticCurveTo(-44, 45, -28, 12);
  }

  ctx.stroke();
}

function drawGorillaRightArm(player) {
  ctx.strokeStyle = player === 1 ? "#247f91" : "#a14c78";
  ctx.lineWidth = 19;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.beginPath();
  ctx.moveTo(+14, 50);

  if (state.phase === "aiming" && state.currentPlayer === 2 && player === 2) {
    ctx.quadraticCurveTo(
      +44,
      63,
      +28 - state.bomb.velocity.x / 6.25,
      107 - state.bomb.velocity.y / 6.25,
    );
  } else if (state.phase === "celebrating" && state.currentPlayer === player) {
    ctx.quadraticCurveTo(+44, 63, +28, 107);
  } else {
    ctx.quadraticCurveTo(+44, 45, +28, 12);
  }

  ctx.stroke();
}

function drawGorillaFace(player) {
  // Face
  ctx.fillStyle = settings.mode === "dark" ? "#dfd8c9" : "#f4d7bf";
  ctx.beginPath();
  ctx.arc(0, 63, 9, 0, 2 * Math.PI);
  ctx.moveTo(-3.5, 70);
  ctx.arc(-3.5, 70, 4, 0, 2 * Math.PI);
  ctx.moveTo(+3.5, 70);
  ctx.arc(+3.5, 70, 4, 0, 2 * Math.PI);
  ctx.fill();

  // Eyes
  ctx.fillStyle = player === 1 ? "#3fdae0" : "#ff759e";
  ctx.beginPath();
  ctx.arc(-3.5, 70, 1.4, 0, 2 * Math.PI);
  ctx.moveTo(+3.5, 70);
  ctx.arc(+3.5, 70, 1.4, 0, 2 * Math.PI);
  ctx.fill();

  ctx.strokeStyle = "#493c4c";
  ctx.lineWidth = 1.4;

  // Nose
  ctx.beginPath();
  ctx.moveTo(-3.5, 66.5);
  ctx.lineTo(-1.5, 65);
  ctx.moveTo(3.5, 66.5);
  ctx.lineTo(1.5, 65);
  ctx.stroke();

  // Mouth
  ctx.beginPath();
  if (state.phase === "celebrating" && state.currentPlayer === player) {
    ctx.moveTo(-5, 60);
    ctx.quadraticCurveTo(0, 56, 5, 60);
  } else {
    ctx.moveTo(-5, 56);
    ctx.quadraticCurveTo(0, 60, 5, 56);
  }
  ctx.stroke();
}

function drawGorillaThoughtBubbles(player) {
  if (state.phase === "aiming") {
    const currentPlayerIsComputer =
      (settings.numberOfPlayers === 0 &&
        state.currentPlayer === 1 &&
        player === 1) ||
      (settings.numberOfPlayers !== 2 &&
        state.currentPlayer === 2 &&
        player === 2);

    if (currentPlayerIsComputer) {
      ctx.save();
      ctx.scale(1, -1);

      ctx.font = "20px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("?", 0, -90);

      ctx.font = "10px sans-serif";

      ctx.rotate((5 / 180) * Math.PI);
      ctx.fillText("?", 0, -90);

      ctx.rotate((-10 / 180) * Math.PI);
      ctx.fillText("?", 0, -90);

      ctx.restore();
    }
  }
}

function drawBomb() {
  ctx.save();
  ctx.translate(state.bomb.x, state.bomb.y);

  if (state.phase === "aiming") {
    // Move the bomb with the mouse while aiming
    ctx.translate(-state.bomb.velocity.x / 6.25, -state.bomb.velocity.y / 6.25);

    // Draw throwing trajectory
    ctx.strokeStyle = "rgba(99, 244, 232, 0.84)";
    ctx.setLineDash([4, 8]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(state.bomb.velocity.x, state.bomb.velocity.y);
    ctx.stroke();

    // Draw circle
    ctx.shadowColor = "rgba(255, 201, 95, 0.82)";
    ctx.shadowBlur = 15;
    const bombGradient = ctx.createLinearGradient(-6, -6, 6, 6);
    bombGradient.addColorStop(0, "#fff3ad");
    bombGradient.addColorStop(1, "#ffad48");
    ctx.fillStyle = bombGradient;
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, 2 * Math.PI);
    ctx.fill();
    ctx.shadowBlur = 0;
  } else if (state.phase === "in flight") {
    // Draw rotated banana
    ctx.fillStyle = "#ffd15c";
    ctx.rotate(state.bomb.rotation);
    ctx.beginPath();
    ctx.moveTo(-8, -2);
    ctx.quadraticCurveTo(0, 12, 8, -2);
    ctx.quadraticCurveTo(0, 2, -8, -2);
    ctx.fill();
  } else {
    // Draw circle
    ctx.fillStyle = "white";
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, 2 * Math.PI);
    ctx.fill();
  }

  // Restore transformation
  ctx.restore();

  // Indicator showing if the bomb is above the screen
  if (state.bomb.y > window.innerHeight / state.scale) {
    ctx.beginPath();
    ctx.strokeStyle = "white";
    const distance = state.bomb.y - window.innerHeight / state.scale;
    ctx.moveTo(state.bomb.x, window.innerHeight / state.scale - 10);
    ctx.lineTo(state.bomb.x, window.innerHeight / state.scale - distance);
    ctx.moveTo(state.bomb.x, window.innerHeight / state.scale - 10);
    ctx.lineTo(state.bomb.x - 5, window.innerHeight / state.scale - 15);
    ctx.moveTo(state.bomb.x, window.innerHeight / state.scale - 10);
    ctx.lineTo(state.bomb.x + 5, window.innerHeight / state.scale - 15);
    ctx.stroke();
  }

  // Indicator showing the starting position of the bomb
  if (state.bomb.highlight) {
    ctx.beginPath();
    ctx.strokeStyle = "white";
    ctx.lineWidth = 2;
    ctx.moveTo(state.bomb.x, state.bomb.y + 20);
    ctx.lineTo(state.bomb.x, state.bomb.y + 120);
    ctx.moveTo(state.bomb.x, state.bomb.y + 20);
    ctx.lineTo(state.bomb.x - 5, state.bomb.y + 25);
    ctx.moveTo(state.bomb.x, state.bomb.y + 20);
    ctx.lineTo(state.bomb.x + 5, state.bomb.y + 25);
    ctx.stroke();
  }
}

// Event handlers
bombGrabAreaDOM.addEventListener("mousedown", function (e) {
  hideInstructions();
  if (state.phase === "aiming") {
    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    document.body.style.cursor = "grabbing";
  }
});

window.addEventListener("mousemove", function (e) {
  if (isDragging) {
    let deltaX = e.clientX - dragStartX;
    let deltaY = e.clientY - dragStartY;

    state.bomb.velocity.x = -deltaX;
    state.bomb.velocity.y = deltaY;
    setInfo(deltaX, deltaY);

    draw();
  }
});

// Set values on the info panel
function setInfo(deltaX, deltaY) {
  const hypotenuse = Math.sqrt(deltaX ** 2 + deltaY ** 2);
  const angleInRadians = Math.asin(deltaY / hypotenuse);
  const angleInDegrees = (angleInRadians / Math.PI) * 180;

  if (state.currentPlayer === 1) {
    angle1DOM.innerText = Math.round(angleInDegrees);
    velocity1DOM.innerText = Math.round(hypotenuse);
  } else {
    angle2DOM.innerText = Math.round(angleInDegrees);
    velocity2DOM.innerText = Math.round(hypotenuse);
  }
}

window.addEventListener("mouseup", function () {
  if (isDragging) {
    isDragging = false;
    document.body.style.cursor = "default";

    throwBomb();
  }
});

function computerThrow() {
  const numberOfSimulations = 2 + state.round * 3;
  const bestThrow = runSimulations(numberOfSimulations);

  initializeBombPosition();
  state.bomb.velocity.x = bestThrow.velocityX;
  state.bomb.velocity.y = bestThrow.velocityY;
  setInfo(bestThrow.velocityX, bestThrow.velocityY);

  // Draw the aiming gorilla
  draw();

  // Make it look like the computer is thinking for a second
  delayTimeoutID = setTimeout(throwBomb, 1000);
}

// Simulate multiple throws and pick the best
function runSimulations(numberOfSimulations) {
  let bestThrow = {
    velocityX: undefined,
    velocityY: undefined,
    distance: Infinity,
  };
  simulationMode = true;

  // Calculating the center position of the enemy
  const enemyBuilding =
    state.currentPlayer === 1
      ? state.buildings.at(-2) // Second last building
      : state.buildings.at(1); // Second building
  const enemyX = enemyBuilding.x + enemyBuilding.width / 2;
  const enemyY = enemyBuilding.height + 30;

  for (let i = 0; i < numberOfSimulations; i++) {
    // Pick a random angle and velocity
    const angleInDegrees = -10 + Math.random() * 100;
    const angleInRadians = (angleInDegrees / 180) * Math.PI;
    const velocity = 40 + Math.random() * 130;

    // Calculate the horizontal and vertical velocity
    const direction = state.currentPlayer === 1 ? 1 : -1;
    const velocityX = Math.cos(angleInRadians) * velocity * direction;
    const velocityY = Math.sin(angleInRadians) * velocity;

    initializeBombPosition();
    state.bomb.velocity.x = velocityX;
    state.bomb.velocity.y = velocityY;

    throwBomb();

    // Calculating the distance between the simulated impact and the enemy
    const distance = Math.sqrt(
      (enemyX - simulationImpact.x) ** 2 + (enemyY - simulationImpact.y) ** 2,
    );

    // If the current impact is closer to the enemy
    // than any of the previous simulations then pick this one
    if (distance < bestThrow.distance) {
      bestThrow = { velocityX, velocityY, distance };
    }
  }

  simulationMode = false;
  return bestThrow;
}

function throwBomb() {
  if (simulationMode) {
    previousAnimationTimestamp = 0;
    animate(16);
  } else {
    state.phase = "in flight";
    previousAnimationTimestamp = undefined;
    animationFrameRequestID = requestAnimationFrame(animate);
  }
}

function animate(timestamp) {
  if (previousAnimationTimestamp === undefined) {
    previousAnimationTimestamp = timestamp;
    animationFrameRequestID = requestAnimationFrame(animate);
    return;
  }

  const elapsedTime = timestamp - previousAnimationTimestamp;

  // We break down every animation cycle into 10 tiny movements for greater hit detection precision
  const hitDetectionPrecision = 10;
  for (let i = 0; i < hitDetectionPrecision; i++) {
    moveBomb(elapsedTime / hitDetectionPrecision);

    // Hit detection
    const miss = checkFrameHit() || checkBuildingHit(); // Bomb got off-screen or hit a building
    const hit = checkGorillaHit(); // Bomb hit the enemy

    if (simulationMode && (hit || miss)) {
      simulationImpact = { x: state.bomb.x, y: state.bomb.y };
      return; // Simulation ended, return from the loop
    }

    // Handle the case when we hit a building or the bomb got off-screen
    if (miss) {
      state.currentPlayer = state.currentPlayer === 1 ? 2 : 1; // Switch players
      if (state.currentPlayer === 1) state.round++;
      state.phase = "aiming";
      initializeBombPosition();

      draw();

      const computerThrowsNext =
        settings.numberOfPlayers === 0 ||
        (settings.numberOfPlayers === 1 && state.currentPlayer === 2);

      if (computerThrowsNext) setTimeout(computerThrow, 50);

      return;
    }

    // Handle the case when we hit the enemy
    if (hit) {
      state.phase = "celebrating";
      announceWinner();

      draw();
      return;
    }
  }

  if (!simulationMode) draw();

  // Continue the animation loop
  previousAnimationTimestamp = timestamp;
  if (simulationMode) {
    animate(timestamp + 16);
  } else {
    animationFrameRequestID = requestAnimationFrame(animate);
  }
}

function moveBomb(elapsedTime) {
  const multiplier = elapsedTime / 200;

  // Adjust trajectory by wind
  state.bomb.velocity.x += state.windSpeed * multiplier;

  // Adjust trajectory by gravity
  state.bomb.velocity.y -= 20 * multiplier;

  // Calculate new position
  state.bomb.x += state.bomb.velocity.x * multiplier;
  state.bomb.y += state.bomb.velocity.y * multiplier;

  // Rotate according to the direction
  const direction = state.currentPlayer === 1 ? -1 : +1;
  state.bomb.rotation += direction * 5 * multiplier;
}

function checkFrameHit() {
  // Stop throw animation once the bomb gets out of the left, bottom, or right edge of the screen
  if (
    state.bomb.y < 0 ||
    state.bomb.x < -state.shift / state.scale ||
    state.bomb.x > (window.innerWidth - state.shift) / state.scale
  ) {
    return true; // The bomb is off-screen
  }
}

function checkBuildingHit() {
  for (let i = 0; i < state.buildings.length; i++) {
    const building = state.buildings[i];
    if (
      state.bomb.x + 4 > building.x &&
      state.bomb.x - 4 < building.x + building.width &&
      state.bomb.y - 4 < 0 + building.height
    ) {
      // Check if the bomb is inside the blast hole of a previous impact
      for (let j = 0; j < state.blastHoles.length; j++) {
        const blastHole = state.blastHoles[j];

        // Check how far the bomb is from the center of a previous blast hole
        const horizontalDistance = state.bomb.x - blastHole.x;
        const verticalDistance = state.bomb.y - blastHole.y;
        const distance = Math.sqrt(
          horizontalDistance ** 2 + verticalDistance ** 2,
        );
        if (distance < blastHoleRadius) {
          // The bomb is inside of the rectangle of a building,
          // but a previous bomb already blew off this part of the building
          return false;
        }
      }

      if (!simulationMode) {
        state.blastHoles.push({ x: state.bomb.x, y: state.bomb.y });
      }
      return true; // Building hit
    }
  }
}

function checkGorillaHit() {
  const enemyPlayer = state.currentPlayer === 1 ? 2 : 1;
  const enemyBuilding =
    enemyPlayer === 1
      ? state.buildings.at(1) // Second building
      : state.buildings.at(-2); // Second last building

  ctx.save();

  ctx.translate(
    enemyBuilding.x + enemyBuilding.width / 2,
    enemyBuilding.height,
  );

  drawGorillaBody(enemyPlayer);
  let hit = ctx.isPointInPath(state.bomb.x, state.bomb.y);

  drawGorillaLeftArm(enemyPlayer);
  hit ||= ctx.isPointInStroke(state.bomb.x, state.bomb.y);

  drawGorillaRightArm(enemyPlayer);
  hit ||= ctx.isPointInStroke(state.bomb.x, state.bomb.y);

  ctx.restore();

  return hit;
}

function announceWinner() {
  if (settings.numberOfPlayers === 0) {
    winnerDOM.innerText = `Computer ${state.currentPlayer}`;
  } else if (settings.numberOfPlayers === 1 && state.currentPlayer === 1) {
    winnerDOM.innerText = `You`;
  } else if (settings.numberOfPlayers === 1 && state.currentPlayer === 2) {
    winnerDOM.innerText = `Computer`;
  } else {
    winnerDOM.innerText = `Player ${state.currentPlayer}`;
  }
  showCongratulations();
}

singlePlayerButtonDOM.forEach((button) =>
  button.addEventListener("click", () => {
    settings.numberOfPlayers = 1;
    gameModeDOM.innerHTML = "Player vs. Computer";
    name1DOM.innerText = "Player";
    name2DOM.innerText = "Computer";

    newGame();
  }),
);

twoPlayersButtonDOM.forEach((button) =>
  button.addEventListener("click", () => {
    settings.numberOfPlayers = 2;
    gameModeDOM.innerHTML = "Player vs. Player";
    name1DOM.innerText = "Player 1";
    name2DOM.innerText = "Player 2";

    newGame();
  }),
);

autoPlayButtonDOM.forEach((button) =>
  button.addEventListener("click", () => {
    settings.numberOfPlayers = 0;
    name1DOM.innerText = "Computer 1";
    name2DOM.innerText = "Computer 2";

    newGame();
  }),
);

function generateWindSpeed() {
  // Generate a random number between -10 and +10
  return -10 + Math.random() * 20;
}

function setWindMillRotation() {
  const rotationSpeed = Math.abs(50 / state.windSpeed);
  windmillHeadDOM.style.animationDirection =
    state.windSpeed > 0 ? "normal" : "reverse";
  windmillHeadDOM.style.animationDuration = `${rotationSpeed}s`;

  windSpeedDOM.innerText = Math.round(state.windSpeed);
}

window.addEventListener("mousemove", function (e) {
  settingsDOM.style.opacity = 1;
  info1DOM.style.opacity = 1;
  info2DOM.style.opacity = 1;
});

const enterFullscreen = document.getElementById("enter-fullscreen");
const exitFullscreen = document.getElementById("exit-fullscreen");

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen();
    enterFullscreen.setAttribute("stroke", "transparent");
    exitFullscreen.setAttribute("stroke", "white");
  } else {
    document.exitFullscreen();
    enterFullscreen.setAttribute("stroke", "white");
    exitFullscreen.setAttribute("stroke", "transparent");
  }
}
