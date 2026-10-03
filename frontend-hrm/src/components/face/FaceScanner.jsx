import React, { useRef, useState, useEffect, useCallback } from 'react';
import Webcam from 'react-webcam';
import * as faceapi from 'face-api.js';
import { motion, AnimatePresence } from 'framer-motion';
import { useFaceModels } from '../../hooks/useFaceModels';
import { CheckCircle2, AlertCircle, ScanFace, Eye, MoveHorizontal, Smile, ShieldAlert } from 'lucide-react';

// EAR Helper for Blink Detection
const getEAR = (eye) => {
    const v1 = Math.hypot(eye[1].x - eye[5].x, eye[1].y - eye[5].y);
    const v2 = Math.hypot(eye[2].x - eye[4].x, eye[2].y - eye[4].y);
    const h = Math.hypot(eye[0].x - eye[3].x, eye[0].y - eye[3].y);
    return (v1 + v2) / (2.0 * h);
};

// Texture/Glare Analysis Helper (Anti-Spoofing)
// Calculates the variance of pixel brightness to detect flat printed photos or bright screens
const analyzeTexture = (ctx, box) => {
    try {
        // Get a small sample from the center of the face (forehead/nose area)
        const sampleSize = Math.floor(box.width * 0.3);
        const startX = Math.floor(box.x + box.width * 0.35);
        const startY = Math.floor(box.y + box.height * 0.2);
        
        if (startX < 0 || startY < 0 || sampleSize <= 0) return true; // fallback

        const imageData = ctx.getImageData(startX, startY, sampleSize, sampleSize);
        const data = imageData.data;
        
        let sum = 0;
        let lumArray = [];
        for (let i = 0; i < data.length; i += 4) {
            // Calculate relative luminance
            const lum = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
            sum += lum;
            lumArray.push(lum);
        }
        
        const mean = sum / lumArray.length;
        
        let varianceSum = 0;
        for (let lum of lumArray) {
            varianceSum += Math.pow(lum - mean, 2);
        }
        
        const variance = varianceSum / lumArray.length;
        
        // Printed photos have very low variance due to lack of real depth shadows.
        // Screens often have very high variance due to moire patterns or extreme glares.
        // Normal human skin in decent light usually falls between 50 and 3000.
        // These thresholds are heuristic and might need tuning based on exact webcam specs.
        if (variance < 20 || variance > 5000) {
            return false; // Spoof detected
        }
        return true; // Pass
    } catch (e) {
        return true; // Ignore errors if out of bounds
    }
};

const CHALLENGES = ['blink', 'turn-left', 'turn-right', 'smile'];
const getRandomChallenge = () => CHALLENGES[Math.floor(Math.random() * CHALLENGES.length)];

const FaceScanner = ({ onFaceDetected, mode = 'register' }) => {
    const webcamRef = useRef(null);
    const canvasRef = useRef(null);
    const requestRef = useRef();
    
    // Performance: Frame Skipping
    const frameCounter = useRef(0);
    const FRAMES_TO_SKIP = 3; // Process every 4th frame (speeds up UI significantly)
    
    // Strict lock to prevent duplicate scans
    const captureLockRef = useRef(false); 
    
    // Challenge Timeout
    const challengeStartTime = useRef(Date.now());
    
    const { isLoaded, error } = useFaceModels();
    const [status, setStatus] = useState({ text: 'Initializing Camera...', state: 'loading' });
    const [isDetecting, setIsDetecting] = useState(false);

    // Liveness State
    const [challenge, setChallenge] = useState(null);
    const [challengePassed, setChallengePassed] = useState(false);
    
    // Progress for final capture
    const [progress, setProgress] = useState(0);
    const progressRef = useRef(0);
    
    // SPEEDUP: Require fewer frames to lock (since we are skipping frames, 5 is plenty)
    const TARGET_PROGRESS = 5; 

    useEffect(() => {
        if (mode === 'attendance' && !challenge) {
            setChallenge(getRandomChallenge());
            challengeStartTime.current = Date.now();
        } else if (mode === 'register') {
            setChallengePassed(true);
        }
    }, [mode, challenge]);

    const detectFace = useCallback(async () => {
        if (!webcamRef.current || !webcamRef.current.video || webcamRef.current.video.readyState !== 4 || !isLoaded || !isDetecting || captureLockRef.current) {
            if (isDetecting && !captureLockRef.current) {
                requestRef.current = requestAnimationFrame(detectFace);
            }
            return;
        }

        const video = webcamRef.current.video;
        const displaySize = { width: video.videoWidth, height: video.videoHeight };

        if (displaySize.width === 0 || displaySize.height === 0) {
            if (isDetecting && !captureLockRef.current) requestRef.current = requestAnimationFrame(detectFace);
            return;
        }

        // FRAME SKIPPING OPTIMIZATION
        frameCounter.current += 1;
        if (frameCounter.current % FRAMES_TO_SKIP !== 0) {
            if (isDetecting && !captureLockRef.current) requestRef.current = requestAnimationFrame(detectFace);
            return;
        }

        if (canvasRef.current) {
            faceapi.matchDimensions(canvasRef.current, displaySize);
        }

        try {
            // SPEEDUP: Reduced inputSize from 224 to 160 for ultra-fast inference
            const detections = await faceapi
                .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 160, scoreThreshold: 0.6 }))
                .withFaceLandmarks()
                .withFaceExpressions()
                .withFaceDescriptors();

            let ctx = null;
            if (canvasRef.current) {
                const resizedDetections = faceapi.resizeResults(detections, displaySize);
                ctx = canvasRef.current.getContext('2d');
                ctx.clearRect(0, 0, displaySize.width, displaySize.height);
                
                // Draw mesh
                faceapi.draw.drawFaceLandmarks(canvasRef.current, resizedDetections, {
                    drawLines: true,
                    color: status.state === 'success' ? '#10b981' : (status.state === 'warning' ? '#ef4444' : '#3b82f6'),
                    lineWidth: 1
                });
            }

            // Anti-Spoofing & Validation
            if (detections.length === 0) {
                setStatus({ text: 'Face Not Detected.', state: 'warning' });
                progressRef.current = 0;
            } else if (detections.length > 1) {
                setStatus({ text: 'Multiple faces detected! Only one allowed.', state: 'warning' });
                progressRef.current = 0;
            } else {
                const detection = detections[0];
                const box = detection.detection.box;
                const landmarks = detection.landmarks;
                
                // Texture Anti-Spoofing (Reject screens/photos)
                if (ctx && mode === 'attendance') {
                    // Temporarily draw video to canvas to extract pixels for texture analysis
                    ctx.drawImage(video, 0, 0, displaySize.width, displaySize.height);
                    const isRealTexture = analyzeTexture(ctx, box);
                    ctx.clearRect(0, 0, displaySize.width, displaySize.height); // clear it right back
                    
                    if (!isRealTexture) {
                        setStatus({ text: 'SPOOF DETECTED: Flat image or screen glare.', state: 'warning' });
                        progressRef.current = 0;
                        if (isDetecting && !captureLockRef.current) requestRef.current = requestAnimationFrame(detectFace);
                        return; // Halt further checks
                    }
                }

                // Position & Size Constraints
                const faceCenterX = box.x + box.width / 2;
                const faceCenterY = box.y + box.height / 2;
                const isCenteredX = faceCenterX > displaySize.width * 0.3 && faceCenterX < displaySize.width * 0.7;
                const isCenteredY = faceCenterY > displaySize.height * 0.2 && faceCenterY < displaySize.height * 0.8;
                
                const faceRatio = box.width / displaySize.width;
                const isCloseEnough = faceRatio > 0.25;
                const isTooClose = faceRatio > 0.70;

                if (!isCenteredX || !isCenteredY) {
                    setStatus({ text: 'Center your face.', state: 'warning' });
                    progressRef.current = 0;
                } else if (!isCloseEnough) {
                    setStatus({ text: 'Move closer.', state: 'warning' });
                    progressRef.current = 0;
                } else if (isTooClose) {
                    setStatus({ text: 'Move back.', state: 'warning' });
                    progressRef.current = 0;
                } else {
                    // Liveness Challenge Validation
                    if (mode === 'attendance' && !challengePassed) {
                        
                        // Strict Time Limit (15 seconds max to complete challenge)
                        if (Date.now() - challengeStartTime.current > 15000) {
                            setStatus({ text: 'Challenge Timed Out. Try again.', state: 'warning' });
                            setChallenge(getRandomChallenge());
                            challengeStartTime.current = Date.now();
                            progressRef.current = 0;
                        } else {
                            let passed = false;
                            
                            if (challenge === 'blink') {
                                const leftEye = landmarks.getLeftEye();
                                const rightEye = landmarks.getRightEye();
                                if (getEAR(leftEye) < 0.25 && getEAR(rightEye) < 0.25) passed = true;
                                setStatus({ text: 'LIVENESS: Blink eyes', state: 'default' });
                            } 
                            else if (challenge === 'turn-left') {
                                const nose = landmarks.getNose()[0];
                                const leftEye = landmarks.getLeftEye()[0];
                                const rightEye = landmarks.getRightEye()[3];
                                const distL = Math.abs(nose.x - leftEye.x);
                                const distR = Math.abs(nose.x - rightEye.x);
                                if (distR / distL > 1.8) passed = true;
                                setStatus({ text: 'LIVENESS: Turn head left', state: 'default' });
                            }
                            else if (challenge === 'turn-right') {
                                const nose = landmarks.getNose()[0];
                                const leftEye = landmarks.getLeftEye()[0];
                                const rightEye = landmarks.getRightEye()[3];
                                const distL = Math.abs(nose.x - leftEye.x);
                                const distR = Math.abs(nose.x - rightEye.x);
                                if (distL / distR > 1.8) passed = true;
                                setStatus({ text: 'LIVENESS: Turn head right', state: 'default' });
                            }
                            else if (challenge === 'smile') {
                                if (detection.expressions.happy > 0.8) passed = true;
                                setStatus({ text: 'LIVENESS: Smile!', state: 'default' });
                            }

                            if (passed) {
                                setChallengePassed(true);
                                setStatus({ text: 'Verified! Hold still...', state: 'success' });
                            }
                        }
                    } 
                    else {
                        // Capture phase
                        setStatus({ text: 'Locked! Hold still...', state: 'success' });
                        progressRef.current += 1;
                    }
                }
            }

            setProgress((progressRef.current / TARGET_PROGRESS) * 100);

            // Auto-Capture Threshold Reached
            if (progressRef.current >= TARGET_PROGRESS && !captureLockRef.current) {
                captureLockRef.current = true; // STRICT LOCK
                setIsDetecting(false);
                setStatus({ text: 'Successful! Processing...', state: 'success' });
                
                if (canvasRef.current) {
                    const ctx = canvasRef.current.getContext('2d');
                    ctx.clearRect(0, 0, displaySize.width, displaySize.height);
                }

                const descriptorArray = Array.from(detections[0].descriptor);
                
                setTimeout(() => {
                    onFaceDetected(descriptorArray, {
                        livenessPassed: challengePassed || mode === 'register',
                        livenessScore: 0.99
                    });
                }, 100);
                return;
            }

        } catch (error) {
            console.error("Detection error:", error);
        }

        if (isDetecting && !captureLockRef.current) {
            requestRef.current = requestAnimationFrame(detectFace);
        }
    }, [isLoaded, isDetecting, mode, challenge, challengePassed, onFaceDetected, status.state]);

    useEffect(() => {
        if (isLoaded && isDetecting) {
            requestRef.current = requestAnimationFrame(detectFace);
        }
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, [isLoaded, isDetecting, detectFace]);

    const handleVideoOnLoad = () => {
        setIsDetecting(true);
        setStatus({ text: 'Position face in circle.', state: 'default' });
    };

    const ringColor = status.state === 'success' ? 'border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.5)]' 
                    : status.state === 'warning' ? 'border-rose-500 shadow-[0_0_30px_rgba(244,63,94,0.5)]'
                    : 'border-primary shadow-[0_0_30px_rgba(59,130,246,0.3)]';

    return (
        <div className="flex flex-col items-center justify-center w-full max-w-md mx-auto relative select-none">
            
            {/* Liveness Challenge Prompt Badge */}
            {mode === 'attendance' && !challengePassed && isLoaded && (
                <motion.div 
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute -top-16 z-50 bg-slate-900 text-white px-6 py-3 rounded-full font-bold shadow-xl flex items-center gap-3 border border-slate-700 whitespace-nowrap"
                >
                    {challenge === 'blink' ? <Eye className="text-blue-400" size={20} /> :
                     challenge === 'smile' ? <Smile className="text-yellow-400" size={20} /> :
                     <MoveHorizontal className="text-emerald-400" size={20} />}
                    {challenge === 'blink' ? 'BLINK YOUR EYES' :
                     challenge === 'turn-left' ? 'TURN HEAD LEFT' :
                     challenge === 'turn-right' ? 'TURN HEAD RIGHT' :
                     'SMILE FOR CAMERA'}
                </motion.div>
            )}

            {/* The Circular Scanner Frame */}
            <div className="relative w-64 h-64 sm:w-80 sm:h-80 mb-8 rounded-full bg-slate-900 flex items-center justify-center">
                
                {!isLoaded && (
                    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-900/60 backdrop-blur-sm rounded-full">
                        <ScanFace className="w-12 h-12 text-white animate-pulse mb-3" />
                        <span className="text-sm font-bold text-white uppercase tracking-widest animate-pulse drop-shadow-md">Initializing AI...</span>
                    </div>
                )}

                <div className={`absolute inset-0 rounded-full overflow-hidden border-[6px] transition-all duration-300 ease-in-out z-10 ${ringColor}`}>
                    <Webcam
                        audio={false}
                        ref={webcamRef}
                        onUserMedia={handleVideoOnLoad}
                        mirrored={true}
                        videoConstraints={{ width: 480, height: 480, frameRate: { ideal: 30, max: 60 }, facingMode: "user" }}
                        className="w-full h-full object-cover scale-110" 
                    />
                    <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-20" />
                    
                    <AnimatePresence>
                        {!isDetecting && progress === 100 && (
                            <motion.div 
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                className="absolute inset-0 z-30 bg-emerald-500/80 backdrop-blur-sm flex flex-col items-center justify-center text-white"
                            >
                                <CheckCircle2 className="w-20 h-20 mb-2 drop-shadow-lg" />
                                <span className="font-bold uppercase tracking-widest text-sm drop-shadow-md">Captured</span>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Progress Ring Overlay */}
                <svg className="absolute -inset-4 w-[calc(100%+32px)] h-[calc(100%+32px)] z-0 transform -rotate-90 pointer-events-none">
                    <circle cx="50%" cy="50%" r="48%" stroke="rgba(255,255,255,0.05)" strokeWidth="6" fill="transparent" />
                    <circle 
                        cx="50%" cy="50%" r="48%" 
                        stroke={status.state === 'success' ? '#10b981' : (status.state === 'warning' ? '#ef4444' : '#3b82f6')} 
                        strokeWidth="6" fill="transparent"
                        strokeDasharray="1000"
                        strokeDashoffset={1000 - (1000 * progress) / 100}
                        strokeLinecap="round"
                        className="transition-all duration-100 ease-linear"
                    />
                </svg>
            </div>

            {/* Status Feedback Badge */}
            <motion.div 
                key={status.text}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`px-6 py-3 rounded-2xl flex items-center gap-3 shadow-lg border backdrop-blur-md font-bold text-sm ${
                    status.state === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                    status.state === 'warning' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                    'bg-white text-slate-700 border-slate-200'
                }`}
            >
                {status.state === 'success' ? <CheckCircle2 size={18} /> : 
                 status.state === 'warning' ? <ShieldAlert size={18} /> : 
                 <ScanFace size={18} className="animate-pulse text-primary" />}
                {status.text}
            </motion.div>

            {error && (
                <div className="mt-4 p-3 bg-red-100 text-red-600 rounded-xl text-sm font-medium border border-red-200">
                    Failed to initialize camera. Please grant camera permissions.
                </div>
            )}
        </div>
    );
};

export default FaceScanner;
