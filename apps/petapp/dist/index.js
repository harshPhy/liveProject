import 'process';
import express from 'express';
const port = 8000;
const app = express();
const petNames = [
    'Adrien',
    'Amande',
    'Amélie',
    'Antoinette',
    'Bonaparte',
    'Beignet',
    'Benoit',
    'Brie',
    'Brioche',
    'Cannelé',
    'Cassoulet',
    'Chouchou',
    'Coco',
    'Delphine',
    'Descartes',
    'Doudou',
    'Éclair',
    'Elie',
    'Elroy',
    'Fabrice',
    'Fenouil',
    'Fleur',
    'Frite',
    'Fromage',
    'Ganache',
    'Gaston',
    'Hugo',
    'Kaki',
    'Laurent',
    'Litchi',
    'Louis',
    'Lucille',
    'Marcel',
    'Marjolaine',
    'Maxime',
    'Miel',
    'Monet',
    'Napoleon',
    'Navet',
    'Odette',
    'Ottilie',
    'Pamplemousse',
    'Papillon',
    'Pascale',
    'Pierre',
    'Quincy',
    'Sinclair',
    'Valentin',
    'Vanille',
];
app.get('/', (req, res) => {
    res.send(petNames[Math.floor(Math.random() * petNames.length)]);
});
const server = app.listen(port, () => {
    console.log(`PetApp listening on port ${port}`);
});
function signalHandler(signal) {
    console.log('SIGINT received. Shutting down.');
    server.close(() => {
        console.log('Express server closed. Exiting.');
        process.exit(0);
    });
}
process.on('SIGTERM', () => signalHandler('SIGTERM'));
process.on('SIGINT', () => signalHandler('SIGINT'));
//# sourceMappingURL=index.js.map