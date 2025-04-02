# Scène Three.js avec modèles FBX

Ce projet est une application Three.js qui permet de charger et d'afficher des modèles 3D au format FBX.

## Structure du projet

- `public/` - Fichiers statiques (HTML, CSS, assets)
- `src/` - Code source JavaScript
  - `main.js` - Point d'entrée de l'application
  - `modelLoader.js` - Gestionnaire de modèles FBX
  - `exemple.js` - Exemple d'utilisation du gestionnaire de modèles
- `models/` - Dossier pour stocker les modèles FBX
- `dist/` - Dossier de build (généré automatiquement)

## Installation

```bash
# Installer les dépendances
npm install
```

## Développement

```bash
# Lancer le serveur de développement
npm run dev
```

## Production

```bash
# Compiler pour la production
npm run build

# Prévisualiser la version de production
npm run preview
```

## Utilisation

### Ajouter un modèle FBX

1. Placez votre fichier FBX dans le dossier `models/`
2. Utilisez la fonction `addModelToList` du fichier `src/modelLoader.js` pour l'ajouter à la liste des modèles

```javascript
import { addModelToList } from './modelLoader';

// Ajouter un modèle
addModelToList('nom_du_modele', '/models/nom_du_fichier.fbx', {
    scale: 0.01,
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 }
});
```

Consultez le fichier `src/exemple.js` pour plus d'exemples. 