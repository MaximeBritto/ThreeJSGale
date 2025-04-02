# Dossier des modèles FBX

Placez vos fichiers de modèles FBX dans ce dossier. 

Pour ajouter un nouveau modèle à votre application:

1. Placez le fichier .fbx dans ce dossier
2. Utilisez la fonction `addModelToList` du fichier `src/modelLoader.js` pour l'ajouter à la liste des modèles

Exemple d'utilisation:

```javascript
import { addModelToList } from './modelLoader';

// Ajouter un modèle
addModelToList('personnage', '/models/personnage.fbx', {
    scale: 0.01,
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: Math.PI }
});
``` 