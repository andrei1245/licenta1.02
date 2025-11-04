import { Component, OnInit, PLATFORM_ID, Inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
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
  fileName: string = 'tts-audio';
  isRecording: boolean = false;
  private isBrowser: boolean;

  constructor(
    private router: Router, 
    private http: HttpClient,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit(): void {
    if (!this.isBrowser) {
      return;
    }

    this.loadVoices();
    
    // Load voices when they become available
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = () => {
        this.loadVoices();
      };
    }
  }

  loadVoices(): void {
    if (!this.isBrowser) {
      return;
    }

    this.voices = speechSynthesis.getVoices();
    
    console.log('All available voices:', this.voices.map(v => `${v.name} (${v.lang})`));
    
    // Try to select Romanian voice by default
    const romanianVoice = this.voices.find(voice => voice.lang.startsWith('ro'));
    if (romanianVoice) {
      this.selectedVoice = romanianVoice;
      console.log('Romanian voice selected:', romanianVoice.name, romanianVoice.lang);
    } else if (this.voices.length > 0) {
      this.selectedVoice = this.voices[0];
      console.log('Default voice selected:', this.selectedVoice.name, this.selectedVoice.lang);
    } else {
      console.log('No voices available yet');
    }
  }

  speak(): void {
    if (!this.isBrowser) {
      return;
    }

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
    if (!this.isBrowser) {
      return;
    }
    speechSynthesis.cancel();
    this.isSpeaking = false;
    this.isPaused = false;
  }

  pauseSpeaking(): void {
    if (!this.isBrowser) {
      return;
    }
    speechSynthesis.pause();
    this.isPaused = true;
  }

  resumeSpeaking(): void {
    if (!this.isBrowser) {
      return;
    }
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

  async downloadAudio(): Promise<void> {
    if (!this.isBrowser) {
      return;
    }

    if (!this.textToSpeak.trim()) {
      Swal.fire({
        icon: 'warning',
        title: 'Text Gol',
        text: 'Introduceți text pentru a genera audio.',
        timer: 2000,
        showConfirmButton: false
      });
      return;
    }

    // Ask for filename
    const result = await Swal.fire({
      title: 'Nume Fișier',
      input: 'text',
      inputLabel: 'Introduceți numele fișierului:',
      inputValue: this.fileName,
      showCancelButton: true,
      confirmButtonText: 'Download',
      cancelButtonText: 'Anulează',
      inputValidator: (value) => {
        if (!value) {
          return 'Trebuie să introduceți un nume!';
        }
        return null;
      }
    });

    if (!result.isConfirmed || !result.value) {
      return;
    }

    this.fileName = result.value;

    try {
      // Show loading
      Swal.fire({
        title: 'Se generează MP3...',
        text: 'Vă rugăm așteptați',
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });

      // Send text to backend for TTS generation
      const voiceLang = this.selectedVoice ? this.selectedVoice.lang : 'ro-RO';
      
      console.log('Selected voice:', this.selectedVoice);
      console.log('Sending language to backend:', voiceLang);
      console.log('Sending rate:', this.rate);
      
      const response = await this.http.post(
        'http://localhost:5000/api/convert-tts-to-mp3',
        {
          text: this.textToSpeak,
          fileName: this.fileName,
          rate: this.rate,
          language: voiceLang
        },
        { 
          responseType: 'blob',
          withCredentials: true 
        }
      ).toPromise();

      // Download the MP3
      const mp3Blob = new Blob([response as Blob], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(mp3Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${this.fileName}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      Swal.fire({
        icon: 'success',
        title: 'Descărcat!',
        text: 'Fișierul MP3 a fost descărcat.',
        timer: 2000,
        showConfirmButton: false
      });

    } catch (error) {
      console.error('Error generating MP3:', error);
      
      Swal.fire({
        icon: 'error',
        title: 'Eroare',
        text: 'Nu s-a putut genera fișierul MP3.',
        timer: 2000,
        showConfirmButton: false
      });
    }
  }

  async saveToDatabase(): Promise<void> {
    if (!this.isBrowser) {
      return;
    }

    if (!this.textToSpeak.trim()) {
      Swal.fire({
        icon: 'warning',
        title: 'Text Gol',
        text: 'Introduceți text pentru a genera audio.',
        timer: 2000,
        showConfirmButton: false
      });
      return;
    }

    // Ask for filename
    const result = await Swal.fire({
      title: 'Nume Fișier',
      input: 'text',
      inputLabel: 'Introduceți numele fișierului:',
      inputValue: this.fileName,
      showCancelButton: true,
      confirmButtonText: 'Salvează',
      cancelButtonText: 'Anulează',
      inputValidator: (value) => {
        if (!value) {
          return 'Trebuie să introduceți un nume!';
        }
        return null;
      }
    });

    if (!result.isConfirmed || !result.value) {
      return;
    }

    this.fileName = result.value;

    try {
      // Show loading
      Swal.fire({
        title: 'Se salvează în baza de date...',
        text: 'Vă rugăm așteptați',
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });

      const voiceLang = this.selectedVoice ? this.selectedVoice.lang : 'ro-RO';

      // Send to backend to save in database
      await this.http.post(
        'http://localhost:5000/api/save-tts-to-db',
        {
          text: this.textToSpeak,
          fileName: this.fileName,
          language: voiceLang
        },
        { withCredentials: true }
      ).toPromise();

      Swal.fire({
        icon: 'success',
        title: 'Salvat!',
        text: 'Fișierul MP3 a fost salvat în tabel.',
        timer: 2000,
        showConfirmButton: false
      });

    } catch (error: any) {
      console.error('Error saving to database:', error);
      
      let errorMessage = 'Nu s-a putut salva fișierul în baza de date.';
      if (error?.status === 401) {
        errorMessage = 'Trebuie să fiți autentificat pentru a salva fișiere.';
      }
      
      Swal.fire({
        icon: 'error',
        title: 'Eroare',
        text: errorMessage,
        timer: 3000,
        showConfirmButton: false
      });
    }
  }
}
