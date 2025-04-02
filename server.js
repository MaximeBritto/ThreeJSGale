import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.join(__dirname, 'dist');

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

const app = express();
const PORT = process.env.PORT || 3000;

console.log(`Serveur démarré - Mode: ${process.env.NODE_ENV || 'development'}`);
console.log(`Dossier statique: ${distDir}`);

// Servir les fichiers statiques du répertoire dist créé par Vite
app.use(express.static(distDir));

// Pour toutes les routes, renvoyer le fichier index.html
app.get('*', (req, res) => {
  res.sendFile(indexPath);
});

app.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
  console.log('Prêt à servir l\'application Three.js');
}); 