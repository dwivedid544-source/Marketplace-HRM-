const https = require('https');
const fs = require('fs');
const path = require('path');

const modelsDir = path.join(__dirname, 'public', 'models');

if (!fs.existsSync(modelsDir)) {
    fs.mkdirSync(modelsDir, { recursive: true });
}

const baseUrl = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/';

const files = [
    'tiny_face_detector_model-weights_manifest.json',
    'tiny_face_detector_model-shard1',
    'face_landmark_68_model-weights_manifest.json',
    'face_landmark_68_model-shard1',
    'face_recognition_model-weights_manifest.json',
    'face_recognition_model-shard1',
    'face_recognition_model-shard2',
    'face_expression_model-weights_manifest.json',
    'face_expression_model-shard1'
];

async function downloadFile(filename) {
    const filePath = path.join(modelsDir, filename);
    const url = baseUrl + filename;

    return new Promise((resolve, reject) => {
        https.get(url, (response) => {
            if (response.statusCode === 200) {
                const file = fs.createWriteStream(filePath);
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    console.log(`✅ Downloaded: ${filename}`);
                    resolve();
                });
            } else if (response.statusCode === 302 || response.statusCode === 301) {
                // follow redirect
                https.get(response.headers.location, (responseRedirect) => {
                    const file = fs.createWriteStream(filePath);
                    responseRedirect.pipe(file);
                    file.on('finish', () => {
                        file.close();
                        console.log(`✅ Downloaded: ${filename}`);
                        resolve();
                    });
                }).on('error', reject);
            } else {
                reject(new Error(`Failed to get '${url}' (${response.statusCode})`));
            }
        }).on('error', reject);
    });
}

async function run() {
    console.log('Downloading face-api.js models...');
    try {
        for (const file of files) {
            await downloadFile(file);
        }
        console.log('🎉 All models downloaded successfully!');
    } catch (err) {
        console.error('❌ Error downloading models:', err);
    }
}

run();
