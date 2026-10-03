import { useState, useEffect } from 'react';
import * as faceapi from 'face-api.js';

// Global state to prevent reloading across component unmounts
let globalModelsLoaded = false;
let globalLoadingPromise = null;

export const preloadFaceModels = () => {
    if (globalModelsLoaded || globalLoadingPromise) return globalLoadingPromise;

    const MODEL_URL = '/models';
    globalLoadingPromise = Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL)
    ]).then(() => {
        globalModelsLoaded = true;
    }).catch((err) => {
        console.error("Failed to load face-api models:", err);
        throw err;
    });

    return globalLoadingPromise;
};

export const useFaceModels = () => {
    const [isLoaded, setIsLoaded] = useState(globalModelsLoaded);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (globalModelsLoaded) {
            setIsLoaded(true);
            return;
        }

        if (!globalLoadingPromise) {
            preloadFaceModels();
        }

        globalLoadingPromise
            .then(() => setIsLoaded(true))
            .catch(err => setError(err.message));

    }, []);

    return { isLoaded, error };
};
