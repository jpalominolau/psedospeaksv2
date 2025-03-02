// src/components/AudioRecorder.js
'use client';

import styles from './AudioRecorder.module.css';
import { useState, useRef, useEffect } from 'react';
import { uploadAndProcessAudio, getLatestGeminiResponse } from '../utils/geminiClient';

export default function AudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [response, setResponse] = useState(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);

  useEffect(() => {
    // Cargar la última respuesta guardada al iniciar
    fetchLatestResponse();
  }, []);

  const fetchLatestResponse = async () => {
    try {
      const latestResponse = await getLatestGeminiResponse();
      setResponse(latestResponse);
    } catch (error) {
      console.error('Error fetching latest response:', error);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

        const file = new File([audioBlob], 'audio.webm', { type: 'audio/webm' });

        try {
          await uploadAndProcessAudio(file);
          await fetchLatestResponse(); // Cargar la respuesta actualizada después del procesamiento
        } catch (error) {
          console.error('Error processing audio:', error);
        }

        audioChunksRef.current = [];
      };

      recorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error accessing microphone:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
  };

  const toggleRecord = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <div className={styles['audio-recorder-container']}>
      <h2 className={styles.title}>Record Audio</h2>
      <div className={styles.controls}>
        <button
          className={`${styles['record-button']} ${isRecording ? styles.stop : styles.start}`}
          onClick={toggleRecord}
        >
          {isRecording ? 'Stop Recording' : 'Start Recording'}
        </button>
      </div>
      <div className={styles['response-section']}>
        <h3 className={styles.subtitle}>Gemini&apos;s Response:</h3>
        {response ? (
          <div className={styles['response-content']}>
            <p><strong>Input:</strong> {response.input}</p>
            <p><strong>Output:</strong></p>
            <pre className={styles['code-block']}>
              {response.output.split('\n').map((line, index) => (
                <span key={index}>{line}<br /></span>
              ))}
            </pre>
            <p><strong>Variables:</strong> {response.variables.join(', ')}</p>
            <p><strong>Feedback:</strong> {response.feedback.replace(/'/g, '&#39;')}</p>
          </div>
        ) : (
          <p className={styles['no-response']}>No response yet.</p>
        )}
      </div>
    </div>
  );
}