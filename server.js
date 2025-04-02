import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.join(__dirname, 'dist');
const modelsDir = path.join(__dirname, 'models');

// Vérifier si le dossier dist existe
if (!fs.existsSync(distDir)) {
  console.error('ERREUR: Le dossier "dist" n\'existe pas. Veuillez exécuter "npm run build" avant de démarrer le serveur.');
  console.error('Assurez-vous que la commande de build a été exécutée avec succès.');
  process.exit(1);
}

// Vérifier si index.html existe dans le dossier dist
const indexPath = path.join(distDir, 'index.html');
if (!fs.existsSync(indexPath)) {
  console.error('ERREUR: Le fichier "index.html" n\'existe pas dans le dossier "dist".');
  console.error('La compilation Vite semble avoir échoué. Vérifiez les erreurs dans le processus de build.');
  process.exit(1);
}

// Vérifier si le dossier models existe
if (!fs.existsSync(modelsDir)) {
  console.warn('ATTENTION: Le dossier "models" n\'existe pas à la racine du projet.');
  console.warn('Les modèles 3D risquent de ne pas être accessibles.');
  
  // Créer un dossier models vide
  try {
    fs.mkdirSync(modelsDir);
    console.log('Dossier "models" créé.');
  } catch (err) {
    console.error('Impossible de créer le dossier models:', err);
  }
} else {
  console.log(`Dossier models trouvé à: ${modelsDir}`);
  try {
    const modelFiles = fs.readdirSync(modelsDir);
    console.log(`Fichiers dans le dossier models: ${modelFiles.join(', ')}`);
  } catch (err) {
    console.error('Erreur lors de la lecture du dossier models:', err);
  }
}

// Créer une copie des modèles dans dist/models si nécessaire
const distModelsDir = path.join(distDir, 'models');
if (!fs.existsSync(distModelsDir) && fs.existsSync(modelsDir)) {
  try {
    // Récursive copie du dossier models vers dist/models
    fs.mkdirSync(distModelsDir, { recursive: true });
    copyFolderRecursiveSync(modelsDir, distDir);
    console.log(`Modèles copiés de ${modelsDir} vers ${distModelsDir}`);
  } catch (err) {
    console.error('Erreur lors de la copie des modèles:', err);
  }
}

const app = express();
const PORT = process.env.PORT || 3000;

console.log(`Serveur démarré - Mode: ${process.env.NODE_ENV || 'development'}`);
console.log(`Dossier statique principal: ${distDir}`);

// Logger pour déboguer les requêtes
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Servir le dossier models directement (priorité 1)
app.use('/models', express.static(modelsDir));

// Servir les fichiers statiques du répertoire dist créé par Vite
app.use(express.static(distDir));

// Route de test pour vérifier si les fichiers modèles sont accessibles
app.get('/check-models', (req, res) => {
  const results = {
    rootDir: __dirname,
    models: {
      path: modelsDir,
      exists: fs.existsSync(modelsDir),
      files: []
    },
    distModels: {
      path: distModelsDir,
      exists: fs.existsSync(distModelsDir),
      files: []
    }
  };
  
  // Vérifier les fichiers dans le dossier models
  if (results.models.exists) {
    try {
      results.models.files = fs.readdirSync(modelsDir);
    } catch (error) {
      results.models.error = error.message;
    }
  }
  
  // Vérifier les fichiers dans le dossier dist/models
  if (results.distModels.exists) {
    try {
      results.distModels.files = fs.readdirSync(distModelsDir);
    } catch (error) {
      results.distModels.error = error.message;
    }
  }
  
  res.json(results);
});

// Pour toutes les autres routes, renvoyer le fichier index.html
app.get('*', (req, res) => {
  res.sendFile(indexPath);
});

app.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
  console.log('Prêt à servir l\'application Three.js');
  console.log('Pour vérifier les modèles, visitez: http://localhost:${PORT}/check-models');
});

// Fonction pour copier un dossier et son contenu de manière récursive
function copyFolderRecursiveSync(source, target) {
  const targetFolder = path.join(target, path.basename(source));
  
  // Créer le dossier cible s'il n'existe pas
  if (!fs.existsSync(targetFolder)) {
    fs.mkdirSync(targetFolder, { recursive: true });
  }
  
  // Lire le contenu du dossier source
  if (fs.lstatSync(source).isDirectory()) {
    const files = fs.readdirSync(source);
    
    // Copier chaque fichier/dossier
    files.forEach(file => {
      const curSource = path.join(source, file);
      
      // Récursion si c'est un dossier
      if (fs.lstatSync(curSource).isDirectory()) {
        copyFolderRecursiveSync(curSource, targetFolder);
      } else {
        // Copier le fichier
        fs.copyFileSync(curSource, path.join(targetFolder, file));
      }
    });
  }
} 