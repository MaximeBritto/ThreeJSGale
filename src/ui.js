// Interface utilisateur (UI) pour le jeu de Fireballs
import * as THREE from 'three';

// Variables UI
let scoreDisplay;
let healthBarElement;
let mainMenuElement, mapSelectionElement;
let pauseMenuElement;
let controlsElement, aboutElement;
let optionsDialogElement;
let spellSelectionElement;

// Variables pour la scène de fond du menu
let menuScene, menuCamera, menuRenderer;
let menuCharacter, menuEnemy;
let menuCharacterMixer, menuEnemyMixer;
let menuAnimationId;

// Fonctions d'affichage et de mise à jour de l'UI
export function showInstructions() {
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

export function createUI(currentHealth, playerHealth) {
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
    
    // Mettre à jour l'affichage du score (initialisation)
    updateScoreDisplay({score: 0, waveNumber: 0, enemiesKilled: 0, enemiesPerWave: 0});
    
    // Mettre à jour la barre de vie (initialisation)
    updateHealthBar(currentHealth, playerHealth);
    
    return { scoreDisplay, healthBarElement };
}

export function updateScoreDisplay(gameState) {
    const { score, waveNumber, enemiesKilled, enemiesPerWave } = gameState;
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

export function showWaveMessage(message, duration = 3000) {
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

export function createMenuButton(text, onClick) {
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

export function createMainMenu(gameConfig) {
    const { 
        currentMapType, 
        mapHighScores, 
        startNewGame, 
        showMapSelection, 
        showControls, 
        showAbout 
    } = gameConfig;
    
    // Supprimer l'ancien menu s'il existe
    if (mainMenuElement) {
        document.body.removeChild(mainMenuElement);
    }
    
    // Créer une scène d'animation en arrière-plan
    createMenuBackgroundScene(currentMapType);
    
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
    
    return mainMenuElement;
}

export function createMenuBackgroundScene(currentMapType) {
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
    createMenuGround(currentMapType);
    
    // Ajouter quelques éléments de décor
    createMenuScenery();
    
    // Charger le personnage et l'ennemi
    loadMenuCharacters();
}

// Fonction qui sera implémentée dans un module externe
export function createMenuGround(currentMapType) {
    // Créer le sol du menu (à implémenter)
}

// Fonction qui sera implémentée dans un module externe
export function createMenuScenery() {
    // Créer le décor du menu (à implémenter)
}

// Fonction qui sera implémentée dans un module externe
export function loadMenuCharacters() {
    // Charger les personnages du menu (à implémenter)
}

// Fonction qui sera implémentée dans un module externe
export function animateMenuBackground() {
    // Animer l'arrière-plan du menu (à implémenter)
}

export function updateHealthBar(currentHealth, playerHealth) {
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

export function createPauseMenu(gameConfig) {
    const { 
        score, 
        waveNumber, 
        enemiesKilled, 
        currentMapType, 
        resumeGame, 
        showOptions, 
        confirmQuit 
    } = gameConfig;
    
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
    
    return pauseMenuElement;
}

export function showOptions() {
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
    
    // Inclure ici le reste de la fonction showOptions 
    // pour gérer les options de difficulté, volume, etc.
    
    document.body.appendChild(optionsDialog);
    optionsDialogElement = optionsDialog;
    
    return optionsDialog;
}

export function showFireballCooldown(ratio) {
    const cooldownIndicator = document.getElementById('fireball-cooldown');
    if (!cooldownIndicator) return;
    
    // Afficher l'indicateur
    cooldownIndicator.style.display = 'block';
    
    // Mettre à jour la couleur basée sur le ratio du cooldown
    const hue = Math.floor(ratio * 120); // 0 (rouge) à 120 (vert)
    cooldownIndicator.style.backgroundColor = `hsla(${hue}, 100%, 50%, 0.5)`;
    
    // Effet de remplissage (masquer une partie du cercle pour indiquer le cooldown)
    const updateCooldown = () => {
        // Utiliser clip-path pour créer un effet de remplissage circulaire
        // Calculer l'angle basé sur le ratio (1.0 = plein, 0.0 = vide)
        const angle = ratio * 360;
        
        if (angle >= 360) {
            // Indicateur complet (prêt)
            cooldownIndicator.style.clipPath = 'none';
            
            // Faire disparaître l'indicateur après un court délai
            setTimeout(() => {
                cooldownIndicator.style.transition = 'opacity 0.5s';
                cooldownIndicator.style.opacity = '0';
                setTimeout(() => {
                    cooldownIndicator.style.display = 'none';
                    cooldownIndicator.style.opacity = '1';
                    cooldownIndicator.style.transition = '';
                }, 500);
            }, 300);
        } else {
            // Indicateur partiel (en cooldown)
            let clipPath;
            
            if (angle <= 180) {
                // Première moitié du cercle
                const x = 50 + 50 * Math.sin(angle * Math.PI / 180);
                const y = 50 - 50 * Math.cos(angle * Math.PI / 180);
                clipPath = `polygon(50% 50%, 50% 0%, ${x}% ${y}%, 50% 50%)`;
            } else {
                // Seconde moitié du cercle
                const startAngle = angle - 180;
                const x = 50 - 50 * Math.sin(startAngle * Math.PI / 180);
                const y = 50 + 50 * Math.cos(startAngle * Math.PI / 180);
                clipPath = `polygon(50% 50%, 50% 0%, 100% 0%, 100% 50%, 100% 100%, 50% 100%, 0% 100%, 0% 50%, 0% 0%, 50% 0%, ${x}% ${y}%, 50% 50%)`;
            }
            
            cooldownIndicator.style.clipPath = clipPath;
        }
    };
    
    updateCooldown();
}

export function playerDeath(score, showMainMenu) {
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
        showMainMenu();
    });
    menuButton.style.margin = '10px auto';
    gameOverElement.appendChild(menuButton);
    
    document.body.appendChild(gameOverElement);
    
    return gameOverElement;
}

// Cette fonction permet de fermer n'importe quel dialogue UI
export function closeDialog(dialogElement) {
    if (dialogElement && dialogElement.parentNode) {
        document.body.removeChild(dialogElement);
    }
}

// Afficher l'écran de sélection de sorts
export function showSpellSelection(startActualGame) {
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
        
        // Description et infos
        const description = document.createElement('div');
        description.style.padding = '15px';
        description.style.flex = '1';
        
        const descText = document.createElement('p');
        descText.textContent = spell.description;
        descText.style.color = 'white';
        descText.style.fontSize = '14px';
        descText.style.marginTop = '0';
        
        const stats = document.createElement('div');
        stats.style.marginTop = '15px';
        stats.style.borderTop = '1px solid rgba(255, 255, 255, 0.2)';
        stats.style.paddingTop = '10px';
        
        const damage = document.createElement('p');
        damage.textContent = `Dégâts: ${spell.damage}`;
        damage.style.color = 'white';
        damage.style.margin = '5px 0';
        damage.style.fontSize = '13px';
        
        const cooldown = document.createElement('p');
        cooldown.textContent = spell.cooldown;
        cooldown.style.color = 'white';
        cooldown.style.margin = '5px 0';
        cooldown.style.fontSize = '13px';
        
        stats.appendChild(damage);
        stats.appendChild(cooldown);
        
        description.appendChild(descText);
        description.appendChild(stats);
        spellCard.appendChild(description);
        
        // Effet de survol
        spellCard.onmouseenter = () => {
            spellCard.style.transform = 'scale(1.05)';
            spellCard.style.boxShadow = `0 0 20px ${spell.color}`;
        };
        
        spellCard.onmouseleave = () => {
            spellCard.style.transform = 'scale(1)';
            spellCard.style.boxShadow = 'none';
        };
        
        // Fonction de sélection du sort
        spellCard.onclick = () => {
            // Stocker le type de sort sélectionné dans une variable locale
            const currentSpellType = spell.type;
            
            // Masquer l'écran de sélection et démarrer le jeu
            document.body.removeChild(spellSelectionElement);
            // Passer le type de sort sélectionné à la fonction de callback
            startActualGame(spell.type);
        };
        
        spellsContainer.appendChild(spellCard);
    });
    
    document.body.appendChild(spellSelectionElement);
    
    return spellSelectionElement;
}

// Exporter d'autres fonctions UI spécifiques selon besoin 