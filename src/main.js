import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { loadModels, loadFBXModel } from './modelLoader.js';
import { ajouterExempleDeModele } from './exemple.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Variables globales
let scene, camera, renderer, controls;
let character, characterGroup, characterAnimation, mixer;
let spellAction, runAction, idleAction; // Variables pour les animations
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
let lastDirection = new THREE.Vector3(0, 0, 1);
let spawnFireballInterval;
let characterSpeed = 0.06;
let fireballCooldown = 500; // Délai en millisecondes entre chaque boule de feu
let lastFireballTime = 0;
let fireballs = [];
let fireballGroup = new THREE.Group();
let obstacleObjects = [];
let score = 0;
let waveNumber = 0;
let enemies = [];
let gameStarted = false;
let isPaused = false;
let characterHealth = 100;
let currentTimeScale = 1;
let isInverted = false;
let showBones = false;
let animationFrameId = null;
let gameOver = false;
let isMainMenuVisible = true; // Menu principal visible au démarrage
let mainMenuElement = null, mapSelectionElement = null;
let controlsElement, aboutElement; // Variables pour les écrans de contrôles et à propos
let selectedSpell = 'fireball';
let keysPressed = {};
let optionsDialogElement;
let currentMapType = 'forest'; // Type de map actuelle (forest, desert, cave)
let unlockedMaps = ['forest']; // Maps débloquées (au début seulement la forêt)
let mapHighScores = { forest: 0, desert: 0, cave: 0 }; // Meilleurs scores par map
const MAP_UNLOCK_THRESHOLDS = { desert: 5000, cave: 10000 }; // Seuils de déblocage
const ANIMATION_DELTA = 0.016; // Temps delta fixe pour les animations (environ 60 FPS)

// Préchargement des modèles et animations d'ennemis
let enemyModelCache = null;
let enemyRunAnimationCache = null;
let isEnemyModelLoading = false;
let enemyLoadingQueue = 0;
let isLoadingModels = false;

// Variables de vie du joueur
let playerHealth = 100; // Points de vie maximum
let currentHealth = playerHealth;
let isPlayerInvulnerable = false; // Pour gérer un court délai d'invulnérabilité après avoir été touché
let healthBarElement = null; // Élément HTML pour la barre de vie

// Variables pour les sorts
let currentSpellType = 'fireball'; // Type de sort par défaut (fireball, lightning, laser)

// Variables spécifiques au déplacement
let isMoving = false;
let targetRotation = 0; // Rotation cible pour les transitions douces
let rotationSpeed = 0.1; // Vitesse de rotation réduite pour une rotation plus douce
let mousePosition = new THREE.Vector2(); // Position de la souris

// Variables supplémentaires pour les ennemis et le gameplay
let enemiesPerWave = 5; // Nombre d'ennemis par vague
let enemiesKilled = 0; // Nombre d'ennemis tués dans la vague actuelle
let scoreDisplay; // Élément HTML pour afficher le score et les informations de vague

// Sauvegarder la progression du joueur
function saveProgress() {
    const gameData = {
        unlockedMaps: unlockedMaps,
        mapHighScores: mapHighScores
    };
    
    localStorage.setItem('fireballGameData', JSON.stringify(gameData));
    console.log('Progression sauvegardée');
}

// Charger la progression du joueur
function loadProgress() {
    const savedData = localStorage.getItem('fireballGameData');
    
    if (savedData) {
        try {
            const gameData = JSON.parse(savedData);
            
            // Restaurer les maps débloquées
            if (gameData.unlockedMaps) {
                unlockedMaps = gameData.unlockedMaps;
            }
            
            // Restaurer les meilleurs scores
            if (gameData.mapHighScores) {
                mapHighScores = gameData.mapHighScores;
            }
            
            console.log('Progression chargée avec succès');
            console.log('Maps débloquées:', unlockedMaps);
            console.log('Meilleurs scores:', mapHighScores);
        } catch (error) {
            console.error('Erreur lors du chargement de la progression:', error);
        }
    } else {
        console.log('Aucune progression sauvegardée trouvée');
    }
}

// Mettre à jour le score de la map actuelle
function updateMapScore() {
    // Vérifier si le score actuel est meilleur que le précédent record
    if (score > mapHighScores[currentMapType]) {
        mapHighScores[currentMapType] = score;
        saveProgress();
        
        // Vérifier si de nouvelles maps sont débloquées
        checkMapUnlocks();
    }
}

// Vérifier si de nouvelles maps sont débloquées
function checkMapUnlocks() {
    let newMapUnlocked = false;
    
    // Vérifier si la map Desert peut être débloquée
    if (!unlockedMaps.includes('desert') && 
        mapHighScores.forest >= MAP_UNLOCK_THRESHOLDS.desert) {
        unlockedMaps.push('desert');
        newMapUnlocked = true;
        console.log('Map Désert débloquée!');
    }
    
    // Vérifier si la map Cave peut être débloquée
    if (!unlockedMaps.includes('cave') && 
        mapHighScores.desert >= MAP_UNLOCK_THRESHOLDS.cave) {
        unlockedMaps.push('cave');
        newMapUnlocked = true;
        console.log('Map Grotte débloquée!');
    }
    
    // Sauvegarder les changements si une nouvelle map a été débloquée
    if (newMapUnlocked) {
        saveProgress();
        
        // Afficher un message de déblocage
        if (gameStarted) {
            showWaveMessage('Nouvelle map débloquée!', 3000);
        }
    }
}

// Initialisation de la scène
function init() {
    // Charger la progression du joueur
    loadProgress();
    
    // Création de la scène
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB); // Bleu ciel pour l'ambiance
    
    // Ajout du groupe de boules de feu à la scène
    scene.add(fireballGroup);

    // Création de la caméra pour une vue de dessus (2D-like)
    camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 10, 0); // Position au-dessus du personnage
    camera.lookAt(0, 0, 0);

    // Création du renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    // Contrôles pour la caméra - désactivés pour la vue 2D
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, 0, 0);
    controls.enableRotate = false; // Désactiver la rotation pour la vue 2D
    controls.maxPolarAngle = Math.PI/4; // Limiter l'angle pour garder une vue de dessus
    controls.minPolarAngle = Math.PI/4; // Limiter l'angle pour garder une vue de dessus

    // Éclairage
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 10, 7.5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    // Créer le sol texturé selon le type de map
    createGround();
    
    // Créer des éléments de décor selon le type de map
    createScenery();
    
    // Créer l'interface utilisateur
    createUI();

    // Chargement des modèles - activé
    ajouterExempleDeModele();
    
    // Initialisation du jeu en pause (pour le menu principal)
    isMainMenuVisible = true;
    gameStarted = false;
    
    // Charge directement le modèle avec FBXLoader
    const loader = new FBXLoader();
    loader.load('models/ecureuilSama.fbx', (model) => {
        character = model;
        scene.add(character);
        console.log('Modèle écureuil chargé avec succès');
        
        // Ajuster la taille du personnage (réduire la taille)
        character.scale.set(0.01, 0.01, 0.01);
        
        // Positionner le personnage au-dessus du sol
        character.position.y = 0.3;
        
        // Initialiser les animations
        initAnimations();
        
        // Rendre le personnage visible
        character.traverse(child => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        
        // La caméra suit le personnage
        camera.position.set(character.position.x, 10, character.position.z + 10);
        camera.lookAt(character.position);
        controls.target.copy(character.position);
        
        // Afficher le menu principal au lieu de démarrer le jeu directement
        createMainMenu();
    }, 
    // Progression du chargement
    (xhr) => {
        console.log(`${(xhr.loaded / xhr.total * 100).toFixed(0)}% chargé`);
    },
    // Erreur de chargement
    (error) => {
        console.error('Erreur lors du chargement du modèle:', error);
    });

    // Gestionnaire d'événement pour le redimensionnement de la fenêtre
    window.addEventListener('resize', onWindowResize);
    
    // Gestionnaires pour les touches du clavier
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    
    // Ajouter un écouteur pour le mouvement de la souris
    window.addEventListener('mousemove', onMouseMove);

    // Lancement de l'animation
    animate();
    
    // Précharger les modèles d'ennemis
    preloadEnemyModels();
}

// Créer le sol texturé selon le type de map
function createGround() {
    const groundGeometry = new THREE.PlaneGeometry(30, 30);
    let groundMaterial;
    
    // Définir le matériau selon le type de map
    switch (currentMapType) {
        case 'desert':
            // Sable pour le désert
            groundMaterial = new THREE.MeshStandardMaterial({ 
                color: 0xD2B48C, // Couleur sable
                roughness: 0.9,
                metalness: 0.1
            });
            scene.background = new THREE.Color(0xFAE5B6); // Ciel beige clair pour désert
            break;
            
        case 'cave':
            // Roche pour la grotte
            groundMaterial = new THREE.MeshStandardMaterial({ 
                color: 0x696969, // Gris foncé
                roughness: 0.95,
                metalness: 0.4
            });
            scene.background = new THREE.Color(0x3A3A40); // Ciel gris sombre pour grotte
            break;
            
        case 'forest':
        default:
            // Herbe pour la forêt (par défaut)
            groundMaterial = new THREE.MeshStandardMaterial({ 
                color: 0x228B22, // Vert forêt
                roughness: 0.8,
                metalness: 0.2
            });
            scene.background = new THREE.Color(0x87CEEB); // Bleu ciel
            break;
    }
    
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2; // Rotation pour le mettre à plat
    ground.receiveShadow = true;
    scene.add(ground);
    
    // Grille de référence (optionnelle)
    const gridHelper = new THREE.GridHelper(30, 30, 0x000000, 0x000000);
    gridHelper.position.y = 0.01; // Légèrement au-dessus du sol pour éviter le z-fighting
    gridHelper.material.opacity = 0.2;
    gridHelper.material.transparent = true;
    scene.add(gridHelper);
}

// Créer des éléments de décor selon le type de map
function createScenery() {
    // Vider tous les obstacles existants
    for (let obstacle of obstacleObjects) {
        scene.remove(obstacle);
    }
    obstacleObjects = [];
    
    // Créer la barrière invisible pour tous les types de map
    // Cette barrière bloquera physiquement le joueur quelle que soit la map
    createInvisibleBoundary(15);
    
    // Créer des éléments de décor selon le type de map
    switch (currentMapType) {
        case 'desert':
            // Cactus et rochers pour le désert
            for (let i = 0; i < 8; i++) {
                createCactus(
                    Math.random() * 25 - 12.5,
                    0,
                    Math.random() * 25 - 12.5
                );
            }
            
            // Quelques rochers dans le désert
            for (let i = 0; i < 12; i++) {
                createDesertRock(
                    Math.random() * 20 - 10,
                    0,
                    Math.random() * 20 - 10
                );
            }
            
            // Dunes de sable (décoratif)
            for (let i = 0; i < 6; i++) {
                createDune(
                    Math.random() * 25 - 12.5,
                    0,
                    Math.random() * 25 - 12.5
                );
            }
            
            // Bordure visuelle de cactus et dunes de sable
            createDesertBorder();
            break;
            
        case 'cave':
            // Stalagmites et rochers pour la grotte
            for (let i = 0; i < 12; i++) {
                createStalagmite(
                    Math.random() * 25 - 12.5,
                    0,
                    Math.random() * 25 - 12.5
                );
            }
            
            // Quelques cristaux lumineux
            for (let i = 0; i < 8; i++) {
                createCrystal(
                    Math.random() * 20 - 10,
                    0,
                    Math.random() * 20 - 10
                );
            }
            
            // Bordure visuelle de stalagmites
            createCaveBorder();
            break;
            
        case 'forest':
        default:
            // Arbres pour la forêt (par défaut)
            for (let i = 0; i < 15; i++) {
                createTree(
                    Math.random() * 25 - 12.5,
                    0,
                    Math.random() * 25 - 12.5
                );
            }
            
            // Quelques rochers dans la forêt
            for (let i = 0; i < 10; i++) {
                createRock(
                    Math.random() * 20 - 10,
                    0,
                    Math.random() * 20 - 10
                );
            }
            
            // Bordure visuelle d'arbres
            createForestBorder();
            break;
    }
}

// Créer une bordure d'arbres autour de la map forêt
function createForestBorder() {
    const mapSize = 15; // Moitié de la taille de la map (30/2)
    const spacing = 2; // Espacement entre les arbres
    
    // Bordure d'arbres le long des quatre côtés
    for (let i = -mapSize; i <= mapSize; i += spacing) {
        // Côté Nord (Z négatif)
        createTree(i, 0, -mapSize);
        // Ajouter une deuxième rangée d'arbres pour renforcer la bordure
        createTree(i + 0.7, 0, -mapSize - 1.5);
        createTree(i - 0.5, 0, -mapSize - 3);
        
        // Côté Sud (Z positif)
        createTree(i, 0, mapSize);
        // Ajouter une deuxième rangée d'arbres pour renforcer la bordure
        createTree(i - 0.7, 0, mapSize + 1.5);
        createTree(i + 0.5, 0, mapSize + 3);
        
        // Côté Est (X positif)
        createTree(mapSize, 0, i);
        // Ajouter une deuxième rangée d'arbres pour renforcer la bordure
        createTree(mapSize + 1.5, 0, i + 0.7);
        createTree(mapSize + 3, 0, i - 0.5);
        
        // Côté Ouest (X négatif)
        createTree(-mapSize, 0, i);
        // Ajouter une deuxième rangée d'arbres pour renforcer la bordure
        createTree(-mapSize - 1.5, 0, i - 0.7);
        createTree(-mapSize - 3, 0, i + 0.5);
    }
    
    // Ajouter des rochers entre les arbres pour combler les trous
    for (let i = -mapSize; i <= mapSize; i += spacing * 1.5) {
        // Placer des rochers entre les arbres de la bordure
        createRock(i + 1, 0, -mapSize - 0.8);
        createRock(i - 1, 0, mapSize + 0.8);
        createRock(mapSize + 0.8, 0, i + 1);
        createRock(-mapSize - 0.8, 0, i - 1);
        
        // Quelques rochers à des emplacements aléatoires pour combler les espaces
        if (Math.random() < 0.7) {
            createRock(i + Math.random() - 0.5, 0, -mapSize - 2 - Math.random());
            createRock(i + Math.random() - 0.5, 0, mapSize + 2 + Math.random());
            createRock(mapSize + 2 + Math.random(), 0, i + Math.random() - 0.5);
            createRock(-mapSize - 2 - Math.random(), 0, i + Math.random() - 0.5);
        }
    }
    
    // Ajouter des "groupes" d'arbres dans les coins pour renforcer davantage
    for (let x = 0; x < 3; x++) {
        for (let z = 0; z < 3; z++) {
            // Coin Nord-Est
            createTree(mapSize + x + 0.5, 0, -mapSize - z - 0.5);
            
            // Coin Nord-Ouest
            createTree(-mapSize - x - 0.5, 0, -mapSize - z - 0.5);
            
            // Coin Sud-Est
            createTree(mapSize + x + 0.5, 0, mapSize + z + 0.5);
            
            // Coin Sud-Ouest
            createTree(-mapSize - x - 0.5, 0, mapSize + z + 0.5);
        }
    }
}

// Créer une bordure de cactus et dunes autour de la map désert
function createDesertBorder() {
    const mapSize = 15; // Moitié de la taille de la map (30/2)
    const spacing = 3; // Espacement entre les éléments
    
    // Bordure de cactus et dunes le long des quatre côtés
    for (let i = -mapSize; i <= mapSize; i += spacing) {
        if (Math.random() < 0.6) {
            // Placer un cactus
            // Côté Nord
            createCactus(i, 0, -mapSize);
            // Ligne additionnelle de cactus
            if (Math.random() < 0.7) {
                createCactus(i + 1.2, 0, -mapSize - 2);
            }
            
            // Côté Sud
            createCactus(i, 0, mapSize);
            // Ligne additionnelle de cactus
            if (Math.random() < 0.7) {
                createCactus(i - 1.2, 0, mapSize + 2);
            }
        } else {
            // Placer une dune
            // Côté Nord
            createDune(i, 0, -mapSize);
            // Ligne additionnelle de dunes
            createDune(i + 1, 0, -mapSize - 2.5);
            
            // Côté Sud
            createDune(i, 0, mapSize);
            // Ligne additionnelle de dunes
            createDune(i - 1, 0, mapSize + 2.5);
        }
        
        if (Math.random() < 0.6) {
            // Côté Est
            createCactus(mapSize, 0, i);
            // Ligne additionnelle de cactus
            if (Math.random() < 0.7) {
                createCactus(mapSize + 2, 0, i + 1.2);
            }
            
            // Côté Ouest
            createCactus(-mapSize, 0, i);
            // Ligne additionnelle de cactus
            if (Math.random() < 0.7) {
                createCactus(-mapSize - 2, 0, i - 1.2);
            }
        } else {
            // Côté Est
            createDune(mapSize, 0, i);
            // Ligne additionnelle de dunes
            createDune(mapSize + 2.5, 0, i + 1);
            
            // Côté Ouest
            createDune(-mapSize, 0, i);
            // Ligne additionnelle de dunes
            createDune(-mapSize - 2.5, 0, i - 1);
        }
    }
    
    // Ajouter des rochers du désert pour combler les espaces
    for (let i = -mapSize; i <= mapSize; i += spacing * 0.8) {
        // Placer des rochers entre les cactus et les dunes
        if (Math.random() < 0.6) {
            createDesertRock(i + Math.random(), 0, -mapSize - 1 - Math.random());
            createDesertRock(i - Math.random(), 0, mapSize + 1 + Math.random());
            createDesertRock(mapSize + 1 + Math.random(), 0, i + Math.random());
            createDesertRock(-mapSize - 1 - Math.random(), 0, i - Math.random());
        }
    }
    
    // Renforcer les coins avec des groupes de cactus
    for (let j = 0; j < 4; j++) {
        // Coins Nord-Est
        createCactus(mapSize + 1 + j*0.7, 0, -mapSize - 1 - j*0.7);
        
        // Coins Nord-Ouest
        createCactus(-mapSize - 1 - j*0.7, 0, -mapSize - 1 - j*0.7);
        
        // Coins Sud-Est
        createCactus(mapSize + 1 + j*0.7, 0, mapSize + 1 + j*0.7);
        
        // Coins Sud-Ouest
        createCactus(-mapSize - 1 - j*0.7, 0, mapSize + 1 + j*0.7);
    }
    
    // Ajouter des grandes dunes dans les coins pour bloquer complètement le passage
    createDune(mapSize + 3, 0, -mapSize - 3); // Nord-Est
    createDune(-mapSize - 3, 0, -mapSize - 3); // Nord-Ouest
    createDune(mapSize + 3, 0, mapSize + 3); // Sud-Est
    createDune(-mapSize - 3, 0, mapSize + 3); // Sud-Ouest
}

// Créer une bordure de stalagmites autour de la map grotte
function createCaveBorder() {
    const mapSize = 15; // Moitié de la taille de la map (30/2)
    const spacing = 2; // Espacement entre les stalagmites
    
    // Bordure de stalagmites le long des quatre côtés
    for (let i = -mapSize; i <= mapSize; i += spacing) {
        // Côté Nord
        createStalagmite(i, 0, -mapSize);
        // Ajouter une deuxième rangée de stalagmites
        createStalagmite(i + 0.8, 0, -mapSize - 1.5);
        createStalagmite(i - 0.6, 0, -mapSize - 3);
        
        // Côté Sud
        createStalagmite(i, 0, mapSize);
        // Ajouter une deuxième rangée de stalagmites
        createStalagmite(i - 0.8, 0, mapSize + 1.5);
        createStalagmite(i + 0.6, 0, mapSize + 3);
        
        // Côté Est
        createStalagmite(mapSize, 0, i);
        // Ajouter une deuxième rangée de stalagmites
        createStalagmite(mapSize + 1.5, 0, i + 0.8);
        createStalagmite(mapSize + 3, 0, i - 0.6);
        
        // Côté Ouest
        createStalagmite(-mapSize, 0, i);
        // Ajouter une deuxième rangée de stalagmites
        createStalagmite(-mapSize - 1.5, 0, i - 0.8);
        createStalagmite(-mapSize - 3, 0, i + 0.6);
        
        // Ajouter des cristaux aléatoirement sur les bordures
        if (i % 3 === 0) { // Augmenté la fréquence des cristaux
            createCrystal(mapSize - 0.5, 0, i - 0.5);
            createCrystal(-mapSize + 0.5, 0, i + 0.5);
            createCrystal(i - 0.5, 0, mapSize - 0.5);
            createCrystal(i + 0.5, 0, -mapSize + 0.5);
            
            // Ajouter des cristaux supplémentaires sur la ligne extérieure
            createCrystal(mapSize + 1.2, 0, i);
            createCrystal(-mapSize - 1.2, 0, i);
            createCrystal(i, 0, mapSize + 1.2);
            createCrystal(i, 0, -mapSize - 1.2);
        }
    }
    
    // Ajouter des formations de cristaux dans les coins pour bloquer complètement
    for (let x = 0; x < 4; x++) {
        for (let z = 0; z < 4; z++) {
            if ((x + z) % 2 === 0) { // Alternance de stalagmites et cristaux
                // Coin Nord-Est
                if (Math.random() < 0.7) {
                    createStalagmite(mapSize + x, 0, -mapSize - z);
                } else {
                    createCrystal(mapSize + x, 0, -mapSize - z);
                }
                
                // Coin Nord-Ouest
                if (Math.random() < 0.7) {
                    createStalagmite(-mapSize - x, 0, -mapSize - z);
                } else {
                    createCrystal(-mapSize - x, 0, -mapSize - z);
                }
                
                // Coin Sud-Est
                if (Math.random() < 0.7) {
                    createStalagmite(mapSize + x, 0, mapSize + z);
                } else {
                    createCrystal(mapSize + x, 0, mapSize + z);
                }
                
                // Coin Sud-Ouest
                if (Math.random() < 0.7) {
                    createStalagmite(-mapSize - x, 0, mapSize + z);
                } else {
                    createCrystal(-mapSize - x, 0, mapSize + z);
                }
            }
        }
    }
    
    // Créer des groupes de gros cristaux pour bloquer complètement certains passages
    const largecrystals = [
        { x: mapSize + 2, z: 0 },
        { x: -mapSize - 2, z: 0 },
        { x: 0, z: mapSize + 2 },
        { x: 0, z: -mapSize - 2 }
    ];
    
    largecrystals.forEach(pos => {
        // Créer un groupe de cristaux à cette position
        for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
                if (Math.abs(i) + Math.abs(j) <= 1) { // En forme de croix
                    createCrystal(pos.x + i, 0, pos.z + j);
                }
            }
        }
    });
}

// Créer une barrière invisible autour de la map
function createInvisibleBoundary(mapSize) {
    // Épaisseur des murs
    const wallThickness = 3; // Augmenté pour une meilleure barrière
    // Hauteur des murs
    const wallHeight = 10; // Augmenté pour une meilleure barrière
    
    // Matériau invisible pour les barrières
    const barrierMaterial = new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0.0, // Invisible
        color: 0xff0000
    });
    
    // Mur Nord
    const northWallGeometry = new THREE.BoxGeometry(mapSize * 2 + wallThickness * 2, wallHeight, wallThickness);
    const northWall = new THREE.Mesh(northWallGeometry, barrierMaterial);
    northWall.position.set(0, wallHeight / 2, -mapSize - wallThickness / 2);
    scene.add(northWall);
    obstacleObjects.push(northWall);
    
    // Mur Sud
    const southWallGeometry = new THREE.BoxGeometry(mapSize * 2 + wallThickness * 2, wallHeight, wallThickness);
    const southWall = new THREE.Mesh(southWallGeometry, barrierMaterial);
    southWall.position.set(0, wallHeight / 2, mapSize + wallThickness / 2);
    scene.add(southWall);
    obstacleObjects.push(southWall);
    
    // Mur Est
    const eastWallGeometry = new THREE.BoxGeometry(wallThickness, wallHeight, mapSize * 2 + wallThickness * 2);
    const eastWall = new THREE.Mesh(eastWallGeometry, barrierMaterial);
    eastWall.position.set(mapSize + wallThickness / 2, wallHeight / 2, 0);
    scene.add(eastWall);
    obstacleObjects.push(eastWall);
    
    // Mur Ouest
    const westWallGeometry = new THREE.BoxGeometry(wallThickness, wallHeight, mapSize * 2 + wallThickness * 2);
    const westWall = new THREE.Mesh(westWallGeometry, barrierMaterial);
    westWall.position.set(-mapSize - wallThickness / 2, wallHeight / 2, 0);
    scene.add(westWall);
    obstacleObjects.push(westWall);
    
    // Créer un "sol invisible" épais dans la zone externe pour éviter de marcher dans le vide
    // Taille de la zone externe (20 unités au-delà de la limite de la map - augmenté pour plus de sécurité)
    const externalZoneSize = 20;
    
    // Nord
    createExternalGround(-mapSize - externalZoneSize, -mapSize, -mapSize - externalZoneSize, mapSize + externalZoneSize);
    
    // Sud
    createExternalGround(mapSize, mapSize + externalZoneSize, -mapSize - externalZoneSize, mapSize + externalZoneSize);
    
    // Est
    createExternalGround(-mapSize, mapSize, mapSize, mapSize + externalZoneSize);
    
    // Ouest
    createExternalGround(-mapSize, mapSize, -mapSize - externalZoneSize, -mapSize);
    
    // Ajouter une "boîte" complète autour de la map pour empêcher absolument toute sortie
    createBoundaryBox(mapSize);
}

// Créer une boîte complète autour de la map pour empêcher absolument toute sortie
function createBoundaryBox(mapSize) {
    // Matériau invisible
    const barrierMaterial = new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0.0,
        color: 0xff0000,
        side: THREE.BackSide // Important: pour que les collisions fonctionnent de l'intérieur
    });
    
    // Créer une boîte légèrement plus grande que la map
    const boxSize = mapSize * 2 + 2; // +2 pour être sûr
    const boxGeometry = new THREE.BoxGeometry(boxSize, 20, boxSize);
    const boundaryBox = new THREE.Mesh(boxGeometry, barrierMaterial);
    boundaryBox.position.set(0, 10, 0); // Positionner au centre, hauteur 10
    
    scene.add(boundaryBox);
    obstacleObjects.push(boundaryBox);
}

// Créer un sol invisible autour de la map
function createExternalGround(startX, endX, startZ, endZ) {
    const width = Math.abs(endX - startX);
    const depth = Math.abs(endZ - startZ);
    
    const groundGeometry = new THREE.PlaneGeometry(width, depth);
    const groundMaterial = new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0.0, // Invisible
        color: 0xff0000,
        side: THREE.DoubleSide
    });
    
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2; // Rotation pour le mettre à plat
    
    // Position au centre de la zone définie
    ground.position.set(
        startX + width/2,
        -0.1, // Légèrement sous le niveau du sol principal
        startZ + depth/2
    );
    
    scene.add(ground);
    obstacleObjects.push(ground);
}

// Créer un arbre stylisé
function createTree(x, y, z) {
    const loader = new FBXLoader();
    loader.load('models/decors/Tree.fbx', (fbx) => {
        // Ajuster l'échelle - beaucoup plus petit
        fbx.scale.set(0.0015, 0.0015, 0.0015);
        fbx.position.set(x, y, z);
        
        // Ajouter une rotation aléatoire pour plus de naturel
        fbx.rotation.y = Math.random() * Math.PI * 2;
        
        // Configurer les ombres
        fbx.traverse(child => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        
        // Ajouter aux obstacles et à la scène
        fbx.userData = {
            type: 'tree',
            isObstacle: true,
            collisionRadius: 1
        };
        
        scene.add(fbx);
        obstacleObjects.push(fbx);
    }, undefined, (error) => {
        console.error('Erreur lors du chargement du modèle d\'arbre:', error);
        
        // Modèle de secours (au cas où le chargement échoue)
        const treeGeometry = new THREE.ConeGeometry(1, 4, 8);
        const trunkGeometry = new THREE.CylinderGeometry(0.3, 0.3, 1.5, 8);
        const treeMaterial = new THREE.MeshStandardMaterial({ color: 0x00AA00 });
        const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
        
        const tree = new THREE.Group();
        const crown = new THREE.Mesh(treeGeometry, treeMaterial);
        const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
        
        crown.position.y = 2.75;
        trunk.position.y = 0.75;
        
        crown.castShadow = true;
        trunk.castShadow = true;
        crown.receiveShadow = true;
        trunk.receiveShadow = true;
        
        tree.add(crown);
        tree.add(trunk);
        
        tree.position.set(x, y, z);
        
        tree.userData = {
            type: 'tree',
            isObstacle: true,
            collisionRadius: 1
        };
        
        scene.add(tree);
        obstacleObjects.push(tree);
    });
}

// Créer un rocher
function createRock(x, y, z) {
    const rockGeometry = new THREE.DodecahedronGeometry(Math.random() * 0.5 + 0.5, 0);
    const rockMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x808080,
        roughness: 0.9,
        metalness: 0.1
    });
    const rock = new THREE.Mesh(rockGeometry, rockMaterial);
    rock.position.set(x, y + rockGeometry.parameters.radius * 0.5, z);
    rock.rotation.set(Math.random(), Math.random(), Math.random());
    rock.castShadow = true;
    rock.receiveShadow = true;
    scene.add(rock);
    
    // Ajouter le rocher directement à la liste des obstacles
    obstacleObjects.push(rock);
}

// Créer un cactus (pour le désert)
function createCactus(x, y, z) {
    const loader = new FBXLoader();
    loader.load('models/decors/cactos.fbx', (fbx) => {
        // Ajuster l'échelle - agrandir les cactus
        fbx.scale.set(0.0055, 0.0055, 0.0055);
        
        // Ajuster la position pour ancrer au sol
        fbx.position.set(x, 0, z);
        
        // Ajouter une rotation aléatoire pour plus de naturel
        fbx.rotation.y = Math.random() * Math.PI * 2;
        
        // Configurer les ombres sans modifier la couleur d'origine
        fbx.traverse(child => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                // Ne pas modifier la couleur ici pour conserver l'apparence originale
            }
        });
        
        // Créer un objet de collision invisible DIRECTEMENT dans la scène plutôt qu'en tant qu'enfant
        // Cela garantit que la collision fonctionnera indépendamment de la hiérarchie des objets
        const collisionGeometry = new THREE.CylinderGeometry(1.5, 1.5, 6, 8);
        const collisionMaterial = new THREE.MeshBasicMaterial({
            color: 0xff0000,
            transparent: true,
            opacity: 0.0 // Invisible en production
            // opacity: 0.3 // Semi-visible pour déboguer les collisions si nécessaire
        });
        
        const collisionObject = new THREE.Mesh(collisionGeometry, collisionMaterial);
        // Positionner exactement au même endroit que le cactus
        collisionObject.position.set(x, 3, z); // Y à 3 pour centrer verticalement
        collisionObject.rotation.y = fbx.rotation.y; // Même rotation que le cactus
        
        // Données utilisateur pour la collision
        collisionObject.userData = {
            type: 'cactus_collision',
            isObstacle: true,
            collisionRadius: 2.0 // Rayon plus grand pour garantir le blocage
        };
        
        // Ajouter à la scène et aux obstacles
        scene.add(fbx);
        scene.add(collisionObject);
        obstacleObjects.push(collisionObject);
        
        // Référence croisée pour pouvoir nettoyer plus tard si nécessaire
        fbx.userData = {
            type: 'cactus',
            isObstacle: true,
            collisionObject: collisionObject
        };
        
    }, undefined, (error) => {
        console.error('Erreur lors du chargement du modèle de cactus:', error);
        
        // Modèle de secours (au cas où le chargement échoue)
        const cactusGroup = new THREE.Group();
        
        // Corps principal - plus grand
        const bodyGeometry = new THREE.CylinderGeometry(0.4, 0.5, 2.5, 8);
        const cactusMaterial = new THREE.MeshStandardMaterial({ color: 0x2A7E19 });
        const body = new THREE.Mesh(bodyGeometry, cactusMaterial);
        body.position.y = 1.25;
        cactusGroup.add(body);
        
        // Bras - plus grands
        const armGeometry = new THREE.CylinderGeometry(0.25, 0.25, 1.2, 8);
        const arm1 = new THREE.Mesh(armGeometry, cactusMaterial);
        arm1.position.set(0.6, 1.4, 0);
        arm1.rotation.z = Math.PI / 4;
        cactusGroup.add(arm1);
        
        const arm2 = new THREE.Mesh(armGeometry, cactusMaterial);
        arm2.position.set(-0.6, 1.7, 0);
        arm2.rotation.z = -Math.PI / 4;
        cactusGroup.add(arm2);
        
        // Configurer les ombres
        cactusGroup.traverse(child => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        
        // Créer un objet de collision indépendant
        const collisionGeometry = new THREE.CylinderGeometry(1.5, 1.5, 6, 8);
        const collisionMaterial = new THREE.MeshBasicMaterial({
            color: 0xff0000,
            transparent: true,
            opacity: 0.0
        });
        
        const collisionObject = new THREE.Mesh(collisionGeometry, collisionMaterial);
        collisionObject.position.set(x, 3, z);
        
        collisionObject.userData = {
            type: 'cactus_collision',
            isObstacle: true,
            collisionRadius: 2.0
        };
        
        // Positionnement et ajouter à la scène
        cactusGroup.position.set(x, y, z);
        scene.add(cactusGroup);
        scene.add(collisionObject);
        obstacleObjects.push(collisionObject);
    });
}

// Créer un rocher du désert
function createDesertRock(x, y, z) {
    const rockGeometry = new THREE.DodecahedronGeometry(Math.random() * 0.5 + 0.4, 0);
    const rockMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xC2B280, // Couleur sable plus foncée
        roughness: 0.9,
        metalness: 0.2
    });
    const rock = new THREE.Mesh(rockGeometry, rockMaterial);
    rock.position.set(x, y + rockGeometry.parameters.radius * 0.5, z);
    rock.rotation.set(Math.random(), Math.random(), Math.random());
    rock.castShadow = true;
    rock.receiveShadow = true;
    scene.add(rock);
    
    // Créer un objet de collision invisible
    const collisionGeometry = new THREE.SphereGeometry(rockGeometry.parameters.radius + 0.1, 8, 8);
    const collisionMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xff0000,
        transparent: true,
        opacity: 0.0 // Invisible
    });
    const collisionObject = new THREE.Mesh(collisionGeometry, collisionMaterial);
    collisionObject.position.copy(rock.position);
    scene.add(collisionObject);
    
    // Ajouter le rocher à la liste des obstacles
    obstacleObjects.push(collisionObject);
}

// Créer une dune de sable (élément décoratif)
function createDune(x, y, z) {
    // Créer la dune visuellement
    const duneGeometry = new THREE.SphereGeometry(2, 8, 8, 0, Math.PI * 2, 0, Math.PI * 0.3);
    const duneMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xE6C99F, // Sable clair
        roughness: 1,
        metalness: 0
    });
    const dune = new THREE.Mesh(duneGeometry, duneMaterial);
    
    // Ajuster la position pour qu'elle soit bien au niveau du sol
    dune.position.set(x, 0, z); // y à 0 au lieu de y-0.5
    dune.rotation.set(0, Math.random() * Math.PI * 2, 0);
    dune.receiveShadow = true;
    scene.add(dune);
    
    // Créer un objet de collision plus grand et plus épais pour les dunes
    const collisionGeometry = new THREE.BoxGeometry(3.5, 0.8, 3.5); // Plus grand et plus épais
    const collisionMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xff0000,
        transparent: true,
        opacity: 0.0 // Invisible
    });
    const collisionObject = new THREE.Mesh(collisionGeometry, collisionMaterial);
    
    // Positionner l'objet de collision à moitié dans le sol pour bloquer complètement
    collisionObject.position.set(x, 0.4, z);
    scene.add(collisionObject);
    
    // Créer un groupe pour rassembler la dune et son objet de collision
    const duneGroup = new THREE.Group();
    duneGroup.add(dune);
    duneGroup.add(collisionObject);
    duneGroup.userData = {
        type: 'dune',
        isObstacle: true
    };
    
    // Ajouter à la liste des obstacles
    obstacleObjects.push(collisionObject);
    
    return duneGroup;
}

// Créer une stalagmite (pour la grotte)
function createStalagmite(x, y, z) {
    const loader = new FBXLoader();
    
    // Choisir aléatoirement parmi les 4 modèles disponibles
    const rockIndex = Math.floor(Math.random() * 4) + 1;
    const rockPath = `models/decors/CaveRockPack1_Low${rockIndex}.fbx`;
    
    loader.load(rockPath, (fbx) => {
        // Ajuster l'échelle - beaucoup plus petit
        fbx.scale.set(0.0015, 0.0015, 0.0015);
        fbx.position.set(x, y, z);
        
        // Ajouter une rotation aléatoire pour plus de naturel
        fbx.rotation.y = Math.random() * Math.PI * 2;
        
        // Configurer les ombres
        fbx.traverse(child => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                // Donner une couleur de roche à la stalagmite
                if (child.material) {
                    child.material.color = new THREE.Color(0x505050);
                }
            }
        });
        
        // Ajouter aux obstacles et à la scène
        fbx.userData = {
            type: 'stalagmite',
            isObstacle: true,
            collisionRadius: 1.2
        };
        
        scene.add(fbx);
        obstacleObjects.push(fbx);
    }, undefined, (error) => {
        console.error(`Erreur lors du chargement du modèle de stalagmite ${rockPath}:`, error);
        
        // Modèle de secours (au cas où le chargement échoue)
        const stalagmiteGeometry = new THREE.ConeGeometry(0.8, 3, 8);
        const stalagmiteMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x505050, 
            roughness: 0.9 
        });
        
        const stalagmite = new THREE.Mesh(stalagmiteGeometry, stalagmiteMaterial);
        stalagmite.position.set(x, y + 1.5, z);
        stalagmite.castShadow = true;
        stalagmite.receiveShadow = true;
        
        stalagmite.userData = {
            type: 'stalagmite',
            isObstacle: true,
            collisionRadius: 1.2
        };
        
        scene.add(stalagmite);
        obstacleObjects.push(stalagmite);
    });
}

// Créer un cristal lumineux (pour la grotte)
function createCrystal(x, y, z) {
    const height = Math.random() * 0.7 + 0.5;
    const crystalGeometry = new THREE.ConeGeometry(0.2, height, 5);
    
    // Couleur aléatoire pour les cristaux
    const colors = [0x21f4f4, 0xf421f4, 0x21f421]; // cyan, magenta, vert
    const colorIndex = Math.floor(Math.random() * colors.length);
    
    const crystalMaterial = new THREE.MeshStandardMaterial({ 
        color: colors[colorIndex],
        emissive: colors[colorIndex],
        emissiveIntensity: 0.6,
        transparent: true,
        opacity: 0.8,
        roughness: 0.1,
        metalness: 1.0
    });
    
    const crystal = new THREE.Mesh(crystalGeometry, crystalMaterial);
    crystal.position.set(x, y + height/2, z);
    crystal.castShadow = true;
    crystal.receiveShadow = false; // Les cristaux émettent de la lumière
    scene.add(crystal);
    
    // Ajouter une lumière ponctuelle au cristal
    const light = new THREE.PointLight(colors[colorIndex], 1, 3);
    light.position.set(x, y + height, z);
    scene.add(light);
    
    // Ajouter le cristal comme obstacle
    obstacleObjects.push(crystal);
}

// Fonction pour initialiser les animations
function initAnimations() {
    if (!character) return;
    
    // Créer un mixer pour les animations
    mixer = new THREE.AnimationMixer(character);
    
    // Charger l'animation spellMouse
    loadAnimation('models/spellMouse.fbx', (animation) => {
        if (animation) {
            spellAction = mixer.clipAction(animation);
            spellAction.setLoop(THREE.LoopOnce);
            spellAction.clampWhenFinished = true;
            console.log('Animation de sort prête');
        }
    });
    
    // Charger l'animation runMouse
    loadAnimation('models/runMouse.fbx', (animation) => {
        if (animation) {
            runAction = mixer.clipAction(animation);
            runAction.setLoop(THREE.Loop);
            runAction.clampWhenFinished = false;
            console.log('Animation de course prête');
        }
    });
    
    // Charger l'animation idleMouse
    loadAnimation('models/idleMouse.fbx', (animation) => {
        if (animation) {
            idleAction = mixer.clipAction(animation);
            idleAction.setLoop(THREE.Loop);
            idleAction.clampWhenFinished = false;
            // Démarrer l'animation idle immédiatement
            idleAction.play();
            console.log('Animation idle prête et lancée');
        }
    });
}

// Fonction de chargement d'animation
function loadAnimation(path, callback) {
    const animLoader = new FBXLoader();
    animLoader.load(path, (animationObject) => {
        console.log(`Animation "${path}" chargée avec succès`);
        
        // Récupérer la piste d'animation
        const animation = animationObject.animations[0];
        if (animation) {
            callback(animation);
        } else {
            console.error(`Aucune animation trouvée dans le fichier ${path}`);
            callback(null);
        }
    }, 
    // Progression
    (xhr) => {
        console.log(`Animation: ${(xhr.loaded / xhr.total * 100).toFixed(0)}% chargée`);
    },
    // Erreur
    (error) => {
        console.error(`Erreur lors du chargement de l'animation ${path}:`, error);
        callback(null);
    });
}

// Fonction pour créer une boule de feu
function createFireball() {
    // Géométrie pour la boule de feu
    const geometry = new THREE.SphereGeometry(0.2, 16, 16);
    
    // Matériau pour la boule de feu (effet lumineux)
    const material = new THREE.MeshStandardMaterial({
        color: 0xff5500,
        emissive: 0xff2200,
        emissiveIntensity: 1,
        roughness: 0.2,
        metalness: 0.3
    });
    
    // Créer la boule de feu
    const fireball = new THREE.Mesh(geometry, material);
    
    // Ajouter une lumière à la boule de feu
    const light = new THREE.PointLight(0xff7700, 2, 2);
    fireball.add(light);
    
    // Position initiale (mains du personnage)
    if (character) {
        // Rechercher l'os de la main droite dans le personnage
        let handBone = null;
        let handFound = false;
        
        character.traverse((child) => {
            // Recherche des noms d'os communs pour la main droite
            const name = child.name.toLowerCase();
            if (child.isBone && 
                ((name.includes('hand') && name.includes('right')) || 
                 (name.includes('main') && name.includes('droite')) || 
                 name.includes('rhand') || 
                 name.includes('hand_r') ||
                 name.includes('handright'))) {
                console.log("Os de main droite trouvé:", child.name);
                handBone = child;
                handFound = true;
            }
        });

        // Si on n'a pas trouvé la main droite spécifiquement, chercher n'importe quelle main
        if (!handFound) {
            character.traverse((child) => {
                const name = child.name.toLowerCase();
                if (child.isBone && 
                    (name.includes('hand') || 
                     name.includes('main') || 
                     name.includes('palm') ||
                     name.includes('finger'))) {
                    console.log("Os de main trouvé:", child.name);
                    handBone = child;
                    handFound = true;
                }
            });
        }

        // Si on a trouvé un os de main, utiliser sa position
        if (handBone) {
            // Créer un vecteur pour la position mondiale de l'os
            const handPosition = new THREE.Vector3();
            handBone.getWorldPosition(handPosition);
            
            // Positionner la boule de feu à la position de la main
            fireball.position.copy(handPosition);
            
            // Ajuster légèrement la position pour qu'elle soit devant la main
            const forward = new THREE.Vector3(0, 0, -1);
            forward.applyQuaternion(character.quaternion);
            
            // Ajouter un petit décalage dans la direction avant
            fireball.position.addScaledVector(forward, 0.2);
            
            console.log("Position de la boule de feu basée sur l'os:", handPosition);
        } else {
            // Fallback: positionner la boule de feu devant le personnage
            console.log("Aucun os de main trouvé, utilisation de la position par défaut");
            
            fireball.position.copy(character.position);
            
            // Obtenir la direction avant du personnage
            const forward = new THREE.Vector3(0, 0, -1);
            forward.applyQuaternion(character.quaternion);
            
            // Obtenir la direction droite du personnage
            const right = new THREE.Vector3(1, 0, 0);
            right.applyQuaternion(character.quaternion);
            
            // Positionner la boule de feu devant et à droite du personnage
            fireball.position.y += 0.5; // Plus haut (approximativement la hauteur de la main)
            fireball.position.addScaledVector(forward, -0.75); // Devant le personnage
            fireball.position.addScaledVector(right, 0.4); // À droite du personnage
            
            console.log("Position de la boule de feu par défaut:", fireball.position);
        }
    }
    
    // Ajouter la boule de feu au groupe
    fireballGroup.add(fireball);
    
    // Retourner la boule de feu pour pouvoir la manipuler
    return fireball;
}

// Fonction pour lancer un sort
function castFireball() {
    if (!character) return;
    
    // Vérifier le cooldown
    const now = Date.now();
    
    // Cooldown différent selon le type de sort
    let currentCooldown = fireballCooldown;
    if (currentSpellType === 'lightning') {
        currentCooldown = 1500; // 1.5 secondes pour l'éclair
    } else if (currentSpellType === 'laser') {
        currentCooldown = 100; // Temps minimal pour le laser continu
    }
    
    if (now - lastFireballTime < currentCooldown) {
        // Montrer une indication de cooldown
        showFireballCooldown((currentCooldown - (now - lastFireballTime)) / currentCooldown);
        return; // Encore en cooldown, ne pas lancer de sort
    }
    
    // Mettre à jour le temps du dernier tir
    lastFireballTime = now;
    
    // Montrer l'indicateur de cooldown
    showFireballCooldown(1.0);
    
    // Jouer l'animation de sort si disponible
    if (spellAction) {
        spellAction.reset();
        spellAction.play();
    }
    
    // Lancer le sort approprié selon le type choisi
    switch (currentSpellType) {
        case 'fireball':
            castFireballSpell();
            break;
        case 'lightning':
            castLightningSpell();
            break;
        case 'laser':
            castLaserSpell();
            break;
    }
}

// Lancer une boule de feu classique
function castFireballSpell() {
    // Si le multishot est actif, créer 3 boules de feu avec des angles différents
    if (window.multishot) {
        // Boule de feu centrale (direction normale)
        createAndShootFireball(0);
        
        // Boule de feu légèrement à gauche
        createAndShootFireball(-0.3);
        
        // Boule de feu légèrement à droite
        createAndShootFireball(0.3);
    } else {
        // Mode normal: une seule boule de feu
        createAndShootFireball(0);
    }
}

// Lancer un éclair
function castLightningSpell() {
    if (!character) return;
    
    // Obtenir la position et la direction du personnage
    const startPosition = character.position.clone();
    startPosition.y += 1; // Partir du haut du personnage
    
    // Utiliser la position du curseur pour déterminer le point d'impact
    // Créer un rayon depuis la caméra vers le curseur
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mousePosition, camera);
    
    // Calculer l'intersection avec le sol (ground plane à y=0)
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const targetPoint = new THREE.Vector3();
    raycaster.ray.intersectPlane(groundPlane, targetPoint);
    
    // Limiter la distance de l'éclair
    const maxDistance = 12; // Distance maximale
    const direction = new THREE.Vector3().subVectors(targetPoint, startPosition).normalize();
    
    // Si la distance est trop grande, limiter au maximum
    let endPosition;
    if (startPosition.distanceTo(targetPoint) > maxDistance) {
        endPosition = startPosition.clone().addScaledVector(direction, maxDistance);
    } else {
        endPosition = targetPoint;
    }
    
    // Créer l'éclair
    createLightningBolt(startPosition, endPosition);
    
    // Chercher les ennemis dans la zone d'effet
    const hitRadius = 2.5; // Rayon de la zone d'impact plus grand
    const lightningDamage = 75; // Dégâts de l'éclair
    
    // Vérifier chaque ennemi
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        
        // Calculer la distance entre l'ennemi et le point d'impact
        const distanceToStrike = enemy.position.distanceTo(endPosition);
        
        // Si l'ennemi est dans la zone d'impact
        if (distanceToStrike <= hitRadius) {
            // Infliger des dégâts à l'ennemi
            enemy.userData.health -= lightningDamage;
            
            // Créer un effet d'impact
            createImpactEffect(enemy.position.clone());
            
            // Si l'ennemi n'a plus de vie, le supprimer
            if (enemy.userData.health <= 0) {
                killEnemy(enemy);
            }
        }
    }
}

// Créer un effet d'éclair
function createLightningBolt(startPosition, endPosition) {
    // Créer un cylindre qui représente l'éclair
    const direction = new THREE.Vector3().subVectors(endPosition, startPosition);
    const height = direction.length();
    const lightningGeometry = new THREE.CylinderGeometry(0.1, 0.1, height, 6);
    
    // Matériau brillant pour l'éclair
    const lightningMaterial = new THREE.MeshBasicMaterial({
        color: 0x00ccff,
        transparent: true,
        opacity: 0.8
    });
    
    const lightning = new THREE.Mesh(lightningGeometry, lightningMaterial);
    
    // Positionner et orienter l'éclair
    lightning.position.copy(startPosition.clone().add(endPosition).multiplyScalar(0.5));
    lightning.lookAt(endPosition);
    lightning.rotateX(Math.PI / 2);
    
    // Ajouter l'éclair à la scène
    scene.add(lightning);
    
    // Ajouter des éclats lumineux à l'impact
    createLightningImpact(endPosition);
    
    // Animation de l'éclair (apparition/disparition rapide)
    const animate = () => {
        // Faire clignoter l'éclair
        lightning.material.opacity -= 0.1;
        lightning.scale.x = 0.5 + Math.random() * 0.5; // Effet de fluctuation
        
        if (lightning.material.opacity > 0) {
            requestAnimationFrame(animate);
        } else {
            scene.remove(lightning);
        }
    };
    
    animate();
}

// Créer un effet d'impact pour l'éclair
function createLightningImpact(position) {
    // Créer une sphère lumineuse pour l'impact
    const impactGeometry = new THREE.SphereGeometry(1.5, 16, 16);
    const impactMaterial = new THREE.MeshBasicMaterial({
        color: 0x00ccff,
        transparent: true,
        opacity: 0.8
    });
    
    const impact = new THREE.Mesh(impactGeometry, impactMaterial);
    impact.position.copy(position);
    scene.add(impact);
    
    // Animation de l'impact (expansion puis disparition)
    let scale = 0.1;
    
    const animate = () => {
        scale += 0.1;
        impact.scale.set(scale, scale, scale);
        impact.material.opacity -= 0.05;
        
        if (impact.material.opacity > 0) {
            requestAnimationFrame(animate);
        } else {
            scene.remove(impact);
        }
    };
    
    animate();
}

// Lancer un rayon laser
function castLaserSpell() {
    if (!character) return;
    
    // Vérifier si un laser existe déjà
    const existingLaser = scene.getObjectByName("playerLaser");
    
    if (existingLaser) {
        // Si un laser existe déjà, le supprimer (alternance on/off)
        scene.remove(existingLaser);
        return;
    }
    
    // Créer le faisceau laser
    createLaserBeam();
}

// Créer un rayon laser
function createLaserBeam() {
    if (!character) return;
    
    // Obtenir la position et la direction du personnage
    const startPosition = character.position.clone();
    startPosition.y += 0.8; // Partir du niveau des épaules
    
    // Utiliser la position du curseur pour déterminer la direction
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mousePosition, camera);
    
    // Calculer l'intersection avec le sol (ground plane à y=0)
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const targetPoint = new THREE.Vector3();
    raycaster.ray.intersectPlane(groundPlane, targetPoint);
    
    // Obtenir la direction vers le curseur
    const direction = new THREE.Vector3().subVectors(targetPoint, startPosition).normalize();
    
    // Calculer le point final (20 unités dans la direction du curseur)
    const endPosition = startPosition.clone().addScaledVector(direction, 20);
    
    // Créer un cylindre qui représente le laser
    const height = 20; // Longueur fixe du laser
    const laserGeometry = new THREE.CylinderGeometry(0.05, 0.05, height, 8);
    
    // Matériau brillant pour le laser
    const laserMaterial = new THREE.MeshBasicMaterial({
        color: 0xff00ff,
        transparent: true,
        opacity: 0.8
    });
    
    const laser = new THREE.Mesh(laserGeometry, laserMaterial);
    laser.name = "playerLaser"; // Pour le retrouver facilement
    
    // Positionner et orienter le laser
    const midPoint = startPosition.clone().add(direction.clone().multiplyScalar(height/2));
    laser.position.copy(midPoint);
    laser.lookAt(endPosition);
    laser.rotateX(Math.PI / 2);
    
    // Données pour les dégâts continus
    laser.userData = {
        direction: direction,
        lastDamageTime: 0,
        damageInterval: 100, // Dégâts tous les 100ms
        damagePerHit: 5 // 5 points de dégâts par tic
    };
    
    // Ajouter le laser à la scène
    scene.add(laser);
    
    // Ajouter un effet de brillance (glow)
    addLaserGlow(laser);
    
    // Animation du laser
    const animate = () => {
        if (!laser.parent) return; // Si le laser a été supprimé
        
        // Suivre le personnage (position et orientation)
        const newStartPosition = character.position.clone();
        newStartPosition.y += 0.8;
        
        // Mettre à jour la direction en fonction de la position du curseur
        const newRaycaster = new THREE.Raycaster();
        newRaycaster.setFromCamera(mousePosition, camera);
        
        const newTargetPoint = new THREE.Vector3();
        newRaycaster.ray.intersectPlane(groundPlane, newTargetPoint);
        
        const newDirection = new THREE.Vector3().subVectors(newTargetPoint, newStartPosition).normalize();
        
        // Mettre à jour la position du laser
        const newEndPosition = newStartPosition.clone().addScaledVector(newDirection, height);
        const newMidPoint = newStartPosition.clone().add(newDirection.clone().multiplyScalar(height/2));
        laser.position.copy(newMidPoint);
        
        // Orienter le laser dans la nouvelle direction
        laser.lookAt(newEndPosition);
        laser.rotateX(Math.PI / 2);
        
        // Mettre à jour les données de direction
        laser.userData.direction = newDirection;
        
        // Appliquer des dégâts aux ennemis touchés
        applyLaserDamage(laser, newStartPosition, newDirection);
        
        // Effet de fluctuation légère
        const pulseScale = 1 + 0.1 * Math.sin(Date.now() * 0.01);
        laser.scale.x = pulseScale;
        laser.scale.z = pulseScale;
        
        // Continuer l'animation
        requestAnimationFrame(animate);
    };
    
    // Démarrer l'animation
    animate();
    
    // Supprimer le laser après 5 secondes (éviter la surchauffe)
    setTimeout(() => {
        if (laser.parent) scene.remove(laser);
    }, 5000);
}

// Ajouter un effet de brillance au laser
function addLaserGlow(laser) {
    // Créer un second cylindre plus large et transparent
    const glowGeometry = new THREE.CylinderGeometry(0.15, 0.15, laser.geometry.parameters.height, 8);
    const glowMaterial = new THREE.MeshBasicMaterial({
        color: 0xff00ff,
        transparent: true,
        opacity: 0.3
    });
    
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    glow.position.set(0, 0, 0); // Position relative au laser
    
    // Ajouter le glow comme enfant du laser
    laser.add(glow);
}

// Appliquer des dégâts continus aux ennemis touchés par le laser
function applyLaserDamage(laser, startPosition, direction) {
    const now = Date.now();
    
    // Vérifier si c'est le moment d'infliger des dégâts
    if (now - laser.userData.lastDamageTime < laser.userData.damageInterval) {
        return;
    }
    
    // Mettre à jour le temps du dernier dégât
    laser.userData.lastDamageTime = now;
    
    // Distance maximale du laser
    const laserLength = 20;
    
    // Vérifier chaque ennemi
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        
        // Calculer la distance de l'ennemi au point de départ du laser
        const enemyToStart = enemy.position.clone().sub(startPosition);
        
        // Projeter cette distance sur la direction du laser
        const projectionLength = enemyToStart.dot(direction);
        
        // Si l'ennemi est devant le joueur et dans la portée du laser
        if (projectionLength > 0 && projectionLength < laserLength) {
            // Calculer la distance perpendiculaire au laser
            const projectionPoint = startPosition.clone().add(direction.clone().multiplyScalar(projectionLength));
            const perpendicularDistance = enemy.position.distanceTo(projectionPoint);
            
            // Si l'ennemi est assez proche du laser
            if (perpendicularDistance < 0.8) {
                // Infliger des dégâts à l'ennemi
                enemy.userData.health -= laser.userData.damagePerHit;
                
                // Effet visuel d'impact
                createLaserImpactEffect(enemy.position.clone());
                
                // Effets de particules supplémentaires
                if (Math.random() < 0.3) { // Uniquement 30% du temps pour éviter trop d'effets
                    const sparkPosition = enemy.position.clone();
                    sparkPosition.y += 0.5 * Math.random();
                    createLaserImpactEffect(sparkPosition);
                }
                
                // Si l'ennemi n'a plus de vie, le supprimer
                if (enemy.userData.health <= 0) {
                    killEnemy(enemy);
                }
            }
        }
    }
}

// Créer un effet d'impact pour le laser
function createLaserImpactEffect(position) {
    // Créer une petite sphère lumineuse pour l'impact
    const impactGeometry = new THREE.SphereGeometry(0.2, 8, 8);
    const impactMaterial = new THREE.MeshBasicMaterial({
        color: 0xff00ff,
        transparent: true,
        opacity: 0.8
    });
    
    const impact = new THREE.Mesh(impactGeometry, impactMaterial);
    impact.position.copy(position);
    scene.add(impact);
    
    // Animation de l'impact (expansion puis disparition)
    let scale = 1;
    
    const animate = () => {
        scale += 0.1;
        impact.scale.set(scale, scale, scale);
        impact.material.opacity -= 0.1;
        
        if (impact.material.opacity > 0) {
            requestAnimationFrame(animate);
        } else {
            scene.remove(impact);
        }
    };
    
    animate();
}

// Gestion des touches du clavier (appui)
function onKeyDown(event) {
    // Ne pas traiter les touches si on est dans un menu
    if (isMainMenuVisible) {
        // Dans le menu principal, seul Echap est actif pour fermer les dialogues
        if (event.code === 'Escape') {
            const dialog = document.querySelector('div[style*="z-index: 6000"]');
            if (dialog) {
                document.body.removeChild(dialog);
            }
        }
        return;
    }
    
    switch (event.code) {
        // Déplacement
        case 'KeyW':
        case 'ArrowUp':
            moveForward = true;
            break;
        case 'KeyS':
        case 'ArrowDown':
            moveBackward = true;
            break;
        case 'KeyA':
        case 'ArrowLeft':
            moveLeft = true;
            break;
        case 'KeyD':
        case 'ArrowRight':
            moveRight = true;
            break;
            
        // Touche F pour lancer une boule de feu
        case 'KeyF':
            if (!isPaused) {
                console.log('Lancement d\'une boule de feu');
                castFireball();
            }
            break;
        
        // Touche D pour afficher les os du modèle (debug)
        case 'KeyG':
            if (!isPaused) {
                console.log('Affichage des os du modèle');
                if (character) {
                    debugBones();
                }
            }
            break;
        
        // Touche I pour inverser la direction des boules de feu
        case 'KeyI':
            if (!isPaused) {
                fireballFlipped = !fireballFlipped;
                console.log('Direction des boules de feu inversée:', fireballFlipped ? 'Oui' : 'Non');
            }
            break;
        
        // Touche Z pour changer la direction Z de la boule de feu
        case 'KeyZ':
            if (!isPaused) {
                fireballDirection.z = -fireballDirection.z;
                console.log('Direction Z de la boule de feu:', fireballDirection.z);
            }
            break;
        
        // Touche H pour afficher l'aide
        case 'KeyH':
            showInstructions();
            break;
            
        // Touche Echap pour mettre en pause
        case 'Escape':
            // Vérifier s'il y a un dialogue ouvert
            const dialog = document.querySelector('div[style*="z-index: 6000"]');
            if (dialog) {
                document.body.removeChild(dialog);
            } else {
                togglePause();
            }
            break;
    }
    
    // Mise à jour de l'état de déplacement
    updateMovementState();
}

// Gestion des touches du clavier (relâchement)
function onKeyUp(event) {
    switch (event.code) {
        case 'KeyW':
        case 'ArrowUp':
            moveForward = false;
            break;
        case 'KeyS':
        case 'ArrowDown':
            moveBackward = false;
            break;
        case 'KeyA':
        case 'ArrowLeft':
            moveLeft = false;
            break;
        case 'KeyD':
        case 'ArrowRight':
            moveRight = false;
            break;
    }
    
    // Mise à jour de l'état de déplacement
    updateMovementState();
}

// Mise à jour de l'état de déplacement
function updateMovementState() {
    const wasMoving = isMoving;
    isMoving = moveForward || moveBackward || moveLeft || moveRight;
    
    // Si on commence à se déplacer
    if (!wasMoving && isMoving) {
        if (runAction) {
            runAction.reset();
            runAction.fadeIn(0.5); // Transition progressive vers l'animation de course
            runAction.play();
        }
        if (idleAction) {
            // Faire un crossfade entre idle et run
            idleAction.fadeOut(0.5); // Transition plus douce pour sortir de idle
        }
    }
    
    // Si on arrête de se déplacer
    if (wasMoving && !isMoving) {
        if (runAction) {
            // Faire un crossfade plus doux entre run et idle
            runAction.fadeOut(0.5);
        }
        if (idleAction) {
            idleAction.reset();
            idleAction.fadeIn(0.5);
            idleAction.play();
        }
    }
}

// Fonction de débogage pour afficher tous les os du modèle
function debugBones() {
    if (!character) return;
    
    console.log('Liste des os du modèle:');
    let boneCount = 0;
    
    character.traverse((child) => {
        if (child.isBone) {
            boneCount++;
            console.log(`Os #${boneCount}: "${child.name}"`);
            
            // Visualiser la position de l'os avec un petit cube
            const marker = new THREE.Mesh(
                new THREE.BoxGeometry(0.05, 0.05, 0.05),
                new THREE.MeshBasicMaterial({ color: 0xff0000 })
            );
            
            // Obtenir la position mondiale de l'os
            const position = new THREE.Vector3();
            child.getWorldPosition(position);
            marker.position.copy(position);
            
            // Ajouter un texte pour identifier l'os
            scene.add(marker);
            
            // Si c'est un os qui ressemble à une main, le colorer différemment
            if (child.name.toLowerCase().includes('hand') || 
                child.name.toLowerCase().includes('main') || 
                child.name.toLowerCase().includes('palm')) {
                marker.material.color.set(0x00ff00); // Vert pour les mains
                marker.scale.set(0.1, 0.1, 0.1); // Plus grand pour mieux voir
            }
        }
    });
    
    console.log(`Total: ${boneCount} os trouvés`);
}

// Gestion du redimensionnement
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Déplacer le personnage
function moveCharacter() {
    if (!character) return;
    
    // Calculer la direction
    const moveDirection = new THREE.Vector3(0, 0, 0);
    
    if (moveForward) moveDirection.z -= 1;
    if (moveBackward) moveDirection.z += 1;
    if (moveLeft) moveDirection.x -= 1;
    if (moveRight) moveDirection.x += 1;
    
    // Si on a une direction non nulle
    if (moveDirection.length() > 0) {
        // Normaliser la direction
        moveDirection.normalize();
        
        // Stocker la dernière direction de mouvement, mais ne pas l'utiliser pour la rotation
        // car maintenant la rotation est contrôlée par la souris
        if (!moveBackward) {
            // Si on ne recule pas, utiliser la direction du mouvement
            lastDirection.copy(moveDirection);
        }
        
        // Déplacer le personnage dans la direction des touches, indépendamment de où il regarde
        character.position.x += moveDirection.x * characterSpeed;
        character.position.z += moveDirection.z * characterSpeed;
        
        // Conserver la hauteur Y pour éviter de traverser le sol
        character.position.y = Math.max(character.position.y, 0.3); // Assurer qu'il reste au-dessus du sol
        
        // Mettre à jour la cible des contrôles de la caméra
        controls.target.copy(character.position);
        
        // Faire suivre la caméra au personnage avec un petit décalage
        camera.position.x = character.position.x;
        camera.position.z = character.position.z + 10;
        
        // Définir l'état de déplacement
        isMoving = true;
    } else {
        // Arrêter le déplacement
        isMoving = false;
    }
    
    // Appliquer une rotation progressive vers la rotation cible (basée sur la position de la souris)
    if (character) {
        // Calculer la différence d'angle (en tenant compte de la rotation circulaire)
        let angleDiff = targetRotation - character.rotation.y;
        
        // Normaliser l'angle entre -PI et PI pour prendre le chemin le plus court
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        
        // Rotation progressive
        if (Math.abs(angleDiff) > 0.01) {
            character.rotation.y += angleDiff * rotationSpeed;
        } else {
            character.rotation.y = targetRotation;
        }
    }
}

// Boucle d'animation
function animate() {
    // Stocker l'ID de l'animation pour pouvoir l'annuler en cas de pause
    animationFrameId = requestAnimationFrame(animate);
    
    // Ne pas mettre à jour si le jeu est en pause ou si le menu principal est visible
    if (isPaused || isMainMenuVisible) return;
    
    // Mettre à jour le déplacement du personnage
    moveCharacter();
    
    // Mettre à jour les ennemis
    updateEnemies();
    
    // Mettre à jour explicitement les animations des ennemis
    enemies.forEach(enemy => {
        if (enemy.userData && enemy.userData.mixer) {
            enemy.userData.mixer.update(ANIMATION_DELTA);
        }
    });
    
    // Vérifier les collisions avec les obstacles
    if (character) {
        checkObstacleCollisions();
    }
    
    // Mettre à jour les animations du personnage principal
    if (mixer) {
        mixer.update(ANIMATION_DELTA);
    }
    
    controls.update();
    renderer.render(scene, camera);
}

// Vérifier si deux objets sont en collision
function checkCollision(object1, object2, threshold = 1.0) {
    // Vérifier que les deux objets existent et ont une position
    if (!object1 || !object2 || !object1.position || !object2.position) {
        return false;
    }
    
    // Calculer la distance entre les centres des objets
    const distance = object1.position.distanceTo(object2.position);
    
    // Ajuster le seuil en fonction du type d'objet si nécessaire
    let adjustedThreshold = threshold;
    
    // Si c'est un ennemi qui entre en collision avec le joueur, seuil plus petit
    if (object1.userData && object1.userData.health && object2 === character) {
        adjustedThreshold = 0.7; // Collision plus précise pour les ennemis
    }
    
    // Collision si la distance est inférieure au seuil
    return distance < adjustedThreshold;
}

// Vérifier les collisions avec les obstacles
function checkObstacleCollisions() {
    if (!character) return;
    
    // Position avant le déplacement
    const previousPosition = character.position.clone();
    
    // Pour chaque obstacle
    for (const obstacle of obstacleObjects) {
        // Si l'obstacle n'existe plus, passer au suivant
        if (!obstacle || !obstacle.parent) continue;
        
        // Déterminer le rayon de collision
        let collisionRadius = 1.0; // Valeur par défaut
        
        // Utiliser le rayon de collision spécifique s'il existe
        if (obstacle.userData && obstacle.userData.collisionRadius) {
            collisionRadius = obstacle.userData.collisionRadius;
        } else if (obstacle.parent && obstacle.parent.userData && obstacle.parent.userData.collisionRadius) {
            // Si l'obstacle est un enfant, vérifier le parent
            collisionRadius = obstacle.parent.userData.collisionRadius;
        }
        
        // Calculer la distance entre le personnage et l'obstacle
        const distance = character.position.distanceTo(obstacle.position);
        
        // Si le personnage est en collision avec l'obstacle
        if (distance < collisionRadius) {
            // Calculer la direction de l'obstacle vers le personnage
            const direction = new THREE.Vector3();
            direction.subVectors(character.position, obstacle.position).normalize();
            
            // Repousser le personnage de manière plus forte
            character.position.copy(previousPosition);
            
            // Déplacement plus important pour éviter de rester bloqué
            character.position.x += direction.x * 0.5;
            character.position.z += direction.z * 0.5;
            
            // Mettre à jour la cible des contrôles
            if (controls && controls.target) {
                controls.target.copy(character.position);
            }
            
            // Sortir dès qu'une collision est détectée
            return;
        }
    }
}

// Afficher les instructions
function showInstructions() {
    console.log('%c--- INSTRUCTIONS ---', 'font-weight: bold; font-size: 14px; color: white; background-color: #333; padding: 5px;');
    console.log('%c[W/A/S/D] ou flèches :', 'font-weight: bold;', 'Déplacer le personnage');
    console.log('%c[F] :', 'font-weight: bold;', 'Lancer une boule de feu');
    console.log('%c[I] :', 'font-weight: bold;', 'Inverser la direction des boules de feu');
    console.log('%c[G] :', 'font-weight: bold;', 'Mode débogage - Afficher les os');
    console.log('%c[H] :', 'font-weight: bold;', 'Afficher cette aide');
    
    // Créer un élément HTML pour les instructions
    const instructions = document.createElement('div');
    instructions.style.position = 'absolute';
    instructions.style.top = '10px';
    instructions.style.left = '10px';
    instructions.style.backgroundColor = 'rgba(0,0,0,0.7)';
    instructions.style.color = 'white';
    instructions.style.padding = '10px';
    instructions.style.borderRadius = '5px';
    instructions.style.fontFamily = 'Arial, sans-serif';
    instructions.style.fontSize = '14px';
    instructions.style.zIndex = '1000';
    instructions.style.pointerEvents = 'none'; // Ne pas interférer avec les clics
    
    instructions.innerHTML = `
        <h3 style="margin: 0 0 10px 0;">Contrôles:</h3>
        <p><b>W/A/S/D</b> ou <b>Flèches</b> : Déplacer le personnage</p>
        <p><b>F</b> : Lancer une boule de feu</p>
        <p><b>I</b> : Inverser direction boules de feu</p>
        <p><b>G</b> : Afficher les os (debug)</p>
        <p><b>H</b> : Afficher cette aide</p>
    `;
    
    document.body.appendChild(instructions);
    
    // Faire disparaître les instructions après 10 secondes
    setTimeout(() => {
        instructions.style.transition = 'opacity 1s';
        instructions.style.opacity = '0';
        setTimeout(() => {
            document.body.removeChild(instructions);
        }, 1000);
    }, 10000);
}

// Créer l'interface utilisateur
function createUI() {
    // Créer l'affichage du score
    scoreDisplay = document.createElement('div');
    scoreDisplay.id = 'score-display';
    scoreDisplay.style.position = 'absolute';
    scoreDisplay.style.top = '10px';
    scoreDisplay.style.right = '10px';
    scoreDisplay.style.backgroundColor = 'rgba(0,0,0,0.7)';
    scoreDisplay.style.color = 'white';
    scoreDisplay.style.padding = '10px';
    scoreDisplay.style.borderRadius = '5px';
    scoreDisplay.style.fontFamily = 'Arial, sans-serif';
    scoreDisplay.style.fontSize = '16px';
    scoreDisplay.style.zIndex = '1000';
    scoreDisplay.style.textAlign = 'right';
    document.body.appendChild(scoreDisplay);
    
    // Créer la barre de vie du joueur
    healthBarElement = document.createElement('div');
    healthBarElement.id = 'health-bar-container';
    healthBarElement.style.position = 'absolute';
    healthBarElement.style.top = '10px';
    healthBarElement.style.left = '10px';
    healthBarElement.style.width = '200px';
    healthBarElement.style.height = '20px';
    healthBarElement.style.backgroundColor = 'rgba(0,0,0,0.7)';
    healthBarElement.style.borderRadius = '5px';
    healthBarElement.style.overflow = 'hidden';
    healthBarElement.style.zIndex = '1000';
    
    // Barre de vie interne
    const healthFill = document.createElement('div');
    healthFill.id = 'health-bar-fill';
    healthFill.style.width = '100%';
    healthFill.style.height = '100%';
    healthFill.style.backgroundColor = '#2ecc71'; // Vert pour la vie
    healthFill.style.transition = 'width 0.3s ease-in-out';
    
    // Texte de la barre de vie
    const healthText = document.createElement('div');
    healthText.id = 'health-bar-text';
    healthText.style.position = 'absolute';
    healthText.style.top = '0';
    healthText.style.left = '0';
    healthText.style.width = '100%';
    healthText.style.height = '100%';
    healthText.style.display = 'flex';
    healthText.style.justifyContent = 'center';
    healthText.style.alignItems = 'center';
    healthText.style.color = 'white';
    healthText.style.fontFamily = 'Arial, sans-serif';
    healthText.style.fontSize = '12px';
    healthText.style.fontWeight = 'bold';
    healthText.style.textShadow = '1px 1px 1px rgba(0,0,0,0.5)';
    healthText.textContent = `${currentHealth}/${playerHealth}`;
    
    // Assembler la barre de vie
    healthBarElement.appendChild(healthFill);
    healthBarElement.appendChild(healthText);
    document.body.appendChild(healthBarElement);
    
    // Créer l'indicateur de cooldown des boules de feu
    const fireballCooldownIndicator = document.createElement('div');
    fireballCooldownIndicator.id = 'fireball-cooldown';
    fireballCooldownIndicator.style.position = 'absolute';
    fireballCooldownIndicator.style.bottom = '20px';
    fireballCooldownIndicator.style.left = '50%';
    fireballCooldownIndicator.style.transform = 'translateX(-50%)';
    fireballCooldownIndicator.style.width = '50px';
    fireballCooldownIndicator.style.height = '50px';
    fireballCooldownIndicator.style.borderRadius = '50%';
    fireballCooldownIndicator.style.backgroundColor = 'rgba(255, 0, 0, 0.5)';
    fireballCooldownIndicator.style.border = '2px solid rgba(255, 100, 0, 0.8)';
    fireballCooldownIndicator.style.display = 'none'; // Caché par défaut
    fireballCooldownIndicator.style.zIndex = '1000';
    fireballCooldownIndicator.style.boxShadow = '0 0 10px rgba(255, 100, 0, 0.5)';
    document.body.appendChild(fireballCooldownIndicator);
    
    // Mettre à jour l'affichage du score
    updateScoreDisplay();
    
    // Mettre à jour la barre de vie
    updateHealthBar();
}

// Mise à jour de l'affichage du score
function updateScoreDisplay() {
    let content = `Score: ${score}<br>Vague: ${waveNumber}<br>Ennemis: ${enemiesKilled}/${enemiesPerWave}`;
    
    // Afficher le multiplicateur de score s'il est supérieur à 1
    if (window.scoreMultiplier && window.scoreMultiplier > 1) {
        content += `<br>Multiplicateur: x${window.scoreMultiplier}`;
    }
    
    // Afficher le bouclier s'il est actif
    if (window.playerShield && window.playerShield > 0) {
        content += `<br>Bouclier: ${window.playerShield}`;
    }
    
    scoreDisplay.innerHTML = content;
}

// Démarrer le jeu
function startGame() {
    gameStarted = true;
    
    // S'assurer que le joueur commence avec sa vie complète
    currentHealth = playerHealth;
    updateHealthBar();
    
    startNextWave();
}

// Démarrer la vague suivante
function startNextWave() {
    waveNumber++;
    enemiesKilled = 0;
    
    // Augmenter le nombre d'ennemis par vague (ajout de 2 ennemis par vague)
    enemiesPerWave = 5 + (waveNumber - 1) * 2;
    
    // Afficher le message de la vague
    showWaveMessage();
    
    // Mettre à jour l'affichage du score
    updateScoreDisplay();
    
    // Précharger les modèles avant de faire apparaître les ennemis
    preloadEnemyModels(() => {
        // Faire apparaître les ennemis
        for (let i = 0; i < enemiesPerWave; i++) {
            // Ajouter un délai pour que les ennemis apparaissent progressivement
            setTimeout(() => {
                spawnEnemy();
            }, i * 500); // 500ms entre chaque apparition
        }
    });
}

// Afficher un message temporaire au centre de l'écran
function showWaveMessage(message, duration) {
    const messageElement = document.createElement('div');
    messageElement.style.position = 'absolute';
    messageElement.style.top = '50%';
    messageElement.style.left = '50%';
    messageElement.style.transform = 'translate(-50%, -50%)';
    messageElement.style.backgroundColor = 'rgba(0,0,0,0.7)';
    messageElement.style.color = 'white';
    messageElement.style.padding = '20px';
    messageElement.style.borderRadius = '10px';
    messageElement.style.fontFamily = 'Arial, sans-serif';
    messageElement.style.fontSize = '32px';
    messageElement.style.fontWeight = 'bold';
    messageElement.style.zIndex = '2000';
    messageElement.style.textAlign = 'center';
    messageElement.innerHTML = message;
    document.body.appendChild(messageElement);
    
    // Faire disparaître le message après la durée spécifiée
    setTimeout(() => {
        messageElement.style.transition = 'opacity 1s';
        messageElement.style.opacity = '0';
        setTimeout(() => {
            document.body.removeChild(messageElement);
        }, 1000);
    }, duration);
}

// Mise à jour de spawnEnemy pour utiliser le fichier WhiteclownInjured.fbx
function spawnEnemy() {
    if (!gameStarted) return;
    
    // Si on est déjà en train de charger un modèle, attendre
    if (isLoadingModels) {
        setTimeout(() => spawnEnemy(), 500);
        return;
    }
    
    // Si le préchargement est toujours en cours, mettre en file d'attente
    if (isEnemyModelLoading) {
        enemyLoadingQueue++;
        setTimeout(() => {
            enemyLoadingQueue--;
            spawnEnemy();
        }, 500);
        return;
    }
    
    // Si les modèles ne sont pas encore chargés, les charger maintenant
    if (!enemyModelCache) {
        preloadEnemyModels(() => spawnEnemy());
        return;
    }
    
    isLoadingModels = true;
    
    // Chargement séquentiel pour éviter les problèmes
    // D'abord charger le modèle de base
    const loader = new FBXLoader();
    
    loader.load('models/Whiteclown.fbx', (enemyModel) => {
        // Ajuster l'échelle
        enemyModel.scale.set(0.01, 0.01, 0.01);
        
        // Rendre tous les meshes visibles
        enemyModel.traverse(child => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                child.visible = true;
                
                // Matériau plus visible
                if (child.material) {
                    child.material.transparent = false;
                    child.material.opacity = 1.0;
                    child.material.needsUpdate = true;
                }
            }
        });
        
        // Calculer une position de spawn aléatoire autour du joueur
        const radius = 15;
        const angle = Math.random() * Math.PI * 2;
        const x = character.position.x + Math.cos(angle) * radius;
        const z = character.position.z + Math.sin(angle) * radius;
        enemyModel.position.set(x, 0, z);
        
        // Définir les propriétés de l'ennemi
        enemyModel.userData = {
            health: 100,
            speed: 0.03 + (waveNumber * 0.005), // Vitesse qui augmente avec les vagues
            value: 10 * waveNumber,
            animationTime: 0 // Variable pour suivre l'animation
        };
        
        // Ajouter le modèle à la scène et à la liste des ennemis
        scene.add(enemyModel);
        enemies.push(enemyModel);
        
        // Créer un mixer d'animation pour cet ennemi
        const mixer = new THREE.AnimationMixer(enemyModel);
        enemyModel.userData.mixer = mixer;
        
        // Maintenant charger l'animation WhiteclownInjured.fbx
        loader.load('models/WhiteclownInjured.fbx', (animationModel) => {
            console.log("Animation 'WhiteclownInjured' chargée");
            
            // Vérifier si l'animation a des animations
            if (animationModel.animations && animationModel.animations.length > 0) {
                console.log(`Nombre d'animations trouvées: ${animationModel.animations.length}`);
                
                // Jouer l'animation
                const action = mixer.clipAction(animationModel.animations[0]);
                action.setLoop(THREE.LoopRepeat);
                action.play();
            } else {
                console.log("Recherche d'animations dans les enfants...");
                // Chercher des animations dans les enfants
                let animations = [];
                
                // Parcourir tous les enfants pour trouver des animations
                animationModel.traverse((child) => {
                    if (child.animations && child.animations.length > 0) {
                        console.log(`Animations trouvées dans un enfant: ${child.animations.length}`);
                        animations = animations.concat(child.animations);
                    }
                });
                
                // Si des animations ont été trouvées, utiliser la première
                if (animations.length > 0) {
                    console.log(`Total des animations trouvées: ${animations.length}`);
                    const action = mixer.clipAction(animations[0]);
                    action.setLoop(THREE.LoopRepeat);
                    action.play();
                } else {
                    console.log("Aucune animation trouvée.");
                    
                    // Si aucune animation n'est trouvée, utiliser l'animation manuelle de secours
                    enemyModel.userData.useManualAnimation = true;
                }
            }
            
            isLoadingModels = false;
        }, undefined, (error) => {
            console.error("Erreur lors du chargement de l'animation:", error);
            // En cas d'erreur, utiliser l'animation manuelle
            enemyModel.userData.useManualAnimation = true;
            isLoadingModels = false;
        });
    }, undefined, (error) => {
        console.error('Erreur lors du chargement du modèle:', error);
        isLoadingModels = false;
    });
}

// Mettre à jour les ennemis (mouvement, etc.)
function updateEnemies() {
    if (!character) return;
    
    // Pour chaque ennemi
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        
        // Direction vers le joueur
        const direction = new THREE.Vector3();
        direction.subVectors(character.position, enemy.position).normalize();
        
        // Sauvegarder la position précédente pour pouvoir revenir en arrière en cas de collision
        const previousPosition = enemy.position.clone();
        
        // Déplacer l'ennemi vers le joueur
        enemy.position.x += direction.x * enemy.userData.speed;
        enemy.position.z += direction.z * enemy.userData.speed;
        
        // Vérifier les collisions avec les autres ennemis
        let hasCollision = false;
        for (let j = 0; j < enemies.length; j++) {
            if (i !== j) { // Ne pas vérifier la collision avec soi-même
                const otherEnemy = enemies[j];
                const distance = enemy.position.distanceTo(otherEnemy.position);
                
                // Utiliser un seuil de collision approprié (la somme des rayons des ennemis)
                const collisionThreshold = 1.0; // Ajustez selon la taille de vos ennemis
                
                if (distance < collisionThreshold) {
                    hasCollision = true;
                    
                    // Calculer une direction de répulsion
                    const repulsionDirection = new THREE.Vector3();
                    repulsionDirection.subVectors(enemy.position, otherEnemy.position).normalize();
                    
                    // Appliquer une répulsion - déplacer les deux ennemis pour les séparer
                    enemy.position.x += repulsionDirection.x * 0.05;
                    enemy.position.z += repulsionDirection.z * 0.05;
                    
                    // Optionnel: déplacer légèrement l'autre ennemi dans la direction opposée
                    otherEnemy.position.x -= repulsionDirection.x * 0.05;
                    otherEnemy.position.z -= repulsionDirection.z * 0.05;
                }
            }
        }
        
        // Animation
        if (enemy.userData) {
            // Incrémenter le temps d'animation
            enemy.userData.animationTime += ANIMATION_DELTA;
            
            if (enemy.userData.useManualAnimation) {
                // Animation manuelle de secours si l'animation par fichier a échoué
                // Oscillation de base pour simuler le mouvement
                const baseY = 0.4;
                const amplitude = 0.05;
                const frequency = 5; // Hz
                
                // Calculer la hauteur en fonction du temps
                const animatedY = baseY + amplitude * Math.sin(enemy.userData.animationTime * frequency);
                
                // Appliquer la hauteur animée
                enemy.position.y = animatedY;
                
                // Légère oscillation de rotation pour simuler le balancement
                const rotAmplitude = 0.03;
                enemy.rotation.z = rotAmplitude * Math.sin(enemy.userData.animationTime * frequency * 2);
                
                // Légère oscillation avant-arrière
                const forwardBackAmplitude = 0.02;
                enemy.rotation.x = forwardBackAmplitude * Math.sin(enemy.userData.animationTime * frequency);
            } else {
                // Animation par fichier
                // Maintenir une hauteur fixe
                enemy.position.y = 0.4;
                
                // Mettre à jour le mixer d'animation
                if (enemy.userData.mixer) {
                    enemy.userData.mixer.update(ANIMATION_DELTA);
                }
            }
        }
        
        // Orienter l'ennemi vers le joueur
        enemy.rotation.y = Math.atan2(direction.x, direction.z);
        
        // Vérifier les collisions avec les boules de feu
        checkEnemyFireballCollisions(enemy);
        
        // Vérifier la collision avec le joueur
        if (character && checkCollision(enemy, character, 0.7)) {
            // Si le joueur a un bouclier, l'utiliser au lieu de prendre des dégâts
            if (window.playerShield && window.playerShield > 0) {
                window.playerShield--;
                
                // Effet visuel de bouclier
                createShieldEffect(character.position.clone());
                
                // Afficher un message
                showBonus(character.position, "Bouclier -1", 0xffaa00);
                
                // Repousser l'ennemi
                enemy.position.x -= direction.x * 0.5;
                enemy.position.z -= direction.z * 0.5;
                
                // Mettre à jour l'affichage
                updateScoreDisplay();
            } else {
                // Infliger des dégâts au joueur
                damagePlayer(10); // 10 points de dégâts par touche
                
                // Repousser légèrement l'ennemi
                enemy.position.x -= direction.x * 0.1;
                enemy.position.z -= direction.z * 0.1;
            }
        }
    }
}

// Vérifier les collisions entre un ennemi et toutes les boules de feu
function checkEnemyFireballCollisions(enemy) {
    // Pour chaque boule de feu
    for (let j = 0; j < fireballGroup.children.length; j++) {
        const fireball = fireballGroup.children[j];
        
        // Si la boule de feu touche l'ennemi
        if (checkCollision(enemy, fireball, 0.6)) {
            // Obtenir les dégâts de la boule de feu (avec bonus éventuel)
            const damage = fireball.userData && fireball.userData.damage ? fireball.userData.damage : 50;
            
            // Infliger des dégâts à l'ennemi
            enemy.userData.health -= damage;
            
            // Créer un effet d'impact
            createImpactEffect(fireball.position.clone());
            
            // Supprimer la boule de feu
            fireballGroup.remove(fireball);
            j--; // Ajuster l'index après la suppression
            
            // Si l'ennemi n'a plus de vie, le supprimer
            if (enemy.userData.health <= 0) {
                killEnemy(enemy);
                return; // Sortir de la fonction puisque l'ennemi est mort
            }
        }
    }
}

// Tuer un ennemi
function killEnemy(enemy) {
    // Effet d'explosion
    createExplosionEffect(enemy.position.clone());
    
    // Retirer l'ennemi de la liste
    const index = enemies.indexOf(enemy);
    if (index !== -1) {
        enemies.splice(index, 1);
    }
    
    // Retirer l'ennemi de la scène
    scene.remove(enemy);
    
    // Calculer le score en tenant compte du multiplicateur
    const scoreValue = enemy.userData.value * (window.scoreMultiplier || 1);
    
    // Mettre à jour le score et le compteur d'ennemis tués
    score += scoreValue;
    enemiesKilled++;
    
    // Chance d'obtenir un bonus aléatoire (20%)
    if (Math.random() < 0.2) {
        const bonusType = Math.floor(Math.random() * 3); // 0, 1 ou 2
        
        switch(bonusType) {
            case 0: // Bonus de score
                const bonusScore = 50 * waveNumber * (window.scoreMultiplier || 1);
                score += bonusScore;
                showBonus(enemy.position, "+"+bonusScore+" points", 0xFFD700);
                break;
            
            case 1: // Bonus de vitesse temporaire
                characterSpeed = characterSpeed * 1.5; // 50% plus rapide
                setTimeout(() => { 
                    characterSpeed = characterSpeed / 1.5; // Revenir à la normale
                }, 5000); // Pendant 5 secondes
                showBonus(enemy.position, "Vitesse +50%", 0x00FF00);
                break;
                
            case 2: // Bonus de cadence de tir
                // Réduire le délai entre les tirs pendant 5 secondes
                const originalCooldown = fireballCooldown;
                fireballCooldown = 100; // 100ms entre chaque tir
                setTimeout(() => { 
                    fireballCooldown = originalCooldown; 
                }, 5000); // Pendant 5 secondes
                showBonus(enemy.position, "Tir rapide", 0x00FFFF);
                break;
        }
    }
    
    // Mettre à jour l'affichage
    updateScoreDisplay();
    
    // Vérifier si la vague est terminée
    if (enemiesKilled >= enemiesPerWave && enemies.length === 0) {
        // Bonus de fin de vague
        const waveBonus = waveNumber * 100 * (window.scoreMultiplier || 1);
        score += waveBonus;
        
        // Afficher un message indiquant le bonus
        showWaveMessage(`Vague ${waveNumber} terminée! Bonus: +${waveBonus}`, 3000);
        
        // Afficher le menu de choix de bonus après un court délai
        setTimeout(() => {
            showBonusChoices();
        }, 3000);
    }
}

// Afficher le menu de choix de bonus entre les vagues
function showBonusChoices() {
    // Créer l'élément conteneur pour les choix de bonus
    const bonusChoicesContainer = document.createElement('div');
    bonusChoicesContainer.id = 'bonus-choices';
    bonusChoicesContainer.style.position = 'fixed';
    bonusChoicesContainer.style.top = '0';
    bonusChoicesContainer.style.left = '0';
    bonusChoicesContainer.style.width = '100%';
    bonusChoicesContainer.style.height = '100%';
    bonusChoicesContainer.style.backgroundColor = 'rgba(0,0,0,0.7)';
    bonusChoicesContainer.style.display = 'flex';
    bonusChoicesContainer.style.flexDirection = 'column';
    bonusChoicesContainer.style.justifyContent = 'center';
    bonusChoicesContainer.style.alignItems = 'center';
    bonusChoicesContainer.style.zIndex = '3000';
    document.body.appendChild(bonusChoicesContainer);
    
    // Ajouter un titre
    const title = document.createElement('h2');
    title.textContent = 'Choisissez un bonus pour la prochaine vague';
    title.style.color = 'white';
    title.style.fontFamily = 'Arial, sans-serif';
    title.style.marginBottom = '40px';
    bonusChoicesContainer.appendChild(title);
    
    // Conteneur pour les cartes de bonus
    const cardsContainer = document.createElement('div');
    cardsContainer.style.display = 'flex';
    cardsContainer.style.justifyContent = 'center';
    cardsContainer.style.gap = '30px';
    bonusChoicesContainer.appendChild(cardsContainer);
    
    // Générer 3 bonus aléatoires différents (sans répétition)
    const availableBonuses = shuffleArray([
        { type: 'damage', name: 'Dégâts +50%', description: 'Augmente les dégâts des boules de feu de 50%', icon: '🔥', color: '#ff5500' },
        { type: 'speed', name: 'Vitesse +25%', description: 'Augmente la vitesse de déplacement de manière permanente', icon: '💨', color: '#00ff00' },
        { type: 'cooldown', name: 'Cadence +40%', description: 'Réduit le temps de recharge des boules de feu', icon: '⚡', color: '#00ffff' },
        { type: 'health', name: 'Bouclier', description: 'Ajoute un bouclier qui absorbe 3 coups', icon: '🛡️', color: '#ffaa00' },
        { type: 'multishot', name: 'Triple tir', description: 'Lance 3 boules de feu à la fois', icon: '🎯', color: '#ff00ff' },
        { type: 'score', name: 'Multiplicateur x2', description: 'Double les points obtenus en tuant des ennemis', icon: '💰', color: '#ffff00' }
    ]);
    
    // Créer les 3 cartes de choix
    for (let i = 0; i < 3; i++) {
        const bonus = availableBonuses[i];
        
        const card = document.createElement('div');
        card.className = 'bonus-card';
        card.style.width = '200px';
        card.style.height = '250px';
        card.style.backgroundColor = 'rgba(50,50,50,0.9)';
        card.style.border = `2px solid ${bonus.color}`;
        card.style.borderRadius = '10px';
        card.style.padding = '20px';
        card.style.display = 'flex';
        card.style.flexDirection = 'column';
        card.style.alignItems = 'center';
        card.style.justifyContent = 'space-between';
        card.style.cursor = 'pointer';
        card.style.transition = 'transform 0.2s, box-shadow 0.2s';
        
        // Effet de survol
        card.onmouseenter = () => {
            card.style.transform = 'scale(1.05)';
            card.style.boxShadow = `0 0 20px ${bonus.color}`;
        };
        card.onmouseleave = () => {
            card.style.transform = 'scale(1)';
            card.style.boxShadow = 'none';
        };
        
        // Icône du bonus
        const icon = document.createElement('div');
        icon.textContent = bonus.icon;
        icon.style.fontSize = '60px';
        icon.style.marginBottom = '10px';
        card.appendChild(icon);
        
        // Nom du bonus
        const name = document.createElement('h3');
        name.textContent = bonus.name;
        name.style.color = 'white';
        name.style.margin = '10px 0';
        name.style.textAlign = 'center';
        card.appendChild(name);
        
        // Description du bonus
        const description = document.createElement('p');
        description.textContent = bonus.description;
        description.style.color = '#ccc';
        description.style.textAlign = 'center';
        description.style.fontSize = '14px';
        description.style.margin = '0';
        card.appendChild(description);
        
        // Action lorsqu'on clique sur une carte
        card.onclick = () => {
            applyBonus(bonus.type);
            document.body.removeChild(bonusChoicesContainer);
            startNextWave();
        };
        
        cardsContainer.appendChild(card);
    }
}

// Fonction pour mélanger un tableau (algorithme de Fisher-Yates)
function shuffleArray(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

// Appliquer le bonus choisi
function applyBonus(bonusType) {
    switch (bonusType) {
        case 'damage':
            // Augmenter les dégâts des boules de feu
            window.fireballDamage = (window.fireballDamage || 50) * 1.5;
            showWaveMessage('Dégâts des boules de feu +50%', 2000);
            break;
            
        case 'speed':
            // Augmenter la vitesse de déplacement de manière permanente
            characterSpeed *= 1.25;
            showWaveMessage('Vitesse de déplacement +25%', 2000);
            break;
            
        case 'cooldown':
            // Réduire le temps de recharge des boules de feu
            fireballCooldown = Math.max(100, fireballCooldown * 0.6);
            showWaveMessage('Cadence de tir +40%', 2000);
            break;
            
        case 'health':
            // Ajouter un bouclier
            window.playerShield = (window.playerShield || 0) + 3;
            showWaveMessage('Bouclier +3', 2000);
            // Mettre à jour l'affichage du bouclier
            updateScoreDisplay();
            break;
            
        case 'multishot':
            // Activer le triple tir
            window.multishot = true;
            showWaveMessage('Triple tir activé!', 2000);
            break;
            
        case 'score':
            // Doubler le multiplicateur de score
            window.scoreMultiplier = (window.scoreMultiplier || 1) * 2;
            showWaveMessage('Multiplicateur de score x2', 2000);
            break;
    }
}

// Afficher un bonus visuel au-dessus de l'ennemi tué
function showBonus(position, text, color) {
    // Créer un élément de texte pour le bonus
    const bonusDiv = document.createElement('div');
    bonusDiv.className = 'bonus-text';
    bonusDiv.textContent = text;
    bonusDiv.style.color = '#' + color.toString(16).padStart(6, '0');
    document.body.appendChild(bonusDiv);
    
    // Positionner le texte au-dessus de l'ennemi
    const vector = new THREE.Vector3(position.x, position.y + 1, position.z);
    vector.project(camera);
    
    const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-(vector.y * 0.5) + 0.5) * window.innerHeight;
    
    bonusDiv.style.left = x + 'px';
    bonusDiv.style.top = y + 'px';
    
    // Animation : le texte monte et disparaît
    let opacity = 1;
    let yOffset = 0;
    
    const animateBonus = () => {
        opacity -= 0.01;
        yOffset -= 1;
        
        if (opacity <= 0) {
            document.body.removeChild(bonusDiv);
            return;
        }
        
        bonusDiv.style.opacity = opacity;
        bonusDiv.style.top = (y + yOffset) + 'px';
        requestAnimationFrame(animateBonus);
    };
    
    requestAnimationFrame(animateBonus);
}

// Créer un effet d'impact pour les boules de feu
function createImpactEffect(position) {
    // Créer une petite explosion (particule)
    const particleGeometry = new THREE.SphereGeometry(0.1, 8, 8);
    const particleMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xffaa00,
        transparent: true,
        opacity: 0.8
    });
    
    const impact = new THREE.Mesh(particleGeometry, particleMaterial);
    impact.position.copy(position);
    scene.add(impact);
    
    // Animation d'expansion et de disparition
    let scale = 1;
    const animate = () => {
        scale += 0.1;
        impact.scale.set(scale, scale, scale);
        impact.material.opacity -= 0.05;
        
        if (impact.material.opacity > 0) {
            requestAnimationFrame(animate);
        } else {
            scene.remove(impact);
        }
    };
    
    animate();
}

// Créer un effet d'explosion pour les ennemis tués
function createExplosionEffect(position) {
    // Créer plusieurs particules pour l'explosion
    const particleCount = 10;
    const particles = [];
    
    for (let i = 0; i < particleCount; i++) {
        const particleGeometry = new THREE.SphereGeometry(0.1, 8, 8);
        const particleMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xff5500,
            transparent: true,
            opacity: 1
        });
        
        const particle = new THREE.Mesh(particleGeometry, particleMaterial);
        particle.position.copy(position);
        
        // Direction aléatoire pour chaque particule
        particle.userData = {
            velocity: new THREE.Vector3(
                (Math.random() - 0.5) * 0.2,
                Math.random() * 0.2,
                (Math.random() - 0.5) * 0.2
            )
        };
        
        scene.add(particle);
        particles.push(particle);
    }
    
    // Animation des particules
    let frame = 0;
    const animate = () => {
        frame++;
        
        for (let i = 0; i < particles.length; i++) {
            const particle = particles[i];
            
            // Déplacer la particule selon sa vélocité
            particle.position.add(particle.userData.velocity);
            
            // Réduire l'opacité
            particle.material.opacity -= 0.02;
            
            // Appliquer la gravité
            particle.userData.velocity.y -= 0.005;
        }
        
        // Continuer l'animation tant que les particules sont visibles
        if (frame < 50) {
            requestAnimationFrame(animate);
        } else {
            // Supprimer toutes les particules
            for (const particle of particles) {
                scene.remove(particle);
            }
        }
    };
    
    animate();
}

// Afficher l'indicateur de cooldown des boules de feu
function showFireballCooldown(ratio) {
    const indicator = document.getElementById('fireball-cooldown');
    if (!indicator) return;
    
    // Afficher l'indicateur
    indicator.style.display = 'block';
    
    // Ajuster la taille et l'opacité en fonction du ratio de cooldown
    indicator.style.transform = `translateX(-50%) scale(${0.5 + (ratio * 0.5)})`;
    indicator.style.opacity = ratio;
    
    // Changer la couleur en fonction du ratio de cooldown
    const r = 255;
    const g = Math.floor(ratio * 200);
    const b = 0;
    indicator.style.backgroundColor = `rgba(${r}, ${g}, ${b}, 0.5)`;
    
    // Cacher l'indicateur après un délai
    if (ratio < 1.0) {
        // Déjà en cooldown, l'indicateur disparaîtra progressivement
    } else {
        // Nouvelle boule de feu lancée, commencer l'animation de cooldown
        let remainingTime = fireballCooldown;
        
        const updateCooldown = () => {
            remainingTime -= 16; // Environ 60 FPS
            
            if (remainingTime <= 0) {
                indicator.style.display = 'none';
                return;
            }
            
            const currentRatio = remainingTime / fireballCooldown;
            indicator.style.transform = `translateX(-50%) scale(${0.5 + (currentRatio * 0.5)})`;
            indicator.style.opacity = currentRatio;
            
            const g = Math.floor(currentRatio * 200);
            indicator.style.backgroundColor = `rgba(${r}, ${g}, ${b}, 0.5)`;
            
            requestAnimationFrame(updateCooldown);
        };
        
        requestAnimationFrame(updateCooldown);
    }
}

// Gestion du mouvement de la souris
function onMouseMove(event) {
    // Convertir la position de la souris en coordonnées normalisées (-1 à 1)
    mousePosition.x = (event.clientX / window.innerWidth) * 2 - 1;
    mousePosition.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    if (character) {
        // Calculer la position du curseur dans l'espace 3D
        const vector = new THREE.Vector3(mousePosition.x, mousePosition.y, 0.5);
        vector.unproject(camera);
        
        // Calculer la direction du personnage vers le curseur
        const dir = vector.sub(camera.position).normalize();
        
        // Calculer l'intersection avec le plan XZ (y = 0)
        const distance = -camera.position.y / dir.y;
        const pos = camera.position.clone().add(dir.multiplyScalar(distance));
        
        // Calculer l'angle pour faire face au curseur
        const angleToMouse = Math.atan2(
            pos.x - character.position.x,
            pos.z - character.position.z
        );
        
        // Mettre à jour la rotation cible
        targetRotation = angleToMouse;
    }
}

// Créer un effet visuel de bouclier
function createShieldEffect(position) {
    // Créer une sphère semi-transparente
    const shieldGeometry = new THREE.SphereGeometry(1.5, 16, 16);
    const shieldMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xffaa00,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide
    });
    
    const shield = new THREE.Mesh(shieldGeometry, shieldMaterial);
    shield.position.copy(position);
    scene.add(shield);
    
    // Animation d'expansion et de disparition
    let time = 0;
    const animate = () => {
        time += 0.05;
        
        // Pulse et fade out
        const scale = 1 + 0.5 * Math.sin(time * 3);
        shield.scale.set(scale, scale, scale);
        shield.material.opacity = 0.5 * (1 - time / Math.PI);
        
        if (time < Math.PI) {
            requestAnimationFrame(animate);
        } else {
            scene.remove(shield);
        }
    };
    
    animate();
}

// Créer un bouton de menu standardisé
function createMenuButton(text, onClick) {
    const button = document.createElement('div');
    button.textContent = text;
    button.style.backgroundColor = 'rgba(255, 120, 0, 0.8)';
    button.style.color = 'white';
    button.style.padding = '15px 30px';
    button.style.margin = '10px 0';
    button.style.borderRadius = '5px';
    button.style.cursor = 'pointer';
    button.style.fontSize = '18px';
    button.style.textAlign = 'center';
    button.style.transition = 'background-color 0.2s, transform 0.1s';
    button.style.width = '250px';
    
    // Effets de survol
    button.onmouseenter = () => {
        button.style.backgroundColor = 'rgba(255, 150, 0, 0.9)';
        button.style.transform = 'scale(1.05)';
    };
    
    button.onmouseleave = () => {
        button.style.backgroundColor = 'rgba(255, 120, 0, 0.8)';
        button.style.transform = 'scale(1)';
    };
    
    // Effet de clic
    button.onmousedown = () => {
        button.style.transform = 'scale(0.95)';
    };
    
    button.onmouseup = () => {
        button.style.transform = 'scale(1.05)';
    };
    
    // Action au clic
    button.onclick = onClick;
    
    return button;
}

// Créer le menu principal
function createMainMenu() {
    // Supprimer l'ancien menu s'il existe
    if (mainMenuElement) {
        document.body.removeChild(mainMenuElement);
    }
    
    // Créer une scène d'animation en arrière-plan
    createMenuBackgroundScene();
    
    // Créer le conteneur du menu
    mainMenuElement = document.createElement('div');
    mainMenuElement.id = 'main-menu';
    mainMenuElement.style.position = 'fixed';
    mainMenuElement.style.top = '0';
    mainMenuElement.style.left = '0';
    mainMenuElement.style.width = '100%';
    mainMenuElement.style.height = '100%';
    mainMenuElement.style.backgroundColor = 'rgba(0, 0, 0, 0.6)'; // Fond plus transparent pour voir l'animation
    mainMenuElement.style.display = 'flex';
    mainMenuElement.style.flexDirection = 'column';
    mainMenuElement.style.justifyContent = 'center';
    mainMenuElement.style.alignItems = 'center';
    mainMenuElement.style.zIndex = '5000';
    
    // Ajouter le titre
    const title = document.createElement('h1');
    title.textContent = 'Bataille de Fireballs';
    title.style.color = '#ff7700';
    title.style.fontSize = '48px';
    title.style.fontFamily = 'Arial, sans-serif';
    title.style.textShadow = '0 0 10px rgba(255, 150, 0, 0.8)';
    title.style.marginBottom = '50px';
    mainMenuElement.appendChild(title);
    
    // Ajouter les boutons
    const buttons = [
        { text: 'Nouvelle Partie', action: startNewGame },
        { text: 'Changer de Map', action: showMapSelection },
        { text: 'Contrôles', action: showControls },
        { text: 'À Propos', action: showAbout }
    ];
    
    buttons.forEach(buttonInfo => {
        const button = createMenuButton(buttonInfo.text, buttonInfo.action);
        mainMenuElement.appendChild(button);
    });
    
    // Ajouter le menu au document
    document.body.appendChild(mainMenuElement);
    isMainMenuVisible = true;
    
    // Afficher le type de map actuelle et le meilleur score
    const mapInfoText = document.createElement('div');
    mapInfoText.style.color = 'white';
    mapInfoText.style.fontSize = '16px';
    mapInfoText.style.marginTop = '30px';
    mapInfoText.style.textAlign = 'center';
    
    // Obtenir le nom de la map en français
    let mapName = 'Forêt';
    if (currentMapType === 'desert') mapName = 'Désert';
    if (currentMapType === 'cave') mapName = 'Grotte';
    
    mapInfoText.innerHTML = `Map actuelle: <span style="color:#ff7700">${mapName}</span><br>
                            Meilleur score: <span style="color:#ff7700">${mapHighScores[currentMapType]}</span>`;
    mainMenuElement.appendChild(mapInfoText);
    
    // Démarrer l'animation de la scène de fond
    animateMenuBackground();
}

// Variables pour la scène de fond du menu
let menuScene, menuCamera, menuRenderer;
let menuCharacter, menuEnemy;
let menuCharacterMixer, menuEnemyMixer;
let menuAnimationId;

// Créer une scène d'arrière-plan pour le menu principal
function createMenuBackgroundScene() {
    // Arrêter l'animation précédente si elle existe
    if (menuAnimationId) {
        cancelAnimationFrame(menuAnimationId);
        menuAnimationId = null;
    }
    
    // Si un renderer existe déjà, le supprimer
    if (menuRenderer) {
        document.body.removeChild(menuRenderer.domElement);
    }
    
    // Créer une nouvelle scène
    menuScene = new THREE.Scene();
    menuScene.background = new THREE.Color(0x87CEEB); // Ciel bleu pour l'arrière-plan
    
    // Créer la caméra
    menuCamera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
    menuCamera.position.set(0, 5, 10); // Position la caméra pour voir la course-poursuite
    menuCamera.lookAt(0, 0, 0);
    
    // Créer le renderer
    menuRenderer = new THREE.WebGLRenderer({ antialias: true });
    menuRenderer.setSize(window.innerWidth, window.innerHeight);
    menuRenderer.setPixelRatio(window.devicePixelRatio);
    menuRenderer.shadowMap.enabled = true;
    menuRenderer.domElement.style.position = 'fixed';
    menuRenderer.domElement.style.top = '0';
    menuRenderer.domElement.style.left = '0';
    menuRenderer.domElement.style.zIndex = '4999'; // En dessous du menu
    document.body.appendChild(menuRenderer.domElement);
    
    // Éclairage
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    menuScene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 10, 7.5);
    directionalLight.castShadow = true;
    menuScene.add(directionalLight);
    
    // Créer le sol selon le type de map actuelle
    createMenuGround();
    
    // Ajouter quelques éléments de décor
    createMenuScenery();
    
    // Charger le personnage et l'ennemi
    loadMenuCharacters();
}

// Créer le sol pour la scène du menu
function createMenuGround() {
    const groundGeometry = new THREE.PlaneGeometry(50, 50);
    let groundMaterial;
    
    // Définir le matériau selon le type de map
    switch (currentMapType) {
        case 'desert':
            groundMaterial = new THREE.MeshStandardMaterial({ 
                color: 0xD2B48C, // Couleur sable
                roughness: 0.9,
                metalness: 0.1
            });
            menuScene.background = new THREE.Color(0xFAE5B6); // Ciel beige pour désert
            break;
            
        case 'cave':
            groundMaterial = new THREE.MeshStandardMaterial({ 
                color: 0x696969, // Gris foncé
                roughness: 0.95,
                metalness: 0.4
            });
            menuScene.background = new THREE.Color(0x3A3A40); // Ciel gris pour grotte
            break;
            
        case 'forest':
        default:
            groundMaterial = new THREE.MeshStandardMaterial({ 
                color: 0x228B22, // Vert forêt
                roughness: 0.8,
                metalness: 0.2
            });
            menuScene.background = new THREE.Color(0x87CEEB); // Bleu ciel
            break;
    }
    
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2; // Rotation pour le mettre à plat
    ground.receiveShadow = true;
    menuScene.add(ground);
}

// Ajouter des éléments de décor à la scène du menu
function createMenuScenery() {
    // Ajouter des éléments selon le type de map
    switch (currentMapType) {
        case 'desert':
            // Ajouter quelques cactus et dunes
            for (let i = 0; i < 8; i++) {
                const x = Math.random() * 40 - 20;
                const z = Math.random() * 40 - 20;
                
                // Ne pas mettre d'obstacles sur le chemin de la course-poursuite
                if (Math.abs(x) > 3 || Math.abs(z) > 3) {
                    if (Math.random() < 0.5) {
                        createMenuCactus(x, 0, z);
                    } else {
                        createMenuDune(x, 0, z);
                    }
                }
            }
            break;
            
        case 'cave':
            // Ajouter quelques stalagmites et cristaux
            for (let i = 0; i < 8; i++) {
                const x = Math.random() * 40 - 20;
                const z = Math.random() * 40 - 20;
                
                // Ne pas mettre d'obstacles sur le chemin de la course-poursuite
                if (Math.abs(x) > 3 || Math.abs(z) > 3) {
                    if (Math.random() < 0.6) {
                        createMenuStalagmite(x, 0, z);
                    } else {
                        createMenuCrystal(x, 0, z);
                    }
                }
            }
            break;
            
        case 'forest':
        default:
            // Ajouter quelques arbres et rochers
            for (let i = 0; i < 10; i++) {
                const x = Math.random() * 40 - 20;
                const z = Math.random() * 40 - 20;
                
                // Ne pas mettre d'obstacles sur le chemin de la course-poursuite
                if (Math.abs(x) > 3 || Math.abs(z) > 3) {
                    if (Math.random() < 0.7) {
                        createMenuTree(x, 0, z);
                    } else {
                        createMenuRock(x, 0, z);
                    }
                }
            }
            break;
    }
}

// Créer un arbre simplifié pour la scène du menu
function createMenuTree(x, y, z) {
    const loader = new FBXLoader();
    loader.load('models/decors/Tree.fbx', (fbx) => {
        // Ajuster l'échelle - beaucoup plus petit
        fbx.scale.set(0.001, 0.001, 0.001);
        fbx.position.set(x, y, z);
        fbx.rotation.y = Math.random() * Math.PI * 2;
        
        // Configurer les ombres
        fbx.traverse(child => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        
        menuScene.add(fbx);
    }, undefined, (error) => {
        console.error('Erreur lors du chargement du modèle d\'arbre pour le menu:', error);
        
        // Modèle de secours
        const treeGeometry = new THREE.ConeGeometry(1, 3, 8);
        const trunkGeometry = new THREE.CylinderGeometry(0.2, 0.2, 1, 8);
        const treeMaterial = new THREE.MeshStandardMaterial({ color: 0x00AA00 });
        const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
        
        const tree = new THREE.Group();
        const crown = new THREE.Mesh(treeGeometry, treeMaterial);
        const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
        
        crown.position.y = 2;
        trunk.position.y = 0.5;
        
        crown.castShadow = true;
        trunk.castShadow = true;
        
        tree.add(crown);
        tree.add(trunk);
        tree.position.set(x, y, z);
        
        menuScene.add(tree);
    });
}

// Créer un rocher simplifié pour la scène du menu
function createMenuRock(x, y, z) {
    const rockGeometry = new THREE.DodecahedronGeometry(Math.random() * 0.5 + 0.5, 0);
    const rockMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x808080,
        roughness: 0.9
    });
    const rock = new THREE.Mesh(rockGeometry, rockMaterial);
    rock.position.set(x, y + rockGeometry.parameters.radius * 0.5, z);
    rock.rotation.set(Math.random(), Math.random(), Math.random());
    rock.castShadow = true;
    menuScene.add(rock);
}

// Créer un cactus simplifié pour la scène du menu
function createMenuCactus(x, y, z) {
    const loader = new FBXLoader();
    loader.load('models/decors/cactos.fbx', (fbx) => {
        // Ajuster l'échelle - beaucoup plus petit
        fbx.scale.set(0.001, 0.001, 0.001);
        fbx.position.set(x, y, z);
        fbx.rotation.y = Math.random() * Math.PI * 2;
        
        // Configurer les ombres et les matériaux
        fbx.traverse(child => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                if (child.material) {
                    child.material.color = new THREE.Color(0x2A7E19);
                }
            }
        });
        
        menuScene.add(fbx);
    }, undefined, (error) => {
        console.error('Erreur lors du chargement du modèle de cactus pour le menu:', error);
        
        // Modèle de secours
        const cactusGroup = new THREE.Group();
        
        // Corps principal
        const bodyGeometry = new THREE.CylinderGeometry(0.2, 0.2, 1.5, 8);
        const cactusMaterial = new THREE.MeshStandardMaterial({ color: 0x2A7E19 });
        const body = new THREE.Mesh(bodyGeometry, cactusMaterial);
        body.position.y = 0.75;
        body.castShadow = true;
        
        cactusGroup.add(body);
        cactusGroup.position.set(x, y, z);
        
        menuScene.add(cactusGroup);
    });
}

// Créer une dune simplifié pour la scène du menu
function createMenuDune(x, y, z) {
    const duneGeometry = new THREE.SphereGeometry(1.5, 8, 8, 0, Math.PI * 2, 0, Math.PI * 0.3);
    const duneMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xE6C99F,
        roughness: 1
    });
    const dune = new THREE.Mesh(duneGeometry, duneMaterial);
    dune.position.set(x, y - 0.5, z);
    dune.rotation.set(0, Math.random() * Math.PI * 2, 0);
    menuScene.add(dune);
}

// Créer une stalagmite simplifiée pour la scène du menu
function createMenuStalagmite(x, y, z) {
    const loader = new FBXLoader();
    
    // Choisir aléatoirement parmi les 4 modèles disponibles
    const rockIndex = Math.floor(Math.random() * 4) + 1;
    const rockPath = `models/decors/CaveRockPack1_Low${rockIndex}.fbx`;
    
    loader.load(rockPath, (fbx) => {
        // Ajuster l'échelle - beaucoup plus petit
        fbx.scale.set(0.001, 0.001, 0.001);
        fbx.position.set(x, y, z);
        fbx.rotation.y = Math.random() * Math.PI * 2;
        
        // Configurer les ombres et les matériaux
        fbx.traverse(child => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                if (child.material) {
                    child.material.color = new THREE.Color(0x505050);
                }
            }
        });
        
        menuScene.add(fbx);
    }, undefined, (error) => {
        console.error(`Erreur lors du chargement du modèle de stalagmite ${rockPath} pour le menu:`, error);
        
        // Modèle de secours
        const stalagmiteGeometry = new THREE.ConeGeometry(0.5, 2, 8);
        const stalagmiteMaterial = new THREE.MeshStandardMaterial({ color: 0x505050 });
        const stalagmite = new THREE.Mesh(stalagmiteGeometry, stalagmiteMaterial);
        stalagmite.position.set(x, y + 1, z);
        stalagmite.castShadow = true;
        
        menuScene.add(stalagmite);
    });
}

// Créer un cristal simplifié pour la scène du menu
function createMenuCrystal(x, y, z) {
    const height = Math.random() * 0.7 + 0.5;
    const crystalGeometry = new THREE.ConeGeometry(0.2, height, 5);
    
    // Couleur aléatoire pour les cristaux
    const colors = [0x21f4f4, 0xf421f4, 0x21f421]; // cyan, magenta, vert
    const colorIndex = Math.floor(Math.random() * colors.length);
    
    const crystalMaterial = new THREE.MeshStandardMaterial({ 
        color: colors[colorIndex],
        emissive: colors[colorIndex],
        emissiveIntensity: 0.6,
        transparent: true,
        opacity: 0.8
    });
    
    const crystal = new THREE.Mesh(crystalGeometry, crystalMaterial);
    crystal.position.set(x, y + height/2, z);
    menuScene.add(crystal);
    
    // Ajouter une lumière ponctuelle au cristal
    const light = new THREE.PointLight(colors[colorIndex], 1, 3);
    light.position.set(x, y + height, z);
    menuScene.add(light);
}

// Charger le personnage et l'ennemi pour la scène du menu
function loadMenuCharacters() {
    const loader = new FBXLoader();
    
    // Charger le personnage (écureuil)
    loader.load('models/ecureuilSama.fbx', (fbx) => {
        menuCharacter = fbx;
        menuCharacter.scale.set(0.01, 0.01, 0.01);
        menuCharacter.position.set(-5, 0, 0);
        menuScene.add(menuCharacter);
        
        // Charger l'animation de course pour l'écureuil
        loader.load('models/runMouse.fbx', (anim) => {
            menuCharacterMixer = new THREE.AnimationMixer(menuCharacter);
            const runAction = menuCharacterMixer.clipAction(anim.animations[0]);
            runAction.play();
            console.log('Animation de course du personnage chargée');
        }, undefined, (error) => {
            console.error('Erreur lors du chargement de l\'animation de course:', error);
        });
    }, undefined, (error) => {
        console.error('Erreur lors du chargement du modèle écureuil:', error);
    });
    
    // Charger l'ennemi (Whiteclown)
    loader.load('models/Whiteclown.fbx', (fbx) => {
        menuEnemy = fbx;
        menuEnemy.scale.set(0.01, 0.01, 0.01);
        menuEnemy.position.set(-8, 0, 0);
        menuScene.add(menuEnemy);
        
        // Charger l'animation de course pour l'ennemi
        loader.load('models/WhiteclownInjured.fbx', (anim) => {
            menuEnemyMixer = new THREE.AnimationMixer(menuEnemy);
            if (anim.animations && anim.animations.length > 0) {
                const runAction = menuEnemyMixer.clipAction(anim.animations[0]);
                runAction.play();
                console.log('Animation de course de l\'ennemi chargée');
            } else {
                // Essayer de charger l'animation alternative
                loader.load('models/WhiteclownInjured.fbx', (fallbackAnim) => {
                    if (fallbackAnim.animations && fallbackAnim.animations.length > 0) {
                        const runAction = menuEnemyMixer.clipAction(fallbackAnim.animations[0]);
                        runAction.play();
                        console.log('Animation alternative de l\'ennemi chargée');
                    }
                });
            }
        }, undefined, (error) => {
            console.error('Erreur lors du chargement de l\'animation de l\'ennemi:', error);
        });
    }, undefined, (error) => {
        console.error('Erreur lors du chargement du modèle ennemi:', error);
    });
}

// Fonction d'animation pour la scène d'arrière-plan du menu
function animateMenuBackground() {
    menuAnimationId = requestAnimationFrame(animateMenuBackground);
    
    // Mettre à jour les animations si disponibles
    if (menuCharacterMixer) menuCharacterMixer.update(0.016);
    if (menuEnemyMixer) menuEnemyMixer.update(0.016);
    
    // Temps écoulé depuis le début de l'animation
    const time = Date.now() * 0.001;
    const cycleTime = 10; // Durée d'un cycle complet (aller-retour)
    const currentCycle = Math.floor(time / cycleTime);
    const timeInCycle = time % cycleTime;
    const xRange = 10; // Distance de déplacement horizontal
    
    if (menuCharacter) {
        // Position du personnage
        let x;
        
        // Mouvement de gauche à droite et retour
        if (timeInCycle < cycleTime / 2) {
            // Aller vers la droite
            x = -xRange + (timeInCycle / (cycleTime / 2)) * (2 * xRange);
            menuCharacter.rotation.y = Math.PI / 2;
        } else {
            // Retour vers la gauche
            x = xRange - ((timeInCycle - cycleTime / 2) / (cycleTime / 2)) * (2 * xRange);
            menuCharacter.rotation.y = -Math.PI / 2;
        }
        
        menuCharacter.position.x = x;
        menuCharacter.position.z = 0;
    }
    
    // Gestion des ennemis
    if (menuEnemy) {
        const enemyDelay = 0.5; // Délai de suivi
        const enemySpacing = 2; // Espacement entre les ennemis
        
        // Nombre d'ennemis selon le cycle
        let numberOfEnemies;
        if (currentCycle % 3 === 0) {
            numberOfEnemies = 1;
        } else if (currentCycle % 3 === 1) {
            numberOfEnemies = 2;
        } else {
            numberOfEnemies = 3;
        }
        
        // Mettre à jour la position de chaque ennemi
        for (let i = 0; i < numberOfEnemies; i++) {
            if (!menuEnemy.children[i]) {
                // Créer un nouvel ennemi si nécessaire
                const newEnemy = menuEnemy.clone();
                newEnemy.position.set(0, 0, 0);
                menuEnemy.add(newEnemy);
            }
            
            const enemy = i === 0 ? menuEnemy : menuEnemy.children[i - 1];
            if (enemy) {
                // Suivre le personnage avec un délai
                const delayedTime = Math.max(0, timeInCycle - (enemyDelay * (i + 1)));
                let x;
                
                if (delayedTime < cycleTime / 2) {
                    x = -xRange + (delayedTime / (cycleTime / 2)) * (2 * xRange);
                    enemy.rotation.y = Math.PI / 2; // Face à droite
                } else {
                    x = xRange - ((delayedTime - cycleTime / 2) / (cycleTime / 2)) * (2 * xRange);
                    enemy.rotation.y = -Math.PI / 2; // Face à gauche
                }
                
                enemy.position.x = x;
                enemy.position.z = i * enemySpacing;
                enemy.visible = true;
                
                // Ajuster l'orientation de l'ennemi pour qu'il regarde dans la direction du mouvement
                if (enemy.children && enemy.children.length > 0) {
                    enemy.children.forEach(child => {
                        if (child.isMesh) {
                            child.rotation.y = enemy.rotation.y;
                        }
                    });
                }
            }
        }
        
        // Cacher les ennemis en trop
        for (let i = numberOfEnemies - 1; i < menuEnemy.children.length; i++) {
            if (menuEnemy.children[i]) {
                menuEnemy.children[i].visible = false;
            }
        }
    }
    
    // Rendre la scène
    menuRenderer.render(menuScene, menuCamera);
}

// Arrêter l'animation du menu en arrière-plan
function stopMenuBackgroundAnimation() {
    if (menuAnimationId) {
        cancelAnimationFrame(menuAnimationId);
        menuAnimationId = null;
    }
    
    if (menuRenderer) {
        document.body.removeChild(menuRenderer.domElement);
        menuRenderer = null;
    }
}

// Afficher l'écran de sélection de map
function showMapSelection() {
    // Supprimer l'ancien menu de sélection s'il existe
    if (mapSelectionElement) {
        document.body.removeChild(mapSelectionElement);
    }
    
    // Cacher le menu principal
    if (mainMenuElement) {
        mainMenuElement.style.display = 'none';
    }
    
    // Arrêter l'animation du menu en arrière-plan
    stopMenuBackgroundAnimation();
    
    // Créer le conteneur pour la sélection de map
    mapSelectionElement = document.createElement('div');
    mapSelectionElement.id = 'map-selection';
    mapSelectionElement.style.position = 'fixed';
    mapSelectionElement.style.top = '0';
    mapSelectionElement.style.left = '0';
    mapSelectionElement.style.width = '100%';
    mapSelectionElement.style.height = '100%';
    mapSelectionElement.style.backgroundColor = 'rgba(0, 0, 0, 0.85)';
    mapSelectionElement.style.display = 'flex';
    mapSelectionElement.style.flexDirection = 'column';
    mapSelectionElement.style.justifyContent = 'center';
    mapSelectionElement.style.alignItems = 'center';
    mapSelectionElement.style.zIndex = '5000';
    
    // Ajouter le titre
    const title = document.createElement('h1');
    title.textContent = 'Sélection de Map';
    title.style.color = 'white';
    title.style.fontSize = '36px';
    title.style.marginBottom = '40px';
    mapSelectionElement.appendChild(title);
    
    // Conteneur pour les cartes de maps
    const mapsContainer = document.createElement('div');
    mapsContainer.style.display = 'flex';
    mapsContainer.style.justifyContent = 'center';
    mapsContainer.style.gap = '30px';
    mapsContainer.style.marginBottom = '40px';
    mapSelectionElement.appendChild(mapsContainer);
    
    // Définir les informations de chaque map
    const maps = [
        { 
            type: 'forest', 
            name: 'Forêt', 
            description: 'Map de base, avec arbres et rochers.', 
            color: '#228B22',
            difficulty: 'Facile',
            previewColor: '#228B22'
        },
        { 
            type: 'desert', 
            name: 'Désert', 
            description: 'Cactus et dunes de sable. Débloquer: 5K pts sur Forêt.', 
            color: '#D2B48C',
            difficulty: 'Moyen',
            previewColor: '#D2B48C',
            unlockThreshold: MAP_UNLOCK_THRESHOLDS.desert,
            requiredMap: 'forest'
        },
        { 
            type: 'cave', 
            name: 'Grotte', 
            description: 'Stalagmites et cristaux. Débloquer: 10K pts sur Désert.', 
            color: '#696969',
            difficulty: 'Difficile',
            previewColor: '#696969',
            unlockThreshold: MAP_UNLOCK_THRESHOLDS.cave,
            requiredMap: 'desert'
        }
    ];
    
    // Créer une carte pour chaque map
    maps.forEach(map => {
        // Vérifier si la map est débloquée
        const isUnlocked = unlockedMaps.includes(map.type);
        
        // Créer la carte
        const mapCard = document.createElement('div');
        mapCard.style.width = '200px';
        mapCard.style.height = '280px';
        mapCard.style.backgroundColor = 'rgba(40, 40, 40, 0.8)';
        mapCard.style.border = `2px solid ${isUnlocked ? map.color : '#555'}`;
        mapCard.style.borderRadius = '10px';
        mapCard.style.overflow = 'hidden';
        mapCard.style.display = 'flex';
        mapCard.style.flexDirection = 'column';
        mapCard.style.transition = 'transform 0.2s, box-shadow 0.2s';
        
        // Aperçu de la map
        const preview = document.createElement('div');
        preview.style.height = '100px';
        preview.style.backgroundColor = map.previewColor;
        preview.style.position = 'relative';
        
        // Ajouter de petites formes représentatives selon le type de map
        if (map.type === 'forest') {
            // Ajouter des arbres stylisés
            for (let i = 0; i < 4; i++) {
                const tree = document.createElement('div');
                tree.style.position = 'absolute';
                tree.style.width = '10px';
                tree.style.height = '30px';
                tree.style.backgroundColor = '#8B4513';
                tree.style.bottom = '0';
                tree.style.left = `${20 + i * 40}px`;
                
                const leaves = document.createElement('div');
                leaves.style.position = 'absolute';
                leaves.style.width = '30px';
                leaves.style.height = '30px';
                leaves.style.backgroundColor = '#006400';
                leaves.style.borderRadius = '50%';
                leaves.style.top = '-15px';
                leaves.style.left = '-10px';
                
                tree.appendChild(leaves);
                preview.appendChild(tree);
            }
        } else if (map.type === 'desert') {
            // Ajouter des cactus stylisés
            for (let i = 0; i < 3; i++) {
                const cactus = document.createElement('div');
                cactus.style.position = 'absolute';
                cactus.style.width = '8px';
                cactus.style.height = '25px';
                cactus.style.backgroundColor = '#2E8B57';
                cactus.style.bottom = '0';
                cactus.style.left = `${30 + i * 60}px`;
                
                // Ajouter une branche
                const branch = document.createElement('div');
                branch.style.position = 'absolute';
                branch.style.width = '15px';
                branch.style.height = '8px';
                branch.style.backgroundColor = '#2E8B57';
                branch.style.top = '5px';
                branch.style.left = '8px';
                
                cactus.appendChild(branch);
                preview.appendChild(cactus);
            }
        } else if (map.type === 'cave') {
            // Ajouter des stalagmites stylisées
            for (let i = 0; i < 5; i++) {
                const stalagmite = document.createElement('div');
                stalagmite.style.position = 'absolute';
                stalagmite.style.width = '10px';
                stalagmite.style.height = `${15 + Math.random() * 20}px`;
                stalagmite.style.backgroundColor = '#505050';
                stalagmite.style.bottom = '0';
                stalagmite.style.left = `${20 + i * 35}px`;
                stalagmite.style.clipPath = 'polygon(50% 0%, 0% 100%, 100% 100%)';
                
                preview.appendChild(stalagmite);
                
                // Ajouter quelques cristaux lumineux
                if (i % 2 === 0) {
                    const crystal = document.createElement('div');
                    crystal.style.position = 'absolute';
                    crystal.style.width = '8px';
                    crystal.style.height = '12px';
                    crystal.style.backgroundColor = '#21f4f4';
                    crystal.style.bottom = '10px';
                    crystal.style.left = `${40 + i * 30}px`;
                    crystal.style.clipPath = 'polygon(50% 0%, 0% 100%, 100% 100%)';
                    crystal.style.opacity = '0.8';
                    crystal.style.boxShadow = '0 0 10px #21f4f4';
                    
                    preview.appendChild(crystal);
                }
            }
        }
        
        mapCard.appendChild(preview);
        
        // Informations de la map
        const info = document.createElement('div');
        info.style.padding = '15px';
        info.style.flex = '1';
        info.style.display = 'flex';
        info.style.flexDirection = 'column';
        
        // Titre de la map
        const name = document.createElement('h3');
        name.textContent = map.name;
        name.style.color = 'white';
        name.style.margin = '0 0 10px 0';
        name.style.textAlign = 'center';
        
        // Statut de déverrouillage
        const status = document.createElement('div');
        status.style.fontWeight = 'bold';
        status.style.marginBottom = '10px';
        status.style.textAlign = 'center';
        status.style.fontSize = '14px';
        
        if (isUnlocked) {
            status.textContent = 'DÉBLOQUÉE';
            status.style.color = '#4CAF50';
        } else {
            status.textContent = 'VERROUILLÉE';
            status.style.color = '#F44336';
        }
        
        // Description de la map
        const description = document.createElement('p');
        description.textContent = map.description;
        description.style.color = '#ccc';
        description.style.margin = '0 0 10px 0';
        description.style.fontSize = '12px';
        description.style.flex = '1';
        
        // Difficulté
        const difficulty = document.createElement('div');
        difficulty.textContent = `Difficulté: ${map.difficulty}`;
        difficulty.style.fontSize = '12px';
        difficulty.style.color = '#aaa';
        
        // Meilleur score
        const highScore = document.createElement('div');
        highScore.textContent = `Meilleur score: ${mapHighScores[map.type] || 0}`;
        highScore.style.fontSize = '12px';
        highScore.style.color = '#ff7700';
        highScore.style.marginTop = '5px';
        
        // Ajouter tous les éléments
        info.appendChild(name);
        info.appendChild(status);
        info.appendChild(description);
        info.appendChild(difficulty);
        info.appendChild(highScore);
        
        mapCard.appendChild(info);
        
        // Effet de survol (seulement pour les maps débloquées)
        if (isUnlocked) {
            mapCard.style.cursor = 'pointer';
            
            mapCard.onmouseenter = () => {
                mapCard.style.transform = 'scale(1.05)';
                mapCard.style.boxShadow = `0 0 20px ${map.color}`;
            };
            
            mapCard.onmouseleave = () => {
                mapCard.style.transform = 'scale(1)';
                mapCard.style.boxShadow = 'none';
            };
            
            // Sélectionner cette map au clic
            mapCard.onclick = () => {
                // Définir la map et revenir au menu principal
                if (changeMap(map.type)) {
                    document.body.removeChild(mapSelectionElement);
                    createMainMenu(); // Recréer le menu principal pour afficher les nouvelles informations
                }
            };
        } else {
            // Style "désactivé" pour les maps verrouillées
            mapCard.style.filter = 'grayscale(70%)';
            mapCard.style.opacity = '0.7';
            
            // Afficher les conditions de déverrouillage au clic
            mapCard.onclick = () => {
                showWaveMessage(`Pour débloquer "${map.name}", obtenez ${map.unlockThreshold} points sur la map "${maps.find(m => m.type === map.requiredMap).name}"`, 4000);
            };
        }
        
        mapsContainer.appendChild(mapCard);
    });
    
    // Bouton pour revenir au menu principal
    const backButton = createMenuButton('Retour', () => {
        document.body.removeChild(mapSelectionElement);
        createMainMenu();
    });
    
    mapSelectionElement.appendChild(backButton);
    
    // Ajouter l'écran de sélection au document
    document.body.appendChild(mapSelectionElement);
    
    // Réinitialiser les variables de jeu
    score = 0;
    waveNumber = 0;
    enemiesKilled = 0;
    
    // Réinitialiser les bonus
    window.fireballDamage = 50;
    window.scoreMultiplier = 1;
    window.playerShield = 0;
    window.multishot = false;
    characterSpeed = 0.06;
    fireballCooldown = 500;
    
    // Supprimer tous les ennemis
    for (let i = enemies.length - 1; i >= 0; i--) {
        scene.remove(enemies[i]);
    }
    enemies = [];
    
    // Recréer l'environnement selon la map actuelle
    createGround();
    createScenery();
    
    // Repositionner le personnage
    if (character) {
        character.position.set(0, 0.3, 0);
    }
    
    // Démarrer le jeu
    gameStarted = true;
    startNextWave();
    
    // Reprendre l'animation
    if (!animationFrameId) {
        animate();
    }
}

// Mettre le jeu en pause
function togglePause() {
    if (!gameStarted || isMainMenuVisible) return;
    
    isPaused = !isPaused;
    
    if (isPaused) {
        // Afficher le menu pause
        createPauseMenu();
        
        // Stopper l'animation
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
    } else {
        // Cacher le menu pause
        if (pauseMenuElement) {
            pauseMenuElement.style.display = 'none';
        }
        
        // Reprendre l'animation
        if (!animationFrameId) {
            animate();
        }
    }
}

// Reprendre le jeu depuis le menu pause
function resumeGame() {
    if (isPaused) {
        togglePause();
    }
}

// Afficher le menu principal
function showMainMenu() {
    // Arrêter le jeu en cours
    gameStarted = false;
    isPaused = false;
    
    // Cacher le menu pause s'il existe
    if (pauseMenuElement) {
        document.body.removeChild(pauseMenuElement);
        pauseMenuElement = null;
    }
    
    // Supprimer tous les éléments de jeu
    cleanupGameElements();
    
    // Afficher le menu principal
    createMainMenu();
    isMainMenuVisible = true;
    
    // Stopper l'animation
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    
    // Réinitialiser les variables de jeu
    resetGameState();
}

// Nettoyer tous les éléments de jeu
function cleanupGameElements() {
    // Supprimer tous les ennemis
    for (let i = enemies.length - 1; i >= 0; i--) {
        if (enemies[i] && enemies[i].parent) {
            scene.remove(enemies[i]);
        }
    }
    enemies = [];
    
    // Supprimer toutes les boules de feu
    if (fireballGroup) {
        while (fireballGroup.children.length > 0) {
            fireballGroup.remove(fireballGroup.children[0]);
        }
    }
    
    // Supprimer le laser s'il existe
    const existingLaser = scene.getObjectByName("playerLaser");
    if (existingLaser) {
        scene.remove(existingLaser);
    }
    
    // Supprimer les éléments d'UI
    if (scoreDisplay) {
        document.body.removeChild(scoreDisplay);
        scoreDisplay = null;
    }
    
    if (healthBarElement) {
        document.body.removeChild(healthBarElement);
        healthBarElement = null;
    }
    
    // Supprimer tous les obstacles
    for (let i = obstacleObjects.length - 1; i >= 0; i--) {
        if (obstacleObjects[i] && obstacleObjects[i].parent) {
            scene.remove(obstacleObjects[i]);
        }
    }
    obstacleObjects = [];
    
    // Recréer le sol et le décor pour le menu
    createGround();
    createScenery();
}

// Réinitialiser les variables d'état du jeu
function resetGameState() {
    // Réinitialiser les scores et compteurs
    score = 0;
    waveNumber = 0;
    enemiesKilled = 0;
    enemiesPerWave = 5;
    
    // Réinitialiser la santé
    currentHealth = playerHealth;
    
    // Réinitialiser les bonus
    window.fireballDamage = 50;
    window.scoreMultiplier = 1;
    window.playerShield = 0;
    window.multishot = false;
    characterSpeed = 0.06;
    fireballCooldown = 500;
    
    // Réinitialiser les contrôles
    moveForward = false;
    moveBackward = false;
    moveLeft = false;
    moveRight = false;
    lastDirection.set(0, 0, 1);
}

// Afficher les contrôles
function showControls() {
    // Supprimer l'ancien écran des contrôles s'il existe
    if (controlsElement) {
        document.body.removeChild(controlsElement);
    }
    
    // Cacher le menu principal
    if (mainMenuElement) {
        mainMenuElement.style.display = 'none';
    }
    
    // Arrêter l'animation du menu en arrière-plan
    stopMenuBackgroundAnimation();
    
    // Créer une fenêtre de dialogue pour les contrôles
    controlsElement = document.createElement('div');
    controlsElement.style.position = 'fixed';
    controlsElement.style.top = '50%';
    controlsElement.style.left = '50%';
    controlsElement.style.transform = 'translate(-50%, -50%)';
    controlsElement.style.width = '400px';
    controlsElement.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
    controlsElement.style.color = 'white';
    controlsElement.style.padding = '20px';
    controlsElement.style.borderRadius = '10px';
    controlsElement.style.zIndex = '6000';
    
    // Ajouter le titre
    const title = document.createElement('h2');
    title.textContent = 'Contrôles';
    title.style.textAlign = 'center';
    title.style.marginBottom = '20px';
    controlsElement.appendChild(title);
    
    // Ajouter les contrôles
    const controlsList = document.createElement('ul');
    controlsList.style.listStyleType = 'none';
    controlsList.style.padding = '0';
    
    const controls = [
        'WASD / Flèches : Déplacer le personnage',
        'Souris : Viser',
        'F : Lancer une boule de feu',
        'Echap : Pause',
        'H : Afficher l\'aide'
    ];
    
    controls.forEach(control => {
        const item = document.createElement('li');
        item.textContent = control;
        item.style.marginBottom = '10px';
        controlsList.appendChild(item);
    });
    
    controlsElement.appendChild(controlsList);
    
    // Bouton de fermeture
    const closeButton = document.createElement('div');
    closeButton.textContent = 'Fermer';
    closeButton.style.backgroundColor = 'rgba(255, 120, 0, 0.8)';
    closeButton.style.color = 'white';
    closeButton.style.padding = '10px';
    closeButton.style.textAlign = 'center';
    closeButton.style.borderRadius = '5px';
    closeButton.style.cursor = 'pointer';
    closeButton.style.marginTop = '20px';
    
    closeButton.onclick = () => {
        document.body.removeChild(controlsElement);
        // Recréer le menu principal
        createMainMenu();
    };
    
    controlsElement.appendChild(closeButton);
    
    // Ajouter la fenêtre au document
    document.body.appendChild(controlsElement);
}

// Afficher les informations "À propos"
function showAbout() {
    // Supprimer l'ancien écran "À propos" s'il existe
    if (aboutElement) {
        document.body.removeChild(aboutElement);
    }
    
    // Cacher le menu principal
    if (mainMenuElement) {
        mainMenuElement.style.display = 'none';
    }
    
    // Arrêter l'animation du menu en arrière-plan
    stopMenuBackgroundAnimation();
    
    // Créer une fenêtre de dialogue pour les informations
    aboutElement = document.createElement('div');
    aboutElement.style.position = 'fixed';
    aboutElement.style.top = '50%';
    aboutElement.style.left = '50%';
    aboutElement.style.transform = 'translate(-50%, -50%)';
    aboutElement.style.width = '400px';
    aboutElement.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
    aboutElement.style.color = 'white';
    aboutElement.style.padding = '20px';
    aboutElement.style.borderRadius = '10px';
    aboutElement.style.zIndex = '6000';
    
    // Ajouter le titre
    const title = document.createElement('h2');
    title.textContent = 'À Propos';
    title.style.textAlign = 'center';
    title.style.marginBottom = '20px';
    aboutElement.appendChild(title);
    
    // Ajouter les informations
    const info = document.createElement('p');
    info.innerHTML = 'Bataille de Fireballs<br><br>Un jeu de tir développé avec Three.js.<br><br>Combattez des vagues d\'ennemis, collectez des bonus et améliorez vos compétences pour obtenir le meilleur score!';
    info.style.textAlign = 'center';
    info.style.lineHeight = '1.6';
    aboutElement.appendChild(info);
    
    // Bouton de fermeture
    const closeButton = document.createElement('div');
    closeButton.textContent = 'Fermer';
    closeButton.style.backgroundColor = 'rgba(255, 120, 0, 0.8)';
    closeButton.style.color = 'white';
    closeButton.style.padding = '10px';
    closeButton.style.textAlign = 'center';
    closeButton.style.borderRadius = '5px';
    closeButton.style.cursor = 'pointer';
    closeButton.style.marginTop = '20px';
    
    closeButton.onclick = () => {
        document.body.removeChild(aboutElement);
        // Recréer le menu principal
        createMainMenu();
    };
    
    aboutElement.appendChild(closeButton);
    
    // Ajouter la fenêtre au document
    document.body.appendChild(aboutElement);
}

// Changer de map
function changeMap(mapType) {
    if (!unlockedMaps.includes(mapType)) {
        console.log(`La map ${mapType} n'est pas débloquée!`);
        
        // Afficher un message
        const requiredScore = MAP_UNLOCK_THRESHOLDS[mapType];
        let requiredMap = 'forest';
        
        if (mapType === 'cave') {
            requiredMap = 'desert';
        }
        
        showWaveMessage(`Vous devez obtenir ${requiredScore} points sur la map ${requiredMap} pour débloquer cette map!`, 3000);
        return false;
    }
    
    // Si la map est débloquée, la définir comme map actuelle
    currentMapType = mapType;
    
    // Recréer l'environnement
    createGround();
    createScenery();
    
    // Déplacer le personnage à sa position de départ
    if (character) {
        character.position.set(0, 0.3, 0);
    }
    
    console.log(`Map changée pour: ${mapType}`);
    return true;
}

// Démarrage de l'application
init(); 

// Démarrer une nouvelle partie
function startNewGame() {
    // Cacher le menu principal
    if (mainMenuElement) {
        mainMenuElement.style.display = 'none';
        isMainMenuVisible = false;
    }
    
    // Arrêter l'animation du menu en arrière-plan
    stopMenuBackgroundAnimation();
    
    // Afficher la sélection de sorts
    showSpellSelection();
}

// Afficher l'écran de sélection de sorts
function showSpellSelection() {
    // Supprimer l'ancien écran de sélection s'il existe
    if (spellSelectionElement) {
        document.body.removeChild(spellSelectionElement);
    }
    
    // Créer le conteneur pour la sélection de sorts
    spellSelectionElement = document.createElement('div');
    spellSelectionElement.id = 'spell-selection';
    spellSelectionElement.style.position = 'fixed';
    spellSelectionElement.style.top = '0';
    spellSelectionElement.style.left = '0';
    spellSelectionElement.style.width = '100%';
    spellSelectionElement.style.height = '100%';
    spellSelectionElement.style.backgroundColor = 'rgba(0, 0, 0, 0.85)';
    spellSelectionElement.style.display = 'flex';
    spellSelectionElement.style.flexDirection = 'column';
    spellSelectionElement.style.justifyContent = 'center';
    spellSelectionElement.style.alignItems = 'center';
    spellSelectionElement.style.zIndex = '5000';
    
    // Ajouter le titre
    const title = document.createElement('h1');
    title.textContent = 'Choisissez votre sort';
    title.style.color = 'white';
    title.style.fontSize = '36px';
    title.style.marginBottom = '40px';
    spellSelectionElement.appendChild(title);
    
    // Conteneur pour les cartes de sorts
    const spellsContainer = document.createElement('div');
    spellsContainer.style.display = 'flex';
    spellsContainer.style.justifyContent = 'center';
    spellsContainer.style.gap = '30px';
    spellsContainer.style.marginBottom = '40px';
    spellSelectionElement.appendChild(spellsContainer);
    
    // Définir les informations de chaque sort
    const spells = [
        { 
            type: 'fireball', 
            name: 'Boule de Feu', 
            description: 'Sort classique qui lance une boule de feu explosive.', 
            color: '#ff5500',
            damage: '50 pts de dégâts',
            cooldown: 'Délai: 0.5s',
            icon: '🔥'
        },
        { 
            type: 'lightning', 
            name: 'Éclair', 
            description: 'Invoque un éclair qui frappe instantanément la zone ciblée.', 
            color: '#00ccff',
            damage: '75 pts de dégâts',
            cooldown: 'Délai: 1.5s',
            icon: '⚡'
        },
        { 
            type: 'laser', 
            name: 'Rayon Laser', 
            description: 'Projette un rayon continu qui inflige des dégâts constants.', 
            color: '#ff00ff',
            damage: '20 pts/sec',
            cooldown: 'Continu avec surchauffe',
            icon: '🌟'
        }
    ];
    
    // Créer une carte pour chaque sort
    spells.forEach(spell => {
        // Créer la carte
        const spellCard = document.createElement('div');
        spellCard.style.width = '250px';
        spellCard.style.height = '300px';
        spellCard.style.backgroundColor = 'rgba(40, 40, 40, 0.8)';
        spellCard.style.border = `2px solid ${spell.color}`;
        spellCard.style.borderRadius = '10px';
        spellCard.style.overflow = 'hidden';
        spellCard.style.display = 'flex';
        spellCard.style.flexDirection = 'column';
        spellCard.style.transition = 'transform 0.2s, box-shadow 0.2s';
        spellCard.style.cursor = 'pointer';
        
        // En-tête avec icône et nom
        const header = document.createElement('div');
        header.style.display = 'flex';
        header.style.alignItems = 'center';
        header.style.padding = '15px';
        header.style.backgroundColor = `${spell.color}33`; // Couleur avec transparence
        header.style.borderBottom = `1px solid ${spell.color}`;
        
        const icon = document.createElement('div');
        icon.textContent = spell.icon;
        icon.style.fontSize = '30px';
        icon.style.marginRight = '15px';
        
        const name = document.createElement('h3');
        name.textContent = spell.name;
        name.style.color = 'white';
        name.style.margin = '0';
        
        header.appendChild(icon);
        header.appendChild(name);
        spellCard.appendChild(header);
        
        // Prévisualisation du sort
        const preview = document.createElement('div');
        preview.style.height = '100px';
        preview.style.backgroundColor = `${spell.color}22`; // Couleur très transparente
        preview.style.position = 'relative';
        preview.style.overflow = 'hidden';
        
        // Animation de prévisualisation selon le type de sort
        if (spell.type === 'fireball') {
            // Animation de boule de feu
            const fireball = document.createElement('div');
            fireball.style.position = 'absolute';
            fireball.style.width = '20px';
            fireball.style.height = '20px';
            fireball.style.backgroundColor = '#ff5500';
            fireball.style.borderRadius = '50%';
            fireball.style.boxShadow = '0 0 15px #ff5500, 0 0 5px #ff9900';
            fireball.style.left = '20px';
            fireball.style.top = '40px';
            fireball.style.animation = 'fireballAnim 2s infinite';
            
            // Définir l'animation
            const style = document.createElement('style');
            style.textContent = `
                @keyframes fireballAnim {
                    0% { left: 20px; }
                    60% { left: 180px; opacity: 1; }
                    80% { opacity: 0; }
                    100% { left: 20px; opacity: 0; }
                }
            `;
            document.head.appendChild(style);
            
            preview.appendChild(fireball);
        } else if (spell.type === 'lightning') {
            // Animation d'éclair
            const lightning = document.createElement('div');
            lightning.style.position = 'absolute';
            lightning.style.width = '8px';
            lightning.style.height = '100px';
            lightning.style.background = 'linear-gradient(to bottom, transparent, #00ccff, transparent)';
            lightning.style.left = '121px';
            lightning.style.top = '0';
            lightning.style.opacity = '0';
            lightning.style.animation = 'lightningAnim 3s infinite';
            
            // Définir l'animation
            const style = document.createElement('style');
            style.textContent = `
                @keyframes lightningAnim {
                    0%, 100% { opacity: 0; }
                    20%, 21% { opacity: 0.8; }
                    22%, 23% { opacity: 0; }
                    24%, 25% { opacity: 1; }
                    26%, 70% { opacity: 0; }
                }
            `;
            document.head.appendChild(style);
            
            preview.appendChild(lightning);
        } else if (spell.type === 'laser') {
            // Animation de laser
            const laser = document.createElement('div');
            laser.style.position = 'absolute';
            laser.style.width = '3px';
            laser.style.height = '100px';
            laser.style.backgroundColor = '#ff00ff';
            laser.style.boxShadow = '0 0 10px #ff00ff';
            laser.style.left = '124px';
            laser.style.top = '0';
            laser.style.transformOrigin = 'center bottom';
            laser.style.animation = 'laserAnim 4s infinite';
            
            // Définir l'animation
            const style = document.createElement('style');
            style.textContent = `
                @keyframes laserAnim {
                    0%, 100% { transform: rotate(0deg); opacity: 0; }
                    5% { opacity: 1; }
                    45% { transform: rotate(30deg); }
                    50% { transform: rotate(30deg); opacity: 1; }
                    55% { opacity: 0; }
                    70% { transform: rotate(0deg); }
                }
            `;
            document.head.appendChild(style);
            
            preview.appendChild(laser);
        }
        
        spellCard.appendChild(preview);
        
        // Informations du sort
        const info = document.createElement('div');
        info.style.padding = '15px';
        info.style.flex = '1';
        info.style.display = 'flex';
        info.style.flexDirection = 'column';
        info.style.color = 'white';
        
        // Description
        const description = document.createElement('p');
        description.textContent = spell.description;
        description.style.color = '#ccc';
        description.style.margin = '0 0 10px 0';
        description.style.fontSize = '14px';
        description.style.flex = '1';
        
        // Caractéristiques du sort (dégâts, cooldown)
        const stats = document.createElement('div');
        stats.style.fontSize = '12px';
        stats.style.color = '#aaa';
        
        const damage = document.createElement('div');
        damage.textContent = `Dégâts: ${spell.damage}`;
        damage.style.marginBottom = '5px';
        
        const cooldown = document.createElement('div');
        cooldown.textContent = spell.cooldown;
        
        stats.appendChild(damage);
        stats.appendChild(cooldown);
        
        info.appendChild(description);
        info.appendChild(stats);
        spellCard.appendChild(info);
        
        // Effets de survol
        spellCard.onmouseenter = () => {
            spellCard.style.transform = 'scale(1.05)';
            spellCard.style.boxShadow = `0 0 20px ${spell.color}`;
        };
        
        spellCard.onmouseleave = () => {
            spellCard.style.transform = 'scale(1)';
            spellCard.style.boxShadow = 'none';
        };
        
        // Sélectionner ce sort au clic
        spellCard.onclick = () => {
            // Définir le sort choisi
            currentSpellType = spell.type;
            
            // Retirer l'écran de sélection
            document.body.removeChild(spellSelectionElement);
            
            // Démarrer la partie
            startActualGame();
        };
        
        spellsContainer.appendChild(spellCard);
    });
    
    document.body.appendChild(spellSelectionElement);
}

// Démarrer réellement le jeu après la sélection du sort
function startActualGame() {
    // Réinitialiser la santé du joueur
    currentHealth = playerHealth;
    
    // Créer l'interface utilisateur
    createUI();
    
    // Réinitialiser le jeu
    startGame();
    
    // Démarrer l'animation si nécessaire
    if (!animationFrameId) {
        animate();
    }
}

// Mettre à jour la barre de vie
function updateHealthBar() {
    if (!healthBarElement) return;
    
    const healthFill = document.getElementById('health-bar-fill');
    const healthText = document.getElementById('health-bar-text');
    
    if (healthFill && healthText) {
        // Calculer le pourcentage de vie
        const healthPercent = (currentHealth / playerHealth) * 100;
        
        // Animation fluide de la barre de vie
        healthFill.style.transition = 'width 0.4s ease-out, background-color 0.4s';
        
        // Mettre à jour la largeur de la barre
        healthFill.style.width = `${healthPercent}%`;
        
        // Changer la couleur en fonction de la vie restante avec une transition fluide
        if (healthPercent > 60) {
            healthFill.style.backgroundColor = '#2ecc71'; // Vert
        } else if (healthPercent > 30) {
            healthFill.style.backgroundColor = '#f39c12'; // Orange
        } else {
            healthFill.style.backgroundColor = '#e74c3c'; // Rouge
        }
        
        // Ajouter un effet de pulsation quand la vie est basse
        if (healthPercent <= 25) {
            healthFill.style.animation = 'pulse 1.5s infinite';
            if (!document.getElementById('health-pulse-style')) {
                const style = document.createElement('style');
                style.id = 'health-pulse-style';
                style.textContent = `
                    @keyframes pulse {
                        0% { opacity: 1; }
                        50% { opacity: 0.6; }
                        100% { opacity: 1; }
                    }
                `;
                document.head.appendChild(style);
            }
        } else {
            healthFill.style.animation = 'none';
        }
        
        // Mettre à jour le texte avec animation
        healthText.textContent = `${Math.ceil(currentHealth)}/${playerHealth}`;
        healthText.style.transition = 'transform 0.2s ease-out';
        healthText.style.transform = 'scale(1.1)';
        setTimeout(() => {
            healthText.style.transform = 'scale(1)';
        }, 200);
    }
}

// Infliger des dégâts au joueur
function damagePlayer(amount) {
    // Si le joueur est invulnérable, ne pas infliger de dégâts
    if (isPlayerInvulnerable) return;
    
    // Activer l'invulnérabilité temporaire
    isPlayerInvulnerable = true;
    
    // Effet sonore de dégâts (si disponible)
    if (window.soundEffects && window.soundEffects.playerHit) {
        window.soundEffects.playerHit.currentTime = 0;
        window.soundEffects.playerHit.play().catch(e => console.log("Erreur lecture audio:", e));
    }
    
    // Réduire la santé immédiatement (correction du bug)
    currentHealth = Math.max(0, currentHealth - amount);
    updateHealthBar();
    
    // Afficher des effets visuels pour les dégâts
    if (camera) {
        const initialPosition = camera.position.clone();
        const intensity = amount / playerHealth * 0.5; // Intensité basée sur les dégâts
        
        const shake = () => {
            camera.position.x = initialPosition.x + (Math.random() - 0.5) * intensity;
            camera.position.y = initialPosition.y + (Math.random() - 0.5) * intensity;
            camera.position.z = initialPosition.z + (Math.random() - 0.5) * intensity;
        };
        
        // Secouer pendant 500ms
        const shakeInterval = setInterval(shake, 40);
        setTimeout(() => {
            clearInterval(shakeInterval);
            camera.position.copy(initialPosition);
        }, 500);
    }
    
    // Vérifier si le joueur est mort
    if (currentHealth <= 0) {
        playerDeath();
    } else {
        // Flash rouge sur tout l'écran pour indiquer des dégâts
        const damageFlash = document.createElement('div');
        damageFlash.style.position = 'fixed';
        damageFlash.style.top = '0';
        damageFlash.style.left = '0';
        damageFlash.style.width = '100%';
        damageFlash.style.height = '100%';
        damageFlash.style.backgroundColor = `rgba(255, 0, 0, ${Math.min(0.6, amount / playerHealth + 0.3)})`;
        damageFlash.style.zIndex = '9999';
        damageFlash.style.pointerEvents = 'none';
        damageFlash.style.boxShadow = 'inset 0 0 50px rgba(200, 0, 0, 0.8)';
        damageFlash.style.transition = 'opacity 0.6s ease-out';
        document.body.appendChild(damageFlash);
        
        // Ajouter un effet vignette pour plus d'impact
        const vignette = document.createElement('div');
        vignette.style.position = 'fixed';
        vignette.style.top = '0';
        vignette.style.left = '0';
        vignette.style.width = '100%';
        vignette.style.height = '100%';
        vignette.style.pointerEvents = 'none';
        vignette.style.zIndex = '9998';
        vignette.style.boxShadow = 'inset 0 0 150px rgba(255, 0, 0, 0.7)';
        vignette.style.opacity = '0.7';
        vignette.style.transition = 'opacity 1.2s ease-out';
        document.body.appendChild(vignette);
        
        // Effet de pulsation sur le personnage pour indiquer les dégâts
        if (character) {
            // Clignotement rouge sur le modèle du personnage
            character.traverse(obj => {
                if (obj.isMesh && obj.material) {
                    obj.userData.originalColor = obj.material.color.clone();
                    obj.material.color.set(0xff0000);
                    obj.material.needsUpdate = true;
                }
            });
            
            // Séquence de clignotement
            let blinkCount = 0;
            const maxBlinks = 3;
            const blinkInterval = setInterval(() => {
                blinkCount++;
                character.traverse(obj => {
                    if (obj.isMesh && obj.material) {
                        if (blinkCount % 2 === 0) {
                            // Restaurer la couleur originale
                            if (obj.userData.originalColor) {
                                obj.material.color.copy(obj.userData.originalColor);
                            }
                        } else {
                            // Couleur rouge
                            obj.material.color.set(0xff0000);
                        }
                        obj.material.needsUpdate = true;
                    }
                });
                
                if (blinkCount >= maxBlinks * 2) {
                    clearInterval(blinkInterval);
                    // Restaurer définitivement les couleurs originales
                    character.traverse(obj => {
                        if (obj.isMesh && obj.material && obj.userData.originalColor) {
                            obj.material.color.copy(obj.userData.originalColor);
                            obj.material.needsUpdate = true;
                        }
                    });
                }
            }, 150);
        }
        
        // Faire disparaître les effets visuels progressivement
        setTimeout(() => {
            damageFlash.style.opacity = '0';
            setTimeout(() => {
                if (damageFlash.parentNode) {
                    document.body.removeChild(damageFlash);
                }
            }, 600);
            
            vignette.style.opacity = '0';
            setTimeout(() => {
                if (vignette.parentNode) {
                    document.body.removeChild(vignette);
                }
            }, 1200);
        }, 100);
        
        // Désactiver l'invulnérabilité après un délai
        setTimeout(() => {
            isPlayerInvulnerable = false;
        }, 1000);
    }
}

// Gestion de la mort du joueur
function playerDeath() {
    // Arrêter le jeu
    gameStarted = false;
    
    // Afficher un message de game over
    const gameOverElement = document.createElement('div');
    gameOverElement.style.position = 'fixed';
    gameOverElement.style.top = '50%';
    gameOverElement.style.left = '50%';
    gameOverElement.style.transform = 'translate(-50%, -50%)';
    gameOverElement.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    gameOverElement.style.color = 'white';
    gameOverElement.style.padding = '30px';
    gameOverElement.style.borderRadius = '10px';
    gameOverElement.style.textAlign = 'center';
    gameOverElement.style.zIndex = '10000';
    gameOverElement.style.fontFamily = 'Arial, sans-serif';
    
    // Titre Game Over
    const gameOverTitle = document.createElement('h1');
    gameOverTitle.textContent = 'GAME OVER';
    gameOverTitle.style.color = '#e74c3c';
    gameOverTitle.style.fontSize = '36px';
    gameOverTitle.style.marginBottom = '20px';
    gameOverElement.appendChild(gameOverTitle);
    
    // Score final
    const scoreElement = document.createElement('p');
    scoreElement.textContent = `Score final: ${score}`;
    scoreElement.style.fontSize = '24px';
    scoreElement.style.marginBottom = '20px';
    gameOverElement.appendChild(scoreElement);
    
    // Bouton pour retourner au menu
    const menuButton = createMenuButton('Retour au Menu', () => {
        document.body.removeChild(gameOverElement);
        // Réinitialiser la santé pour la prochaine partie
        currentHealth = playerHealth;
        showMainMenu();
    });
    menuButton.style.margin = '10px auto';
    gameOverElement.appendChild(menuButton);
    
    document.body.appendChild(gameOverElement);
    
    // Sauvegarder le score si c'est un record
    updateMapScore();
    saveProgress();
}

// Créer et lancer une boule de feu avec un décalage d'angle
function createAndShootFireball(angleOffset) {
    // Créer une boule de feu
    const fireball = createFireball();
    
    // Utiliser la dernière direction du personnage
    const direction = lastDirection.clone();
    
    // Changer la direction de base vers l'avant (axe Z positif)
    direction.set(0, 0, 1);
    direction.applyAxisAngle(new THREE.Vector3(0, 1, 0), character.rotation.y + angleOffset);
    
    // Stocker les dégâts de la boule de feu
    fireball.userData = {
        damage: window.fireballDamage || 50 // Dégâts par défaut ou dégâts augmentés
    };
    
    // Animation de la boule de feu
    const animate = () => {
        // Déplacer la boule de feu dans la direction
        fireball.position.addScaledVector(direction, 0.2);
        
        // Ajouter une rotation à la boule de feu pour effet visuel
        fireball.rotation.x += 0.05;
        fireball.rotation.y += 0.05;
        
        // Ajouter un effet de particules (simple scaling pulse)
        const scale = 1 + 0.05 * Math.sin(Date.now() * 0.01);
        fireball.scale.set(scale, scale, scale);
        
        // Continuer l'animation si la boule de feu est encore visible
        if (fireball.position.length() < 20) {
            requestAnimationFrame(animate);
        } else {
            // Supprimer la boule de feu quand elle est trop loin
            fireballGroup.remove(fireball);
        }
    };
    
    // Démarrer l'animation
    animate();
}

// Créer le menu pause
function createPauseMenu() {
    // Supprimer l'ancien menu pause s'il existe
    if (pauseMenuElement) {
        document.body.removeChild(pauseMenuElement);
    }
    
    // Créer le conteneur du menu
    pauseMenuElement = document.createElement('div');
    pauseMenuElement.id = 'pause-menu';
    pauseMenuElement.style.position = 'fixed';
    pauseMenuElement.style.top = '0';
    pauseMenuElement.style.left = '0';
    pauseMenuElement.style.width = '100%';
    pauseMenuElement.style.height = '100%';
    pauseMenuElement.style.backgroundColor = 'rgba(0, 0, 0, 0.75)';
    pauseMenuElement.style.display = 'flex';
    pauseMenuElement.style.flexDirection = 'column';
    pauseMenuElement.style.justifyContent = 'center';
    pauseMenuElement.style.alignItems = 'center';
    pauseMenuElement.style.zIndex = '5000';
    
    // Ajouter le titre
    const title = document.createElement('h1');
    title.textContent = 'PAUSE';
    title.style.color = '#ff7700';
    title.style.fontSize = '48px';
    title.style.fontFamily = 'Arial, sans-serif';
    title.style.textShadow = '0 0 10px rgba(255, 150, 0, 0.8)';
    title.style.marginBottom = '40px';
    pauseMenuElement.appendChild(title);
    
    // Conteneur pour les statistiques
    const statsContainer = document.createElement('div');
    statsContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    statsContainer.style.padding = '20px';
    statsContainer.style.borderRadius = '10px';
    statsContainer.style.marginBottom = '30px';
    statsContainer.style.color = 'white';
    statsContainer.style.width = '300px';
    statsContainer.style.textAlign = 'center';
    
    // Obtenir le nom de la map en français
    let mapName = 'Forêt';
    if (currentMapType === 'desert') mapName = 'Désert';
    if (currentMapType === 'cave') mapName = 'Grotte';
    
    // Statistiques actuelles
    statsContainer.innerHTML = `
        <div style="margin-bottom: 5px;"><span style="color: #aaa;">Score actuel:</span> <span style="color: #ff7700;">${score}</span></div>
        <div style="margin-bottom: 5px;"><span style="color: #aaa;">Vague:</span> <span style="color: #ff7700;">${waveNumber}</span></div>
        <div style="margin-bottom: 5px;"><span style="color: #aaa;">Ennemis tués:</span> <span style="color: #ff7700;">${enemiesKilled}</span></div>
        <div><span style="color: #aaa;">Map:</span> <span style="color: #ff7700;">${mapName}</span></div>
    `;
    pauseMenuElement.appendChild(statsContainer);
    
    // Ajouter les boutons
    const buttons = [
        { text: 'Reprendre', action: resumeGame },
        { text: 'Options', action: showOptions },
        { text: 'Menu Principal', action: confirmQuit }
    ];
    
    buttons.forEach(buttonInfo => {
        const button = createMenuButton(buttonInfo.text, buttonInfo.action);
        pauseMenuElement.appendChild(button);
    });
    
    // Ajouter le menu au document
    document.body.appendChild(pauseMenuElement);
}

// Afficher les options (volume, difficulté, etc.)
function showOptions() {
    // Créer une fenêtre de dialogue pour les options
    const optionsDialog = document.createElement('div');
    optionsDialog.style.position = 'fixed';
    optionsDialog.style.top = '50%';
    optionsDialog.style.left = '50%';
    optionsDialog.style.transform = 'translate(-50%, -50%)';
    optionsDialog.style.width = '400px';
    optionsDialog.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
    optionsDialog.style.color = 'white';
    optionsDialog.style.padding = '20px';
    optionsDialog.style.borderRadius = '10px';
    optionsDialog.style.zIndex = '6000';
    
    // Ajouter le titre
    const title = document.createElement('h2');
    title.textContent = 'Options';
    title.style.textAlign = 'center';
    title.style.marginBottom = '20px';
    optionsDialog.appendChild(title);
    
    // Option de difficulté
    const difficultyContainer = document.createElement('div');
    difficultyContainer.style.marginBottom = '20px';
    
    const difficultyLabel = document.createElement('div');
    difficultyLabel.textContent = 'Difficulté:';
    difficultyLabel.style.marginBottom = '10px';
    difficultyContainer.appendChild(difficultyLabel);
    
    // Boutons de difficulté
    const difficultyButtons = document.createElement('div');
    difficultyButtons.style.display = 'flex';
    difficultyButtons.style.justifyContent = 'space-between';
    
    ['Facile', 'Normal', 'Difficile'].forEach(level => {
        const button = document.createElement('div');
        button.textContent = level;
        button.style.padding = '8px 15px';
        button.style.backgroundColor = 'rgba(80, 80, 80, 0.5)';
        button.style.borderRadius = '5px';
        button.style.cursor = 'pointer';
        
        // Afficher la difficulté actuelle comme sélectionnée
        if (level === 'Normal') {
            button.style.backgroundColor = 'rgba(255, 120, 0, 0.8)';
        }
        
        button.onmouseenter = () => {
            if (level !== 'Normal') {
                button.style.backgroundColor = 'rgba(100, 100, 100, 0.7)';
            }
        };
        
        button.onmouseleave = () => {
            if (level !== 'Normal') {
                button.style.backgroundColor = 'rgba(80, 80, 80, 0.5)';
            }
        };
        
        difficultyButtons.appendChild(button);
    });
    
    difficultyContainer.appendChild(difficultyButtons);
    optionsDialog.appendChild(difficultyContainer);
    
    // Curseur de volume
    const volumeContainer = document.createElement('div');
    volumeContainer.style.marginBottom = '20px';
    
    const volumeLabel = document.createElement('div');
    volumeLabel.textContent = 'Volume:';
    volumeLabel.style.marginBottom = '10px';
    volumeContainer.appendChild(volumeLabel);
    
    const volumeSlider = document.createElement('input');
    volumeSlider.type = 'range';
    volumeSlider.min = '0';
    volumeSlider.max = '100';
    volumeSlider.value = '80';
    volumeSlider.style.width = '100%';
    volumeContainer.appendChild(volumeSlider);
    
    optionsDialog.appendChild(volumeContainer);
    
    // Bouton de fermeture
    const closeButton = document.createElement('div');
    closeButton.textContent = 'Fermer';
    closeButton.style.backgroundColor = 'rgba(255, 120, 0, 0.8)';
    closeButton.style.color = 'white';
    closeButton.style.padding = '10px';
    closeButton.style.textAlign = 'center';
    closeButton.style.borderRadius = '5px';
    closeButton.style.cursor = 'pointer';
    closeButton.style.marginTop = '20px';
    
    closeButton.onmouseenter = () => {
        closeButton.style.backgroundColor = 'rgba(255, 150, 0, 0.9)';
    };
    
    closeButton.onmouseleave = () => {
        closeButton.style.backgroundColor = 'rgba(255, 120, 0, 0.8)';
    };
    
    closeButton.onclick = () => {
        document.body.removeChild(optionsDialog);
    };
    
    optionsDialog.appendChild(closeButton);
    
    // Ajouter la fenêtre au document
    document.body.appendChild(optionsDialog);
}

// Demander confirmation avant de quitter
function confirmQuit() {
    // Créer une fenêtre de dialogue de confirmation
    const confirmDialog = document.createElement('div');
    confirmDialog.style.position = 'fixed';
    confirmDialog.style.top = '50%';
    confirmDialog.style.left = '50%';
    confirmDialog.style.transform = 'translate(-50%, -50%)';
    confirmDialog.style.width = '400px';
    confirmDialog.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
    confirmDialog.style.color = 'white';
    confirmDialog.style.padding = '20px';
    confirmDialog.style.borderRadius = '10px';
    confirmDialog.style.zIndex = '6000';
    confirmDialog.style.textAlign = 'center';
    
    // Ajouter le message
    const message = document.createElement('p');
    message.textContent = 'Êtes-vous sûr de vouloir quitter la partie ? Votre score actuel sera sauvegardé.';
    message.style.marginBottom = '30px';
    message.style.fontSize = '16px';
    confirmDialog.appendChild(message);
    
    // Conteneur pour les boutons
    const buttonsContainer = document.createElement('div');
    buttonsContainer.style.display = 'flex';
    buttonsContainer.style.justifyContent = 'space-around';
    
    // Bouton Oui
    const yesButton = document.createElement('div');
    yesButton.textContent = 'Oui';
    yesButton.style.backgroundColor = '#e74c3c';
    yesButton.style.color = 'white';
    yesButton.style.padding = '10px 30px';
    yesButton.style.textAlign = 'center';
    yesButton.style.borderRadius = '5px';
    yesButton.style.cursor = 'pointer';
    
    yesButton.onmouseenter = () => {
        yesButton.style.backgroundColor = '#c0392b';
    };
    
    yesButton.onmouseleave = () => {
        yesButton.style.backgroundColor = '#e74c3c';
    };
    
    yesButton.onclick = () => {
        // Sauvegarder le score avant de quitter
        updateMapScore();
        saveProgress();
        
        document.body.removeChild(confirmDialog);
        showMainMenu();
    };
    
    // Bouton Non
    const noButton = document.createElement('div');
    noButton.textContent = 'Non';
    noButton.style.backgroundColor = '#3498db';
    noButton.style.color = 'white';
    noButton.style.padding = '10px 30px';
    noButton.style.textAlign = 'center';
    noButton.style.borderRadius = '5px';
    noButton.style.cursor = 'pointer';
    
    noButton.onmouseenter = () => {
        noButton.style.backgroundColor = '#2980b9';
    };
    
    noButton.onmouseleave = () => {
        noButton.style.backgroundColor = '#3498db';
    };
    
    noButton.onclick = () => {
        document.body.removeChild(confirmDialog);
    };
    
    buttonsContainer.appendChild(noButton); // Non en premier (gauche)
    buttonsContainer.appendChild(yesButton); // Oui en second (droite)
    
    confirmDialog.appendChild(buttonsContainer);
    
    // Ajouter la fenêtre au document
    document.body.appendChild(confirmDialog);
}

// Précharger les modèles d'ennemis une seule fois
function preloadEnemyModels(callback) {
    // Si le modèle est déjà chargé ou en cours de chargement, ne rien faire
    if (enemyModelCache || isEnemyModelLoading) {
        if (callback) callback();
        return;
    }
    
    isEnemyModelLoading = true;
    console.log("Préchargement des modèles d'ennemis...");
    
    const loader = new FBXLoader();
    
    // Charger le modèle principal
    loader.load('models/Whiteclown.fbx', (model) => {
        // Configurer correctement le modèle avant de le mettre en cache
        model.scale.set(0.01, 0.01, 0.01);
        model.traverse(child => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        
        enemyModelCache = model;
        console.log("Modèle d'ennemi préchargé");
        
        // Ne pas essayer de précharger l'animation qui cause des erreurs
        isEnemyModelLoading = false;
        if (callback) callback();
    }, undefined, (error) => {
        console.error('Erreur lors du préchargement du modèle:', error);
        isEnemyModelLoading = false;
        
        if (callback) callback();
    });
}