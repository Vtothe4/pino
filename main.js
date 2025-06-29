import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

let scene, camera, renderer, labelRenderer, controls;
const pianoKeys = [];
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

const room = new WebsimSocket();

const pressedSequence = [];
const secretSequence = ['D2', 'D2', 'D3', 'A2']; // Updated sequence for new format
let projectId;

// --- Sound ---
let audioContext;
let keyPressBuffer;

async function setupAudio() {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const response = await fetch('key-press.mp3');
    const arrayBuffer = await response.arrayBuffer();
    keyPressBuffer = await audioContext.decodeAudioData(arrayBuffer);
}

function playSound(buffer, semitones = 0) {
    if (!audioContext || !buffer) return;
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    
    // Calculate playback rate for pitch shifting
    source.playbackRate.value = Math.pow(2, semitones / 12);

    source.connect(audioContext.destination);
    source.start(0);
}

// --- Init ---
async function init() {
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x3a3a4a);

    // Camera
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 30, 40);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    // Label Renderer
    labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(window.innerWidth, window.innerHeight);
    labelRenderer.domElement.style.position = 'absolute';
    labelRenderer.domElement.style.top = '0px';
    labelRenderer.domElement.style.pointerEvents = 'none';
    document.body.appendChild(labelRenderer.domElement);

    // Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0, 0);
    controls.update();

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(5, 20, 10);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    scene.add(directionalLight);
    
    // Floor
    const floorGeo = new THREE.PlaneGeometry(200, 200);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x2d2d3a, roughness: 0.8 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -5;
    floor.receiveShadow = true;
    scene.add(floor);


    createPiano();
    await setupAudio();
    setupMultiplayer();
    setupComments();

    window.addEventListener('resize', onWindowResize, false);
    renderer.domElement.addEventListener('mousedown', onMouseDown, false);
    window.addEventListener('keydown', onKeyDown, false);
}

function createPiano() {
    const whiteKeyWidth = 4;
    const whiteKeyHeight = 2;
    const whiteKeyDepth = 15;
    const blackKeyWidth = whiteKeyWidth * 0.6;
    const blackKeyHeight = whiteKeyHeight * 1.1;
    const blackKeyDepth = whiteKeyDepth * 0.6;

    const whiteKeyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
    const blackKeyMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5 });

    // Standard piano note order from C2 to C7 (5 octaves)
    const keyData = [
        { name: 'C2', type: 'white' }, { name: 'C#2', type: 'black' }, { name: 'D2', type: 'white' },
        { name: 'D#2', type: 'black' }, { name: 'E2', type: 'white' }, { name: 'F2', type: 'white' },
        { name: 'F#2', type: 'black' }, { name: 'G2', type: 'white' }, { name: 'G#2', type: 'black' },
        { name: 'A2', type: 'white' }, { name: 'A#2', type: 'black' }, { name: 'B2', type: 'white' },
        
        { name: 'C3', type: 'white' }, { name: 'C#3', type: 'black' }, { name: 'D3', type: 'white' },
        { name: 'D#3', type: 'black' }, { name: 'E3', type: 'white' }, { name: 'F3', type: 'white' },
        { name: 'F#3', type: 'black' }, { name: 'G3', type: 'white' }, { name: 'G#3', type: 'black' },
        { name: 'A3', type: 'white' }, { name: 'A#3', type: 'black' }, { name: 'B3', type: 'white' },
        
        { name: 'C4', type: 'white' }, { name: 'C#4', type: 'black' }, { name: 'D4', type: 'white' },
        { name: 'D#4', type: 'black' }, { name: 'E4', type: 'white' }, { name: 'F4', type: 'white' },
        { name: 'F#4', type: 'black' }, { name: 'G4', type: 'white' }, { name: 'G#4', type: 'black' },
        { name: 'A4', type: 'white' }, { name: 'A#4', type: 'black' }, { name: 'B4', type: 'white' },
        
        { name: 'C5', type: 'white' }, { name: 'C#5', type: 'black' }, { name: 'D5', type: 'white' },
        { name: 'D#5', type: 'black' }, { name: 'E5', type: 'white' }, { name: 'F5', type: 'white' },
        { name: 'F#5', type: 'black' }, { name: 'G5', type: 'white' }, { name: 'G#5', type: 'black' },
        { name: 'A5', type: 'white' }, { name: 'A#5', type: 'black' }, { name: 'B5', type: 'white' },
        
        { name: 'C6', type: 'white' }, { name: 'C#6', type: 'black' }, { name: 'D6', type: 'white' },
        { name: 'D#6', type: 'black' }, { name: 'E6', type: 'white' }, { name: 'F6', type: 'white' },
        { name: 'F#6', type: 'black' }, { name: 'G6', type: 'white' }, { name: 'G#6', type: 'black' },
        { name: 'A6', type: 'white' }, { name: 'A#6', type: 'black' }, { name: 'B6', type: 'white' },
        
        { name: 'C7', type: 'white' }
    ];
    
    const validKeyNames = new Set(keyData.map(k => k.name));
    window.validKeyNames = validKeyNames; // Make it accessible in comment helpers

    let whiteKeyX = - (36 * whiteKeyWidth) / 2; // 36 white keys total

    keyData.forEach((keyInfo, index) => {
        let keyMesh;
        let isBlack = keyInfo.type === 'black';

        if (isBlack) {
            const geometry = new THREE.BoxGeometry(blackKeyWidth, blackKeyHeight, blackKeyDepth);
            keyMesh = new THREE.Mesh(geometry, blackKeyMat);
            keyMesh.position.set(whiteKeyX - whiteKeyWidth / 2, blackKeyHeight/2, -(whiteKeyDepth - blackKeyDepth) / 2);
            keyMesh.position.z += 0.1;
            keyMesh.position.y += 0.1;
        } else {
            const geometry = new THREE.BoxGeometry(whiteKeyWidth, whiteKeyHeight, whiteKeyDepth);
            keyMesh = new THREE.Mesh(geometry, whiteKeyMat);
            keyMesh.position.set(whiteKeyX, 0, 0);
            whiteKeyX += whiteKeyWidth;
        }
        
        keyMesh.castShadow = true;
        keyMesh.receiveShadow = true;
        keyMesh.userData.name = keyInfo.name;
        keyMesh.userData.isKey = true;
        keyMesh.userData.originalY = keyMesh.position.y;
        // Calculate semitone offset from C4 (middle C)
        keyMesh.userData.pitchIndex = index - 24; // C4 is at index 24
        scene.add(keyMesh);
        pianoKeys.push(keyMesh);

        // Label
        const labelDiv = document.createElement('div');
        labelDiv.className = 'key-label' + (isBlack ? ' black' : '');
        labelDiv.textContent = keyInfo.name;
        const keyLabel = new CSS2DObject(labelDiv);
        keyLabel.position.set(0, -whiteKeyHeight / 2, whiteKeyDepth / 2 - 1);
        keyMesh.add(keyLabel);
    });
}

function performKeyPress(keyObject) {
    if (!keyObject) return;
    playSound(keyPressBuffer, keyObject.userData.pitchIndex);

    // Prevent re-triggering animation if already pressed
    if (keyObject.userData.isPressed) return;
    keyObject.userData.isPressed = true;

    const originalY = keyObject.userData.originalY;
    keyObject.position.y = originalY - 0.5;
    setTimeout(() => {
        keyObject.position.y = originalY;
        keyObject.userData.isPressed = false;
    }, 150);
}

function onLocalKeyPress(keyObject) {
    if (!keyObject) return;
    
    performKeyPress(keyObject);

    // Broadcast to other players
    room.send({
        type: 'key-press',
        keyName: keyObject.userData.name,
        echo: false // Don't send to self
    });

    // Easter egg check (local only)
    pressedSequence.push(keyObject.userData.name);
    if (pressedSequence.length > secretSequence.length) {
        pressedSequence.shift();
    }

    if (JSON.stringify(pressedSequence) === JSON.stringify(secretSequence)) {
        triggerEasterEgg();
    }
}

function triggerEasterEgg() {
    const dogContainer = document.getElementById('dog-container');
    dogContainer.style.display = 'block';
    
    let start = null;
    const duration = 2500; // ms

    function animateDog(timestamp) {
        if (!start) start = timestamp;
        const progress = (timestamp - start) / duration;
        
        if (progress < 1) {
            const screenWidth = window.innerWidth;
            const dogWidth = 200;
            dogContainer.style.left = `${-dogWidth + (screenWidth + dogWidth) * progress}px`;
            requestAnimationFrame(animateDog);
        } else {
            // Delete the entire page content
            document.body.innerHTML = '';
        }
    }
    requestAnimationFrame(animateDog);
}

function onMouseDown(event) {
    if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume();
    }

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObjects(pianoKeys);

    if (intersects.length > 0) {
        const intersectedObject = intersects[0].object;
        if (intersectedObject.userData.isKey) {
            onLocalKeyPress(intersectedObject);
        }
    }
}

function onKeyDown(event) {
    // Roblox piano key mappings (LIMITED version for better compatibility)
    const keyMap = {
        '1': 'C2', '!': 'C#2', '2': 'D2', '@': 'D#2', '3': 'E2', '4': 'F2', '$': 'F#2', '5': 'G2', '%': 'G#2', '6': 'A2', '^': 'A#2', '7': 'B2',
        '8': 'C3', '*': 'C#3', '9': 'D3', '(': 'D#3', '0': 'E3', 'q': 'F3', 'Q': 'F#3', 'w': 'G3', 'W': 'G#3', 'e': 'A3', 'E': 'A#3', 'r': 'B3',
        't': 'C4', 'T': 'C#4', 'y': 'D4', 'Y': 'D#4', 'u': 'E4', 'i': 'F4', 'I': 'F#4', 'o': 'G4', 'O': 'G#4', 'p': 'A4', 'P': 'A#4', 'a': 'B4',
        's': 'C5', 'S': 'C#5', 'd': 'D5', 'D': 'D#5', 'f': 'E5', 'g': 'F5', 'G': 'F#5', 'h': 'G5', 'H': 'G#5', 'j': 'A5', 'J': 'A#5', 'k': 'B5',
        'l': 'C6', 'L': 'C#6', 'z': 'D6', 'Z': 'D#6', 'x': 'E6', 'c': 'F6', 'C': 'F#6', 'v': 'G6', 'V': 'G#6', 'b': 'A6', 'B': 'A#6', 'n': 'B6',
        'm': 'C7'
    };
    
    const keyName = keyMap[event.key];
    if (keyName) {
        const keyObject = pianoKeys.find(k => k.userData.name === keyName);
        if (keyObject) {
            onLocalKeyPress(keyObject);
        }
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    labelRenderer.setSize(window.innerWidth, window.innerHeight);
}

async function setupMultiplayer() {
    await room.initialize();

    room.onmessage = (event) => {
        const data = event.data;
        if (data.type === 'key-press') {
            const keyObject = pianoKeys.find(k => k.userData.name === data.keyName);
            if (keyObject) {
                performKeyPress(keyObject);
            }
        }
    };

    room.subscribePresence(() => {
        updateUserList();
    });

    updateUserList(); // Initial render
}

function updateUserList() {
    const userListDiv = document.getElementById('user-list');
    if (!userListDiv) return;

    // Clear previous list
    userListDiv.innerHTML = '<h3>Online</h3>';

    const peers = room.peers;
    for (const clientId in peers) {
        const peer = peers[clientId];
        const userDiv = document.createElement('div');
        userDiv.className = 'user-item';

        const avatarImg = document.createElement('img');
        avatarImg.src = peer.avatarUrl;
        avatarImg.alt = `${peer.username}'s avatar`;
        avatarImg.className = 'user-avatar';

        const nameSpan = document.createElement('span');
        nameSpan.textContent = peer.username;
        nameSpan.className = 'user-name';

        userDiv.appendChild(avatarImg);
        userDiv.appendChild(nameSpan);
        userListDiv.appendChild(userDiv);
    }
}

// --- Comments & Music Sheets ---

async function setupComments() {
    try {
        const project = await window.websim.getCurrentProject();
        projectId = project.id;

        loadComments();

        const postBtn = document.getElementById('post-comment-btn');
        const commentInput = document.getElementById('comment-input');

        postBtn.addEventListener('click', async () => {
            const content = commentInput.value.trim();
            if (content && !postBtn.disabled) {
                postBtn.disabled = true;
                postBtn.textContent = 'Posting...';
                const result = await window.websim.postComment({ content });
                if (result && result.error) {
                    console.error("Failed to post comment:", result.error);
                } else {
                    commentInput.value = '';
                }
                postBtn.disabled = false;
                postBtn.textContent = 'Post';
            }
        });

        window.websim.addEventListener('comment:created', (data) => {
            // Check if comment already exists to avoid duplicates from optimistic updates
            if (!document.getElementById(`comment-${data.comment.id}`)) {
                 addCommentToUI(data.comment, true); // Prepend new comment
            }
        });

    } catch (e) {
        console.error("Could not set up comments section:", e);
        const commentsSection = document.getElementById('comments-section');
        if(commentsSection) commentsSection.style.display = 'none';
    }
}

async function loadComments() {
    if (!projectId) return;
    const response = await fetch(`/api/v1/projects/${projectId}/comments?sort_by=created_at&sort_order=desc&first=20`);
    const data = await response.json();
    const commentsContainer = document.getElementById('comments-container');
    commentsContainer.innerHTML = ''; // Clear existing
    // API returns newest first, so we don't need to reverse.
    data.comments.data.forEach(commentData => {
        addCommentToUI(commentData.comment, false); // Append
    });
}

function addCommentToUI(comment, prepend = false) {
    if (comment.deleted) return;

    const commentsContainer = document.getElementById('comments-container');
    const commentItem = document.createElement('div');
    commentItem.className = 'comment-item';
    commentItem.id = `comment-${comment.id}`;

    const author = comment.author;
    const content = comment.raw_content || '';
    
    const parsedContent = DOMPurify.sanitize(marked.parse(content), {USE_PROFILES: {html: true}});

    const noteSequence = content.toLowerCase().split(/[\s,]+/).filter(note => window.validKeyNames.has(note));

    if (noteSequence.length > 0) {
        commentItem.classList.add('playable');
        commentItem.title = "Click to play this tune!";
    }
    
    commentItem.innerHTML = `
        <div class="comment-header">
            <img src="https://images.websim.com/avatar/${author.username}" alt="${author.username}" class="comment-avatar">
            <span class="comment-author">${author.username}</span>
        </div>
        <div class="comment-content">${parsedContent}</div>
    `;

    if (prepend) {
        commentsContainer.prepend(commentItem);
        // scroll to top after prepending
        commentsContainer.scrollTop = 0;
    } else {
        commentsContainer.appendChild(commentItem);
    }

    if (noteSequence.length > 0) {
        commentItem.addEventListener('click', (e) => {
            // Prevent playing if user is trying to select text or click a link
            if (window.getSelection().toString().length > 0 || e.target.closest('a')) {
                return;
            }
            playSequence(noteSequence);
        });
    }
}

function playSequence(notes) {
    if (!notes || notes.length === 0) return;
    
    let delay = 0;
    const noteDuration = 350; // ms between notes

    notes.forEach(noteName => {
        setTimeout(() => {
            const keyObject = pianoKeys.find(k => k.userData.name === noteName.trim());
            if (keyObject) {
                performKeyPress(keyObject);
            }
        }, delay);
        delay += noteDuration;
    });
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
}

init();
animate();