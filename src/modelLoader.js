import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

// Liste des modèles à charger
const MODEL_LIST = {
    // Exemple de modèle: 
    // 'nom_du_modele': {
    //     path: '/models/nom_du_fichier.fbx',
    //     scale: 0.01,
    //     position: { x: 0, y: 0, z: 0 },
    //     rotation: { x: 0, y: 0, z: 0 }
    // }
};

// Cache des modèles chargés
const modelCache = {};

/**
 * Charge un modèle FBX
 * @param {string} modelName - Nom du modèle dans MODEL_LIST
 * @returns {Promise<THREE.Object3D>} - Promesse contenant le modèle chargé
 */
export function loadFBXModel(modelName) {
    // Vérification que le modèle existe dans la liste
    if (!MODEL_LIST[modelName]) {
        console.error(`Modèle "${modelName}" non trouvé dans la liste des modèles`);
        return Promise.reject(`Modèle "${modelName}" non trouvé`);
    }

    // Si le modèle est déjà en cache, on renvoie une copie
    if (modelCache[modelName]) {
        console.log(`Utilisation du modèle en cache: ${modelName}`);
        const cachedModel = modelCache[modelName].clone();
        return Promise.resolve(cachedModel);
    }

    // Sinon, on charge le modèle
    const modelInfo = MODEL_LIST[modelName];
    const loader = new FBXLoader();
    
    console.log(`Tentative de chargement du modèle: ${modelName} depuis ${modelInfo.path}`);

    return new Promise((resolve, reject) => {
        try {
            loader.load(
                modelInfo.path,
                (object) => {
                    console.log(`Modèle chargé avec succès: ${modelName}`);
                    
                    // Application des transformations
                    if (modelInfo.scale) {
                        object.scale.set(modelInfo.scale, modelInfo.scale, modelInfo.scale);
                        console.log(`Échelle appliquée: ${modelInfo.scale}`);
                    }

                    if (modelInfo.position) {
                        object.position.set(
                            modelInfo.position.x || 0,
                            modelInfo.position.y || 0,
                            modelInfo.position.z || 0
                        );
                        console.log(`Position appliquée: x=${modelInfo.position.x}, y=${modelInfo.position.y}, z=${modelInfo.position.z}`);
                    }

                    if (modelInfo.rotation) {
                        object.rotation.set(
                            modelInfo.rotation.x || 0,
                            modelInfo.rotation.y || 0,
                            modelInfo.rotation.z || 0
                        );
                    }

                    // Activation des ombres
                    object.traverse((child) => {
                        if (child.isMesh) {
                            child.castShadow = true;
                            child.receiveShadow = true;
                        }
                    });

                    // Mise en cache du modèle
                    modelCache[modelName] = object.clone();
                    
                    resolve(object);
                },
                // Progression du chargement
                (xhr) => {
                    console.log(`${modelName}: ${(xhr.loaded / xhr.total * 100).toFixed(0)}% chargé`);
                },
                // Erreur de chargement
                (error) => {
                    console.error(`Erreur lors du chargement du modèle ${modelName}:`, error);
                    console.error(`Chemin du modèle: ${modelInfo.path}`);
                    reject(error);
                }
            );
        } catch (error) {
            console.error(`Exception lors du chargement du modèle ${modelName}:`, error);
            reject(error);
        }
    });
}

/**
 * Charge tous les modèles dans la scène
 * @param {THREE.Scene} scene - La scène Three.js
 */
export function loadModels(scene) {
    // Pour chaque modèle dans la liste
    const modelNames = Object.keys(MODEL_LIST);
    console.log(`Chargement de ${modelNames.length} modèles: ${modelNames.join(', ')}`);
    
    Object.keys(MODEL_LIST).forEach(modelName => {
        loadFBXModel(modelName)
            .then(model => {
                scene.add(model);
                console.log(`Modèle "${modelName}" ajouté à la scène`);
            })
            .catch(error => {
                console.error(`Erreur lors du chargement du modèle ${modelName}:`, error);
            });
    });
}

/**
 * Ajoute un nouveau modèle à la liste
 * @param {string} modelName - Nom unique du modèle
 * @param {string} path - Chemin vers le fichier FBX
 * @param {Object} options - Options supplémentaires (scale, position, rotation)
 */
export function addModelToList(modelName, path, options = {}) {
    MODEL_LIST[modelName] = {
        path,
        scale: options.scale || 1,
        position: options.position || { x: 0, y: 0, z: 0 },
        rotation: options.rotation || { x: 0, y: 0, z: 0 }
    };
    
    console.log(`Modèle "${modelName}" ajouté à la liste des modèles avec le chemin: ${path}`);
    return MODEL_LIST[modelName];
} 