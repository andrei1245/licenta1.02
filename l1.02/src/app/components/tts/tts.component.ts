import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-tts',
  standalone: false,
  templateUrl: './tts.component.html',
  styleUrl: './tts.component.css'
})
export class TtsComponent implements OnInit {
  textToSpeak: string = '';
  voices: SpeechSynthesisVoice[] = [];
  selectedVoice: SpeechSynthesisVoice | null = null;
  rate: number = 0.9;
  pitch: number = 1;
  volume: number = 1;
  isSpeaking: boolean = false;
  isPaused: boolean = false;

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.loadVoices();
    
    // Load voices when they become available
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = () => {
        this.loadVoices();
      };
    }
  }

  loadVoices(): void {
    this.voices = speechSynthesis.getVoices();
    
    // Try to select Romanian voice by default
    const romanianVoice = this.voices.find(voice => voice.lang.startsWith('ro'));
    if (romanianVoice) {
      this.selectedVoice = romanianVoice;
    } else if (this.voices.length > 0) {
      this.selectedVoice = this.voices[0];
    }
  }

  speak(): void {
    if (!this.textToSpeak.trim()) {
      Swal.fire({
        icon: 'warning',
        title: 'Text Gol',
        text: 'Introduceți text pentru a-l citi.',
        timer: 2000,
        showConfirmButton: false
      });
      return;
    }

    if (!('speechSynthesis' in window)) {
      Swal.fire({
        icon: 'error',
        title: 'TTS Indisponibil',
        text: 'Browser-ul nu suportă Text-to-Speech.',
        timer: 2000,
        showConfirmButton: false
      });
      return;
    }

    // Cancel any ongoing speech
    speechSynthesis.cancel();

    // Set immediately to enable buttons
    this.isSpeaking = true;
    this.isPaused = false;

    const utterance = new SpeechSynthesisUtterance(this.textToSpeak);
    
    if (this.selectedVoice) {
      utterance.voice = this.selectedVoice;
      utterance.lang = this.selectedVoice.lang;
    } else {
      utterance.lang = 'ro-RO';
    }
    
    utterance.rate = this.rate;
    utterance.pitch = this.pitch;
    utterance.volume = this.volume;

    utterance.onstart = () => {
      console.log('Speech started');
    };

    utterance.onend = () => {
      this.isSpeaking = false;
      this.isPaused = false;
      console.log('Speech ended');
    };

    utterance.onerror = (event) => {
      this.isSpeaking = false;
      this.isPaused = false;
      console.error('Speech error:', event);
      Swal.fire({
        icon: 'error',
        title: 'Eroare TTS',
        text: 'A apărut o eroare la redarea textului.',
        timer: 2000,
        showConfirmButton: false
      });
    };

    speechSynthesis.speak(utterance);
  }

  stopSpeaking(): void {
    speechSynthesis.cancel();
    this.isSpeaking = false;
    this.isPaused = false;
  }

  pauseSpeaking(): void {
    speechSynthesis.pause();
    this.isPaused = true;
  }

  resumeSpeaking(): void {
    speechSynthesis.resume();
    this.isPaused = false;
  }

  goBack(): void {
    this.router.navigate(['/home']);
  }

  onVoiceChange(event: any): void {
    const selectedIndex = event.target.value;
    this.selectedVoice = this.voices[selectedIndex];
  }
}
