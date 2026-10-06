import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, updateProfile, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, onSnapshot, collection, query, limit, orderBy, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const appId = typeof __app_id !== 'undefined' ? __app_id : 'neurostrike';

const firebaseConfig = {
  apiKey: "AIzaSyBlx-eaaSLRvbzdk3-ui7iPvFO_6VS_Jno",
  authDomain: "neurostrike-7bce9.firebaseapp.com",
  projectId: "neurostrike-7bce9",
  storageBucket: "neurostrike-7bce9.firebasestorage.app",
  messagingSenderId: "674741069536",
  appId: "1:674741069536:web:119fe721865c709b721285",
  measurementId: "G-FN6DZX1T76"
};

let app, db, auth, googleProvider;
let currentUser = null;
let playerName = "Player";
let playerPfp = "";
let globalLeaderboard = [];

let frameCount = 0;
let runningTotal1 = 0;
let runningTotal2 = 0;
let runningTotal3 = 0;
let gameState = 'menu';
let menuNumbers = [];
let playNumbers = [];
let mouseX = -1000;
let mouseY = -1000;
let currentDifficulty = '';
let highestUnlocked = 1; 
let currentLevel = 0;
let spawnedCount = 0;
let totalToSpawn = 0;
let popupTimer = null;
let tutorialMode = 'play';
let initialKeyPress = '';
let customSpeedMultiplier = 1.0;
let customDigits = 1;
let customColorMode = 'one';
let customSwap = false;
let customNeg = false;
let customCalc = false;
let customMaxScore = 0;
let answerTime = 0;

// Calculator State
let calcDisplay = '0';
let calcOperand = null;
let calcOperator = null;
let calcWaitingForNew = false;

window.updateCalcDisplay = function() {
    let el = document.getElementById('calc-display');
    if (el) el.innerText = calcDisplay;
}
window.inputCalcDigit = function(digit) {
    if (calcWaitingForNew) {
        calcDisplay = String(digit);
        calcWaitingForNew = false;
    } else {
        calcDisplay = calcDisplay === '0' ? String(digit) : calcDisplay + digit;
    }
    window.updateCalcDisplay();
}
window.inputCalcOperator = function(op) {
    let val = parseFloat(calcDisplay);
    if (calcOperator && !calcWaitingForNew) {
        let res = 0;
        if (calcOperator === '+') res = calcOperand + val;
        if (calcOperator === '-') res = calcOperand - val;
        if (calcOperator === '*') res = calcOperand * val;
        if (calcOperator === '/') res = calcOperand / val;
        calcDisplay = String(res);
        calcOperand = res;
    } else {
        calcOperand = val;
    }
    calcOperator = op;
    calcWaitingForNew = true;
    window.updateCalcDisplay();
}
window.calculateResult = function() {
    if (!calcOperator) return;
    let val = parseFloat(calcDisplay);
    let res = 0;
    if (calcOperator === '+') res = calcOperand + val;
    if (calcOperator === '-') res = calcOperand - val;
    if (calcOperator === '*') res = calcOperand * val;
    if (calcOperator === '/') res = calcOperand / val;
    calcDisplay = String(res);
    calcOperator = null;
    calcWaitingForNew = true;
    window.updateCalcDisplay();
}
window.clearCalc = function() {
    calcDisplay = '0';
    calcOperand = null;
    calcOperator = null;
    calcWaitingForNew = false;
    window.updateCalcDisplay();
}

try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            playerName = user.displayName || "Player_" + user.uid.substring(0, 4);
            playerPfp = user.photoURL || `https://placehold.co/45x45/222222/00ffff?text=${playerName.charAt(0).toUpperCase()}`;
            
            document.getElementById('account-name-input').value = playerName;
            
            if(!playerPfp.startsWith('data:image')) {
                document.getElementById('account-pfp-input').value = user.photoURL || "";
            }

            if (user.isAnonymous) {
                document.getElementById('btn-google-login').style.display = 'block';
                document.getElementById('user-profile-display').style.display = 'none';
            } else {
                document.getElementById('btn-google-login').style.display = 'none';
                document.getElementById('user-profile-display').style.display = 'flex';
                document.getElementById('display-name-text').innerText = playerName;
                document.getElementById('display-pfp-img').src = playerPfp;
            }

            const progRef = doc(db, 'artifacts', appId, 'users', user.uid, 'progress', 'data');
            const progSnap = await getDoc(progRef);
            if (progSnap.exists()) {
                highestUnlocked = progSnap.data().highestUnlocked || 1;
                updateMainMenuButtons();
            }

            const lbRef = collection(db, 'artifacts', appId, 'public', 'data', 'leaderboards');
            onSnapshot(lbRef, (snapshot) => {
                globalLeaderboard = [];
                snapshot.forEach(d => globalLeaderboard.push(d.data()));
                globalLeaderboard.sort((a, b) => b.score - a.score);
                updatePersistentLeaderboard();
            }, (err) => console.error("Snapshot error:", err));
        } else {
            signInAnonymously(auth).catch((error) => console.error("Anonymous auth failed", error));
            document.getElementById('btn-google-login').style.display = 'block';
            document.getElementById('user-profile-display').style.display = 'none';
        }
    });
} catch (error) {
    console.error("Firebase Init Failed:", error);
    document.getElementById('btn-google-login').style.display = 'block';
    document.getElementById('btn-google-login').innerText = 'Offline Mode';
}

document.getElementById('btn-google-login').addEventListener('click', async () => {
    if(!auth) return showPopup("Firebase not configured!");
    try {
        let savedProgress = highestUnlocked;
        const result = await signInWithPopup(auth, googleProvider);
        
        const progRef = doc(db, 'artifacts', appId, 'users', result.user.uid, 'progress', 'data');
        const progSnap = await getDoc(progRef);
        let cloudProgress = progSnap.exists() ? progSnap.data().highestUnlocked || 1 : 1;
        highestUnlocked = Math.max(savedProgress, cloudProgress);
        await setDoc(progRef, { highestUnlocked: highestUnlocked }, { merge: true });
        
        updateMainMenuButtons();
        showPopup("Logged in with Google!");
    } catch (error) {
        console.error("Login failed", error);
        showPopup("Login cancelled. Please try again.");
    }
});

document.getElementById('btn-logout').addEventListener('click', () => {
    if (auth) {
        auth.signOut().then(() => {
            window.location.reload();
        }).catch((error) => {
            showPopup("Error logging out.");
        });
    }
});

document.getElementById('user-profile-display').addEventListener('click', function() {
    document.getElementById('pfp-preview').style.display = 'none';
    showLayer('account-layer');
});
document.getElementById('btn-cancel-account').addEventListener('click', function() {
    showLayer('ui-layer');
});

document.getElementById('btn-upload-trigger').addEventListener('click', () => {
    document.getElementById('pfp-upload').click();
});

document.getElementById('pfp-upload').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { showPopup("File too large! Must be under 2MB."); return; }
    
    const reader = new FileReader();
    reader.onload = function(event) {
        const img = new Image();
        img.onload = function() {
            const pfpCanvas = document.getElementById('pfp-preview');
            const pCtx = pfpCanvas.getContext('2d');
            const size = Math.min(img.width, img.height);
            const sx = (img.width - size) / 2;
            const sy = (img.height - size) / 2;
            
            pCtx.clearRect(0, 0, 80, 80);
            pCtx.drawImage(img, sx, sy, size, size, 0, 0, 80, 80);
            
            const dataUrl = pfpCanvas.toDataURL('image/jpeg', 0.8);
            document.getElementById('account-pfp-input').value = dataUrl;
            pfpCanvas.style.display = 'block';
        }
        img.src = event.target.result;
    }
    reader.readAsDataURL(file);
});

document.getElementById('btn-save-account').addEventListener('click', async function() {
    let newName = document.getElementById('account-name-input').value.trim();
    let newPfp = document.getElementById('account-pfp-input').value.trim();
    
    if (newName.length > 0 && currentUser) {
        try {
            const lbSnap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'leaderboards'));
            let nameTaken = false;
            lbSnap.forEach(d => {
                let data = d.data();
                if (data.name && data.name.toLowerCase() === newName.toLowerCase() && d.id !== currentUser.uid) {
                    nameTaken = true;
                }
            });
            
            if (nameTaken) {
                showPopup("That name is already taken! Choose another.");
                return;
            }
            
            playerName = newName;
            playerPfp = newPfp || `https://placehold.co/45x45/222222/00ffff?text=${playerName.charAt(0).toUpperCase()}`;
            
            if (!newPfp.startsWith('data:image')) {
                await updateProfile(currentUser, { displayName: playerName, photoURL: newPfp }).catch(e => console.log(e));
            } else {
                await updateProfile(currentUser, { displayName: playerName }).catch(e => console.log(e));
            }
            
            document.getElementById('display-name-text').innerText = playerName;
            document.getElementById('display-pfp-img').src = playerPfp;
            
            const scoreDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'leaderboards', currentUser.uid);
            const snap = await getDoc(scoreDocRef);
            if(snap.exists()) {
                await setDoc(scoreDocRef, { name: playerName, pfp: playerPfp }, { merge: true });
            }
            
            showPopup("Profile updated!");
            showLayer('ui-layer');
            
        } catch(err) {
            showPopup("Error saving profile!");
            console.error(err);
        }
    }
});

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const author = "Yanxi Li (Eric)";

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

canvas.addEventListener('mousemove', function(e) {
    mouseX = e.clientX;
    mouseY = e.clientY;
});

window.showLayer = function(layerId) {
    document.getElementById('ui-layer').style.display = 'none';
    document.getElementById('sub-level-layer').style.display = 'none';
    document.getElementById('answer-layer').style.display = 'none';
    document.getElementById('tutorial-layer').style.display = 'none';
    document.getElementById('skip-layer').style.display = 'none';
    document.getElementById('custom-layer').style.display = 'none';
    document.getElementById('account-layer').style.display = 'none';
    if (layerId !== '') {
        document.getElementById(layerId).style.display = 'flex';
    }
}

function showPopup(msg) {
    let pLayer = document.getElementById('popup-layer');
    let toast = document.createElement('div');
    toast.className = 'toast-popup';
    toast.innerText = msg;
    pLayer.appendChild(toast);
    
    if (popupTimer !== null) clearTimeout(popupTimer);
    popupTimer = setTimeout(function() {
        let toasts = document.querySelectorAll('.toast-popup');
        for (let i = 0; i < toasts.length; i = i + 1) {
            toasts[i].style.opacity = '0';
        }
        setTimeout(function() { pLayer.innerHTML = ''; }, 500);
    }, 2500);
}

function getDifficultyBaseOffset() {
    let base = 0;
    if (currentDifficulty === 'Medium') { base = 3; }
    if (currentDifficulty === 'Hard') { base = 6; }
    if (currentDifficulty === 'Extreme') { base = 9; }
    if (currentDifficulty === 'Impossible') { base = 12; }
    if (currentDifficulty === 'Custom') { base = 15; }
    return base;
}

function updatePersistentLeaderboard() {
    let lbContainer = document.getElementById('persistent-leaderboard');
    if (!lbContainer) return;
    
    let htmlStr = "";
    let displayCount = Math.min(10, globalLeaderboard.length);
    if (displayCount === 0) {
        lbContainer.innerHTML = "<div style='color: #888; text-align: center;'>Processing...</div>";
        return;
    }
    for (let j = 0; j < displayCount; j = j + 1) {
        let entry = globalLeaderboard[j];
        let isUser = currentUser && entry.uid === currentUser.uid;
        let color = isUser ? '#00ff00' : 'white';
        let weight = isUser ? 'bold' : 'normal';
        let nameDisp = entry.name.length > 15 ? entry.name.substring(0, 14) + '...' : entry.name;
        let pfpUrl = entry.pfp || `https://placehold.co/30x30/222222/00ffff?text=${nameDisp.charAt(0).toUpperCase()}`;
        
        htmlStr += "<div style='color: " + color + "; font-weight: " + weight + "; font-size: 18px; display: flex; justify-content: space-between; align-items: center; padding: 4px 0;'>";
        htmlStr += "<div style='display: flex; align-items: center; gap: 10px;'>";
        htmlStr += "<img src='" + pfpUrl + "' style='width: 25px; height: 25px; border-radius: 50%; border: 1px solid " + color + "; object-fit: cover;'>";
        htmlStr += "<span>" + (j+1) + ". " + nameDisp + "</span>";
        htmlStr += "</div>";
        htmlStr += "<span>" + entry.score + "</span>";
        htmlStr += "</div>";
    }
    lbContainer.innerHTML = htmlStr;
}

function updateSubButtons() {
    let base = getDifficultyBaseOffset();
    let btn1 = document.getElementById('btn-sub-1');
    let btn2 = document.getElementById('btn-sub-2');
    let btn3 = document.getElementById('btn-sub-3');
    
    btn1.className = 'diff-btn sub-btn';
    btn2.className = 'diff-btn sub-btn';
    btn3.className = 'diff-btn sub-btn';
    
    if (highestUnlocked < base + 1) { btn1.classList.add('locked-btn'); }
    else if (highestUnlocked > base + 1) { btn1.classList.add('completed-btn'); }
    
    if (highestUnlocked < base + 2) { btn2.classList.add('locked-btn'); }
    else if (highestUnlocked > base + 2) { btn2.classList.add('completed-btn'); }
    
    if (highestUnlocked < base + 3) { btn3.classList.add('locked-btn'); }
    else if (highestUnlocked > base + 3) { btn3.classList.add('completed-btn'); }
}

function updateMainMenuButtons() {
    if (highestUnlocked > 3) { 
        document.getElementById('btn-medium').classList.remove('locked-btn'); 
        document.getElementById('btn-custom').classList.remove('locked-btn'); 
    }
    if (highestUnlocked > 6) { document.getElementById('btn-hard').classList.remove('locked-btn'); }
    if (highestUnlocked > 9) { document.getElementById('btn-extreme').classList.remove('locked-btn'); }
    if (highestUnlocked > 12) { document.getElementById('btn-impossible').classList.remove('locked-btn'); }
}

document.getElementById('btn-easy').addEventListener('click', function() {
    openSubMenu('Easy', '#00ff00');
});
document.getElementById('btn-medium').addEventListener('click', function() {
    if (highestUnlocked < 4) { showPopup("Complete Easy levels to unlock Medium!"); } else { openSubMenu('Medium', '#ffff00'); }
});
document.getElementById('btn-hard').addEventListener('click', function() {
    if (highestUnlocked < 7) { showPopup("Complete Medium levels to unlock Hard!"); } else { openSubMenu('Hard', '#ff8800'); }
});
document.getElementById('btn-extreme').addEventListener('click', function() {
    if (highestUnlocked < 10) { showPopup("Complete Hard levels to unlock Extreme!"); } else { openSubMenu('Extreme', '#ff0000'); }
});
document.getElementById('btn-impossible').addEventListener('click', function() {
    if (highestUnlocked < 13) { showPopup("Complete Extreme levels to unlock Impossible!"); } else { openSubMenu('Impossible', '#ff00ff'); }
});
document.getElementById('btn-custom').addEventListener('click', function() {
    if (highestUnlocked < 4) { 
        showPopup("Beat Easy mode to unlock Custom Level Editor!"); 
    } else { 
        showLayer('custom-layer'); 
        updateCustomScore(); 
        updatePersistentLeaderboard();
    }
});

document.getElementById('btn-close-custom').addEventListener('click', function() {
    showLayer('ui-layer');
});

function updateCustomScore() {
    let amtStr = document.getElementById('c-amount-input').value;
    let amount = parseInt(amtStr);
    if (isNaN(amount)) { amount = 15; }
    if (amount > 100) { amount = 100; document.getElementById('c-amount-input').value = 100; }
    if (amount < 3) { amount = 3; document.getElementById('c-amount-input').value = 3; }
    
    let slideVal = amount;
    if (slideVal > 30) { slideVal = 30; }
    document.getElementById('c-amount-slider').value = slideVal;
    document.getElementById('count-val').innerText = amount;
    
    let spd = parseFloat(document.getElementById('custom-speed').value);
    document.getElementById('speed-val').innerText = spd.toFixed(1);
    
    let dig = parseInt(document.getElementById('custom-digits').value);
    
    let base = amount * dig * 10; 
    let multi = 1.0;
    
    multi = multi + Math.pow(spd - 1.0, 1.5) * 0.8; 
    
    let cm = document.getElementById('custom-colormode').value;
    if (cm === 'decoys') { multi = multi + 0.3; } 
    if (cm === 'two') { multi = multi + 0.5; }
    if (cm === 'three') { multi = multi + 0.8; }
    
    if (document.getElementById('c-feat-swap').checked) { multi = multi + 0.6; }
    if (document.getElementById('c-feat-neg').checked) { multi = multi + 0.5; }
    if (document.getElementById('c-feat-calc').checked) { multi = multi * 0.1; }
    if (multi < 0.1) { multi = 0.1; }
    
    customMaxScore = Math.floor(base * multi);
    document.getElementById('custom-score-display').innerText = "Potential Score: " + customMaxScore + " pts";
}

let customInputs = ['c-amount-input', 'custom-speed', 'custom-digits', 'custom-colormode', 'c-feat-swap', 'c-feat-neg', 'c-feat-calc'];
for (let i = 0; i < customInputs.length; i = i + 1) {
    document.getElementById(customInputs[i]).addEventListener('input', updateCustomScore);
    document.getElementById(customInputs[i]).addEventListener('change', updateCustomScore);
}
document.getElementById('c-amount-slider').addEventListener('input', function() {
    document.getElementById('c-amount-input').value = this.value;
    updateCustomScore();
});

document.getElementById('btn-play-custom').addEventListener('click', function() {
    currentDifficulty = 'Custom';
    totalToSpawn = parseInt(document.getElementById('c-amount-input').value);
    customSpeedMultiplier = parseFloat(document.getElementById('custom-speed').value);
    customDigits = parseInt(document.getElementById('custom-digits').value);
    customColorMode = document.getElementById('custom-colormode').value;
    customSwap = document.getElementById('c-feat-swap').checked;
    customNeg = document.getElementById('c-feat-neg').checked;
    customCalc = document.getElementById('c-feat-calc').checked;
    currentLevel = 999;
    showLayer('');
    startPlaying();
});

function openSubMenu(diff, color) {
    showLayer('sub-level-layer');
    let sTitle = document.getElementById('sub-title');
    sTitle.innerText = diff + " Levels";
    sTitle.style.color = color;
    sTitle.style.textShadow = '0 0 10px ' + color;
    currentDifficulty = diff;
    updateSubButtons();
}

document.getElementById('btn-back').addEventListener('click', function() {
    showLayer('ui-layer');
});

function getTutorialText(diff) {
    if (diff === 'Easy') { return "Add all WHITE numbers."; }
    if (diff === 'Medium') { return "Add only GREEN numbers. Ignore RED numbers."; }
    if (diff === 'Hard') { return "Track GREEN sums and CYAN sums separately."; }
    if (diff === 'Extreme') { return "Track GREEN and CYAN sums. Numbers may change color at the center. Track the final number."; }
    if (diff === 'Impossible') { return "Track GREEN, CYAN, and PINK sums. Numbers may change color. Some numbers are negative."; }
    return "";
}

function showTutorial(diff, isInfo) {
    document.getElementById('tut-title').innerText = diff.toUpperCase() + " RULES";
    document.getElementById('tut-text').innerText = getTutorialText(diff);
    if (isInfo === true) {
        document.getElementById('tut-start').innerText = "Close";
        tutorialMode = 'info';
    } else {
        document.getElementById('tut-start').innerText = "I'm Ready";
        tutorialMode = 'play';
    }
    showLayer('tutorial-layer');
}

document.getElementById('btn-info').addEventListener('click', function() {
    showTutorial(currentDifficulty, true);
});

document.getElementById('tut-start').addEventListener('click', function() {
    if (tutorialMode === 'info') {
        showLayer('sub-level-layer');
    } else {
        showLayer('');
        startPlaying();
    }
});

const subBtns = document.querySelectorAll('.sub-btn');
for (let i = 0; i < subBtns.length; i = i + 1) {
    subBtns[i].addEventListener('click', function(e) {
        let btnText = e.target.innerText;
        let base = getDifficultyBaseOffset();
        if (btnText === "Level 1") {
            if (highestUnlocked < base + 1) { showPopup("Locked!"); return; }
            currentLevel = base + 1;
        } else if (btnText === "Level 2") {
            if (highestUnlocked < base + 2) { showPopup("Complete Level 1 to unlock!"); return; }
            currentLevel = base + 2;
        } else {
            if (highestUnlocked < base + 3) { showPopup("Complete Level 2 to unlock!"); return; }
            currentLevel = base + 3;
        }
        
        totalToSpawn = 3 + Math.floor(currentLevel * 0.8);
        if (currentLevel === base + 1 && highestUnlocked === base + 1) {
            showTutorial(currentDifficulty, false);
        } else {
            showLayer('');
            startPlaying();
        }
    });
}

function startPlaying() {
    gameState = 'playing';
    menuNumbers = [];
    playNumbers = [];
    runningTotal1 = 0;
    runningTotal2 = 0;
    runningTotal3 = 0;
    spawnedCount = 0;
    initialKeyPress = '';
    window.clearCalc();
}

window.addEventListener('keydown', function(e) {
    if (gameState === 'menu' && document.getElementById('custom-layer').style.display === 'flex' && e.key === 'Enter') {
        document.getElementById('btn-play-custom').click();
    }
    
    if (gameState === 'answered' && e.key === 'Enter') {
        if (Date.now() - answerTime < 300) { return; } 
        if (currentDifficulty === 'Custom' && document.getElementById('custom-menu-btn')) {
            document.getElementById('custom-menu-btn').click();
        } else {
            if (document.getElementById('next-btn')) { document.getElementById('next-btn').click(); }
            else if (document.getElementById('retry-btn')) { document.getElementById('retry-btn').click(); }
            else if (document.getElementById('menu-btn')) { document.getElementById('menu-btn').click(); }
        }
    }
    
    let isInputFocused = document.activeElement && document.activeElement.tagName === 'INPUT';
    let isCalcActive = (document.getElementById('calculator-widget').style.display === 'block');
    
    if (gameState === 'answering' && isCalcActive && !isInputFocused) {
        if (e.key >= '0' && e.key <= '9') window.inputCalcDigit(e.key);
        if (e.key === '+' || e.key === '-' || e.key === '*' || e.key === '/') window.inputCalcOperator(e.key);
        if (e.key === 'Enter' || e.key === '=') window.calculateResult();
        if (e.key === 'Escape' || e.key === 'c' || e.key === 'C' || e.key === 'Backspace') window.clearCalc();
    }
    
    if (gameState === 'playing') {
        if (spawnedCount >= totalToSpawn) {
            if ((e.key >= '0' && e.key <= '9') || e.key === '-' || e.key === 'Enter') {
                if (!isCalcActive) { 
                    if (e.key !== 'Enter') { initialKeyPress = e.key; }
                    playNumbers = [];
                }
            }
        }
        
        if (isCalcActive && !isInputFocused) {
            if (e.key >= '0' && e.key <= '9') window.inputCalcDigit(e.key);
            if (e.key === '+' || e.key === '-' || e.key === '*' || e.key === '/') window.inputCalcOperator(e.key);
            if (e.key === 'Enter' || e.key === '=') window.calculateResult();
            if (e.key === 'Escape' || e.key === 'c' || e.key === 'C' || e.key === 'Backspace') window.clearCalc();
        }
    }
});

document.getElementById('btn-skip').addEventListener('click', function() {
    if (gameState === 'playing' && spawnedCount >= totalToSpawn) {
        playNumbers = [];
    }
});

const colorPalette = [
    {r: 74, g: 85, b: 104},
    {r: 45, g: 55, b: 72},
    {r: 113, g: 128, b: 150},
    {r: 50, g: 38, b: 89},
    {r: 68, g: 51, b: 122}
];

class MenuNumber {
    constructor(startX) {
        this.value = Math.floor(Math.random() * 9) + 1;
        this.size = Math.random() * 80 + 20;
        this.x = startX || -150;
        this.y = Math.random() * (canvas.height + 50) - 20;
        this.speed = (120 - this.size) / 8;
        this.baseOpacity = this.size / 200;
        this.opacity = this.baseOpacity;
        let cIndex = Math.floor(Math.random() * colorPalette.length);
        this.baseR = colorPalette[cIndex].r;
        this.baseG = colorPalette[cIndex].g;
        this.baseB = colorPalette[cIndex].b;
        this.color = 'rgba(' + this.baseR + ',' + this.baseG + ',' + this.baseB + ',' + this.opacity + ')';
    }
    update() {
        this.x = this.x + this.speed;
        let dx = mouseX - this.x;
        let dy = mouseY - this.y;
        let dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < 400 && gameState === 'menu') {
            let intensity = 1 - (dist / 400);
            let r = Math.floor(this.baseR + (255 - this.baseR) * intensity);
            let g = Math.floor(this.baseG + (215 - this.baseG) * intensity);
            let b = Math.floor(this.baseB + (0 - this.baseB) * intensity);
            this.opacity = this.baseOpacity + (1 - this.baseOpacity) * intensity;
            this.color = 'rgba(' + r + ',' + g + ',' + b + ',' + this.opacity + ')';
        } else {
            this.opacity = this.baseOpacity;
            this.color = 'rgba(' + this.baseR + ',' + this.baseG + ',' + this.baseB + ',' + this.opacity + ')';
        }
    }
    draw() {
        ctx.fillStyle = this.color;
        ctx.font = 'bold ' + this.size + 'px Arial';
        ctx.fillText(this.value, this.x, this.y);
    }
}

class PlayNumber {
    constructor(isDecoy = false) {
        let edge = Math.floor(Math.random() * 4);
        if (edge === 0) { this.x = -250; this.y = Math.random() * canvas.height; } 
        else if (edge === 1) { this.x = Math.random() * canvas.width; this.y = -250; } 
        else if (edge === 2) { this.x = canvas.width + 250; this.y = Math.random() * canvas.height; } 
        else { this.x = Math.random() * canvas.width; this.y = canvas.height + 250; }
        
        let targetX = canvas.width / 2 + (Math.random() * 100 - 50);
        let targetY = canvas.height / 2 + (Math.random() * 100 - 50);
        let dx = targetX - this.x;
        let dy = targetY - this.y;
        let angle = Math.atan2(dy, dx);
        
        this.isNegative = false;
        this.hasSwitched = false;
        this.value = Math.floor(Math.random() * 9) + 1;
        
        let spdScale = (currentLevel === 999) ? (0.5 + customSpeedMultiplier * 0.2) : (0.5 + currentLevel * 0.15);
        let speed = (Math.random() * 4 + 3) * spdScale;
        this.size = Math.random() * 80 + 120; 
        
        if (isDecoy) {
            this.type = 0;
            this.color = (Math.random() > 0.5) ? '#ff0000' : '#ff4444'; 
            this.size = Math.random() * 120 + 60;
            speed = speed * (Math.random() * 1.5 + 0.8);
            this.vx = Math.cos(angle) * speed;
            this.vy = Math.sin(angle) * speed;
            
            if (currentLevel === 999) {
                if (customDigits === 2) { this.value = Math.floor(Math.random() * 90) + 10; }
                if (customDigits === 3) { this.value = Math.floor(Math.random() * 900) + 100; }
                if (customNeg && Math.random() > 0.5) { this.isNegative = true; }
            }
            return; 
        }
        
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        
        if (currentLevel === 999) {
            if (customDigits === 2) { this.value = Math.floor(Math.random() * 90) + 10; }
            if (customDigits === 3) { this.value = Math.floor(Math.random() * 900) + 100; }
            if (customNeg && Math.random() > 0.5) { this.isNegative = true; }
            
            if (customColorMode === 'one' || customColorMode === 'decoys') {
                this.color = customColorMode === 'one' ? 'white' : '#00ff00';
                this.type = 1;
            } else if (customColorMode === 'two') {
                let r = Math.random();
                if (r < 0.5) { this.color = '#00ff00'; this.type = 1; }
                else { this.color = '#00ffff'; this.type = 2; }
            } else if (customColorMode === 'three') {
                let r = Math.random();
                if (r < 0.33) { this.color = '#00ff00'; this.type = 1; }
                else if (r < 0.66) { this.color = '#00ffff'; this.type = 2; }
                else { this.color = '#ff00ff'; this.type = 3; }
            }
        } else if (currentDifficulty === 'Easy') {
            this.color = 'white'; this.type = 1;
        } else if (currentDifficulty === 'Medium') {
            this.color = '#00ff00'; this.type = 1;
        } else if (currentDifficulty === 'Hard' || currentDifficulty === 'Extreme') {
            if (Math.random() < 0.5) { this.color = '#00ff00'; this.type = 1; }
            else { this.color = '#00ffff'; this.type = 2; }
        } else if (currentDifficulty === 'Impossible') {
            let r = Math.random();
            if (r < 0.33) { this.color = '#00ff00'; this.type = 1; }
            else if (r < 0.66) { this.color = '#00ffff'; this.type = 2; }
            else { this.color = '#ff00ff'; this.type = 3; }
            if (Math.random() > 0.6) { this.isNegative = true; }
        }
        
        let mathVal = this.isNegative ? -this.value : this.value;
        if (this.type === 1) { runningTotal1 += mathVal; }
        if (this.type === 2) { runningTotal2 += mathVal; }
        if (this.type === 3) { runningTotal3 += mathVal; }
    }
    
    update() {
         this.x = this.x + this.vx;
         this.y = this.y + this.vy;
         
         let canSwitch = false;
         if (currentLevel === 999 && customSwap) { canSwitch = true; }
         if (currentDifficulty === 'Extreme' || currentDifficulty === 'Impossible') { canSwitch = true; }
         
         if (canSwitch && !this.hasSwitched && this.type !== 0) {
             let dx = this.x - canvas.width/2;
             let dy = this.y - canvas.height/2;
             if (Math.sqrt(dx*dx + dy*dy) < 120) {
                 this.hasSwitched = true;
                 if (Math.random() > 0.5) {
                     let mathVal = this.isNegative ? -this.value : this.value;
                     if (this.type === 1) { runningTotal1 -= mathVal; }
                     if (this.type === 2) { runningTotal2 -= mathVal; }
                     if (this.type === 3) { runningTotal3 -= mathVal; }
                     
                     let r2 = Math.random();
                     if (currentLevel === 999) {
                         if (customColorMode === 'two') {
                             if (r2 < 0.5) { this.color = '#00ff00'; this.type = 1; }
                             else { this.color = '#00ffff'; this.type = 2; }
                         } else if (customColorMode === 'three') {
                             if (r2 < 0.33) { this.color = '#00ff00'; this.type = 1; }
                             else if (r2 < 0.66) { this.color = '#00ffff'; this.type = 2; }
                             else { this.color = '#ff00ff'; this.type = 3; }
                         }
                     } else if (currentDifficulty === 'Extreme') {
                         if (r2 < 0.5) { this.color = '#00ff00'; this.type = 1; }
                         else { this.color = '#00ffff'; this.type = 2; }
                     } else {
                         if (r2 < 0.33) { this.color = '#00ff00'; this.type = 1; }
                         else if (r2 < 0.66) { this.color = '#00ffff'; this.type = 2; }
                         else { this.color = '#ff00ff'; this.type = 3; }
                     }
                     
                     if (this.type === 1) { runningTotal1 += mathVal; }
                     if (this.type === 2) { runningTotal2 += mathVal; }
                     if (this.type === 3) { runningTotal3 += mathVal; }
                 }
             }
         }
    }
    
    draw() {
        ctx.fillStyle = this.color;
        ctx.font = 'bold ' + this.size + 'px Arial';
        let drawStr = this.isNegative ? "-" + this.value : this.value;
        ctx.fillText(drawStr, this.x, this.y);
    }
}

function drawBackground() {
    let grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0, "#090910");
    grad.addColorStop(0.5, "#2a1052");
    grad.addColorStop(1, "#090910");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function gameLoop() {
    drawBackground();
    
    if (gameState === 'menu') {
        document.getElementById('calculator-widget').style.display = 'none';
        if (frameCount % 3 === 0) { menuNumbers.push(new MenuNumber()); }
        for (let i = 0; i < menuNumbers.length; i = i + 1) {
            menuNumbers[i].update();
            menuNumbers[i].draw();
        }
        menuNumbers = menuNumbers.filter(num => num.x < canvas.width + 150);
        
    } else if (gameState === 'playing') {
        
        if (currentLevel === 999 && customCalc) {
            document.getElementById('calculator-widget').style.display = 'block';
        } else {
            document.getElementById('calculator-widget').style.display = 'none';
        }
        
        let spawnRate = 75;
        if (currentLevel === 999) {
            spawnRate = Math.floor(60 / customSpeedMultiplier);
            if (spawnRate < 5) { spawnRate = 5; }
        }
        
        if (spawnedCount < totalToSpawn) {
            if (frameCount % spawnRate === 0) {
                playNumbers.push(new PlayNumber(false));
                spawnedCount++;
            }
            
            let spawnDecoy = false;
            if (currentLevel === 999) {
                if (customColorMode !== 'one' && Math.random() < (0.025 * customSpeedMultiplier)) { spawnDecoy = true; }
            } else if (currentDifficulty === 'Easy') {
                if (Math.random() < 0.01) { spawnDecoy = true; }
            } else {
                if (Math.random() < 0.02) { spawnDecoy = true; }
            }
            
            if (spawnDecoy) playNumbers.push(new PlayNumber(true));
            
        } else {
            document.getElementById('skip-layer').style.display = 'flex';
            if (playNumbers.length === 0) {
                gameState = 'answering';
                document.getElementById('skip-layer').style.display = 'none';
                showLayer('answer-layer');
                resetAnswerLayer();
            }
        }
        
       let nextPlayNumbers = [];
        for (let i = 0; i < playNumbers.length; i = i + 1) {
            playNumbers[i].update();
            playNumbers[i].draw();
            if (playNumbers[i].x > -400 && playNumbers[i].x < canvas.width + 400 && playNumbers[i].y > -400 && playNumbers[i].y < canvas.height + 400) {
                nextPlayNumbers.push(playNumbers[i]);
            }
        }
        playNumbers = nextPlayNumbers;
    }
    
    frameCount = frameCount + 1;
    requestAnimationFrame(gameLoop);
}

function resetAnswerLayer() {
    let ansLayer = document.getElementById('answer-layer');
    let htmlStr = "<h2>FINAL ANSWERS</h2><div>";
    
    let needs1 = false; let needs2 = false; let needs3 = false;
    
    if (currentLevel === 999) {
        needs1 = true;
        if (customColorMode === 'two') { needs2 = true; }
        if (customColorMode === 'three') { needs2 = true; needs3 = true; }
    } else {
        if (currentDifficulty === 'Easy' || currentDifficulty === 'Medium') { needs1 = true; }
        else if (currentDifficulty === 'Hard' || currentDifficulty === 'Extreme') { needs1 = true; needs2 = true; }
        else if (currentDifficulty === 'Impossible') { needs1 = true; needs2 = true; needs3 = true; }
    }
    
    if (needs1 && !needs2) {
        htmlStr = htmlStr + "<input type='number' id='ans1' class='ans-box' placeholder='Total' style='border-color: white;'>";
    } else {
        if (needs1) { htmlStr = htmlStr + "<input type='number' id='ans1' class='ans-box' placeholder='Green' style='border-color: #00ff00;'>"; }
        if (needs2) { htmlStr = htmlStr + "<input type='number' id='ans2' class='ans-box' placeholder='Cyan' style='border-color: #00ffff;'>"; }
        if (needs3) { htmlStr = htmlStr + "<input type='number' id='ans3' class='ans-box' placeholder='Pink' style='border-color: #ff00ff;'>"; }
    }
    
    htmlStr = htmlStr + "</div><div style='display: flex; gap: 10px;'><button id='submit-btn' class='diff-btn'>Submit</button></div>";
    ansLayer.innerHTML = htmlStr;
    
    document.getElementById('submit-btn').addEventListener('click', checkAnswer);
    
    let inputs = document.querySelectorAll('.ans-box');
    for (let i = 0; i < inputs.length; i = i + 1) {
        inputs[i].addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                let nextIdx = i + 1;
                if (nextIdx < inputs.length) {
                    inputs[nextIdx].focus();
                } else {
                    document.getElementById('submit-btn').click();
                }
            }
        });
    }
    
    if (document.getElementById('ans1')) { 
        document.getElementById('ans1').focus();
        if (initialKeyPress !== '') {
            document.getElementById('ans1').value = initialKeyPress;
            initialKeyPress = '';
        }
    }
}

async function checkAnswer() {
    answerTime = Date.now();
    document.getElementById('calculator-widget').style.display = 'none'; 
    let v1 = parseInt(document.getElementById('ans1') ? document.getElementById('ans1').value : 0) || 0;
    let v2 = parseInt(document.getElementById('ans2') ? document.getElementById('ans2').value : 0) || 0;
    let v3 = parseInt(document.getElementById('ans3') ? document.getElementById('ans3').value : 0) || 0;
    
    let ansLayer = document.getElementById('answer-layer');
    
    if (currentLevel === 999) {
        let diff1 = Math.abs(v1 - runningTotal1);
        let diff2 = (customColorMode === 'two' || customColorMode === 'three') ? Math.abs(v2 - runningTotal2) : 0;
        let diff3 = customColorMode === 'three' ? Math.abs(v3 - runningTotal3) : 0;
        
        let totalDiff = diff1 + diff2 + diff3;
        
        let earned = 0;
        if (totalDiff === 0) { earned = customMaxScore; }
        else if (totalDiff === 1) { earned = Math.floor(customMaxScore / 2); }
        else if (totalDiff === 2) { earned = Math.floor(customMaxScore / 4); }
        else { earned = 0; }

        let htmlStr = "<h2 style='color: #00ffff; text-shadow: 0 0 10px #00ffff; margin-bottom: 5px;'>CUSTOM RESULT</h2>";
        if (totalDiff === 0) { 
            htmlStr += "<h3 style='color: #00ff00; margin-top: 0;'>Perfect!</h3>"; 
        } else { 
            htmlStr += "<h3 style='color: #ffaa00; margin-top: 0;'>Off by " + totalDiff + "</h3>"; 
            
            let correctText = "Correct: " + runningTotal1;
            if (customColorMode === 'two') correctText = "Correct -> Grn: " + runningTotal1 + " | Cy: " + runningTotal2;
            if (customColorMode === 'three') correctText = "Correct -> Grn: " + runningTotal1 + " | Cy: " + runningTotal2 + " | Pk: " + runningTotal3;
            htmlStr += "<p style='color: #aaa; margin-top: 0; margin-bottom: 15px; font-size: 18px;'>" + correctText + "</p>";
        }
        
        htmlStr += "<p style='color: white; font-size: 24px; margin-top: 0;'>Points Earned: " + earned + " / " + customMaxScore + "</p>";
        
        if (currentUser && earned > 0 && db) {
            const scoreDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'leaderboards', currentUser.uid);
            const snap = await getDoc(scoreDocRef);
            if (!snap.exists() || snap.data().score < earned) {
                await setDoc(scoreDocRef, { name: playerName, pfp: playerPfp, score: earned, uid: currentUser.uid });
            }
        }
        
        globalLeaderboard.sort(function(a, b) { return b.score - a.score; });
        let userRank = globalLeaderboard.findIndex(entry => entry.uid === (currentUser ? currentUser.uid : null)) + 1;
        if (userRank === 0) userRank = "N/A";

        htmlStr += "<div style='background: #111; padding: 20px 40px; border: 2px solid #ff00ff; border-radius: 10px; margin-bottom: 15px; width: 450px;'>";
        htmlStr += "<h3 style='margin-top: 0; margin-bottom: 15px; color: #ff00ff; font-size: 24px; text-align: center;'>TRIAL LEADERBOARD</h3>";
        
        let displayCount = Math.min(10, globalLeaderboard.length);
        let userInTop10 = false;
        
        if (displayCount === 0) {
            htmlStr += "<div style='color: #888; text-align: center;'>Processing...</div>";
        }
        
        for (let j = 0; j < displayCount; j++) {
            let entry = globalLeaderboard[j];
            let isUser = currentUser && entry.uid === currentUser.uid;
            if (isUser) userInTop10 = true;
            let color = isUser ? '#00ff00' : 'white';
            let weight = isUser ? 'bold' : 'normal';
            let nameDisp = entry.name.length > 15 ? entry.name.substring(0, 14) + '...' : entry.name;
            let pfpUrl = entry.pfp || `https://placehold.co/30x30/222222/00ffff?text=${nameDisp.charAt(0).toUpperCase()}`;
            
            htmlStr += "<div style='color: " + color + "; font-weight: " + weight + "; font-size: 20px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;'>";
            htmlStr += "<div style='display: flex; align-items: center; gap: 12px;'>";
            htmlStr += "<img src='" + pfpUrl + "' style='width: 30px; height: 30px; border-radius: 50%; border: 1px solid " + color + "; object-fit: cover;'>";
            htmlStr += "<span>" + (j+1) + ". " + nameDisp + "</span>";
            htmlStr += "</div>";
            htmlStr += "<span>" + entry.score + "</span>";
            htmlStr += "</div>";
        }
        htmlStr += "</div>";
        
        if (!userInTop10 && userRank !== "N/A") {
             htmlStr += "<div style='color: #00ff00; font-weight: bold; font-size: 22px; margin-bottom: 25px; text-shadow: 0 0 5px #00ff00;'>Your Rank: #" + userRank + "</div>";
        } else {
             htmlStr += "<div style='height: 25px; margin-bottom: 25px;'></div>";
        }
        
        htmlStr += "<div style='display: flex; gap: 15px;'>";
        htmlStr += "<button id='retry-custom-btn' class='diff-btn'>Try Again</button>";
        htmlStr += "<button id='custom-menu-btn' class='diff-btn'>Custom Menu</button>";
        htmlStr += "<button id='menu-btn' class='diff-btn'>Main Menu</button></div>";
        ansLayer.innerHTML = htmlStr;
        
        document.getElementById('retry-custom-btn').addEventListener('click', function() {
            showLayer(''); startPlaying();
        });
        document.getElementById('custom-menu-btn').addEventListener('click', function() {
            showLayer('custom-layer'); gameState = 'menu';
        });
        
    } else {
        let isCorrect = false;
        let correctText = "";
        
        if (currentDifficulty === 'Easy' || currentDifficulty === 'Medium') {
            isCorrect = (v1 === runningTotal1);
            correctText = "The total was " + runningTotal1;
        } else if (currentDifficulty === 'Hard' || currentDifficulty === 'Extreme') {
            isCorrect = (v1 === runningTotal1 && v2 === runningTotal2);
            correctText = "Green: " + runningTotal1 + " | Cyan: " + runningTotal2;
        } else {
            isCorrect = (v1 === runningTotal1 && v2 === runningTotal2 && v3 === runningTotal3);
            correctText = "Green: " + runningTotal1 + " | Cyan: " + runningTotal2 + " | Pink: " + runningTotal3;
        }
        
        if (isCorrect) {
            if (currentLevel === highestUnlocked) {
                highestUnlocked = highestUnlocked + 1;
                let base = getDifficultyBaseOffset();
                if (highestUnlocked === base + 4) {
                    showPopup("New Difficulty Unlocked!");
                }
                updateMainMenuButtons();
                
                if (currentUser && db) {
                    const progRef = doc(db, 'artifacts', appId, 'users', currentUser.uid, 'progress', 'data');
                    setDoc(progRef, { highestUnlocked: highestUnlocked }, { merge: true });
                }
            }
            
            let htmlStr = "<h2 style='color: #00ff00; text-shadow: 0 0 10px #00ff00;'>CORRECT!</h2>";
            htmlStr += "<p style='color: white; font-size: 24px;'>" + correctText + "</p>";
            htmlStr += "<div style='display: flex; gap: 15px; margin-top: 20px;'>";
            if (currentLevel % 3 !== 0) { htmlStr += "<button id='next-btn' class='diff-btn'>Next Level</button>"; }
            htmlStr += "<button id='menu-btn' class='diff-btn'>Main Menu</button></div>";
            ansLayer.innerHTML = htmlStr;
        } else {
            let htmlStr = "<h2 style='color: #ff0000; text-shadow: 0 0 10px #ff0000;'>INCORRECT!</h2>";
            htmlStr += "<p style='color: white; font-size: 24px;'>" + correctText + "</p>";
            htmlStr += "<div style='display: flex; gap: 15px; margin-top: 20px;'><button id='retry-btn' class='diff-btn'>Try Again</button>";
            htmlStr += "<button id='menu-btn' class='diff-btn'>Main Menu</button></div>";
            ansLayer.innerHTML = htmlStr;
        }
    }
    
    if (document.getElementById('next-btn')) {
        document.getElementById('next-btn').addEventListener('click', function() {
            currentLevel = currentLevel + 1;
            totalToSpawn = 3 + Math.floor(currentLevel * 0.8);
            showLayer(''); startPlaying();
        });
    }
    if (document.getElementById('retry-btn')) {
        document.getElementById('retry-btn').addEventListener('click', function() {
            showLayer(''); startPlaying();
        });
    }
    if (document.getElementById('menu-btn')) {
        document.getElementById('menu-btn').addEventListener('click', function() {
            gameState = 'menu'; showLayer('ui-layer');
            menuNumbers = [];
            for (let i = 0; i < 70; i = i + 1) { menuNumbers.push(new MenuNumber(Math.random() * canvas.width)); }
        });
    }
    gameState = 'answered';
}

for (let i = 0; i < 70; i = i + 1) {
    menuNumbers.push(new MenuNumber(Math.random() * canvas.width));
}

gameLoop();