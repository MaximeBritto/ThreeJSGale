import { addModelToList } from './modelLoader';

/**
 * Exemple d'utilisation du gestionnaire de modèles FBX
 * Ce fichier montre comment ajouter des modèles à la liste des modèles à charger
 */

// Exemple d'ajout d'un modèle
export function ajouterExempleDeModele() {
    // Ajout du modèle ecureuilSama qui est déjà dans le dossier models
    addModelToList('ecureuil', 'models/ecureuilSama.fbx', {
        scale: 0.05,  // Échelle pour meilleure visibilité
        position: { x: 0, y: -1, z: 0 },  // Décalé vers le bas pour être visible
        rotation: { x: 0, y: 0, z: 0 }  // Pas de rotation pour déboguer
    });

    // Autres modèles commentés car ils n'existent pas encore
    /*
    // Ajout d'un décor
    addModelToList('decor', '/models/decor.fbx', {
        scale: 0.1,
        position: { x: -5, y: 0, z: -5 }
    });

    // Ajout d'un objet
    addModelToList('objet', '/models/objet.fbx', {
        scale: 0.05,
        position: { x: 2, y: 0, z: 1 },
        rotation: { x: 0, y: Math.PI / 4, z: 0 }
    });
    */
}

/**
 * Pour utiliser cet exemple, importez cette fonction 
 * dans votre fichier main.js et appelez-la avant de charger les modèles
 * 
 * Exemple:
 * 
 * import { ajouterExempleDeModele } from './exemple';
 * 
 * // Dans votre fonction init()
 * ajouterExempleDeModele();
 * loadModels(scene);
 */ 