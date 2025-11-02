import { Component, OnInit, PLATFORM_ID, Inject, ChangeDetectorRef } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';

// Extend Window interface for webkitSpeechRecognition
declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

@Component({
  selector: 'app-stt',
  standalone: false,
  templateUrl: './stt.component.html',
  styleUrl: './stt.component.css'
})
export class SttComponent implements OnInit {
  recognition: any = null;
  isListening: boolean = false;
  transcriptText: string = '';
  interimText: string = '';
  selectedLanguage: string = 'ro-RO';
  
  languages = [
    { code: 'ro-RO', name: 'Română' },
    { code: 'en-US', name: 'English (US)' },
    { code: 'en-GB', name: 'English (UK)' }
  ];

  constructor(
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Only initialize in browser
    if (isPlatformBrowser(this.platformId)) {
      this.initializeSpeechRecognition();
    }
  }

  initializeSpeechRecognition(): void {
    // Check if running in browser
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      Swal.fire({
        icon: 'error',
        title: 'STT Indisponibil',
        text: 'Browser-ul nu suportă Speech-to-Text. Folosiți Chrome sau Edge.',
        timer: 3000,
        showConfirmButton: false
      });
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = this.selectedLanguage;

    this.recognition.onstart = () => {
      this.isListening = true;
    };

    this.recognition.onresult = (event: any) => {
      let interimTranscript = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        
        if (event.results[i].isFinal) {
          this.transcriptText += transcript + ' ';
        } else {
          interimTranscript += transcript;
        }
      }
      
      this.interimText = interimTranscript;
      
      // Force Angular to detect changes
      this.cdr.detectChanges();
    };

    this.recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      this.isListening = false;
      
      let errorMessage = 'A apărut o eroare la recunoașterea vocii.';
      if (event.error === 'no-speech') {
        errorMessage = 'Nu s-a detectat vorbire. Încercați din nou.';
      } else if (event.error === 'not-allowed') {
        errorMessage = 'Permisiunea pentru microfon a fost refuzată.';
      } else if (event.error === 'audio-capture') {
        errorMessage = 'Nu s-a putut captura audio de la microfon.';
      } else if (event.error === 'network') {
        errorMessage = 'Eroare de rețea. Verificați conexiunea.';
      }

      Swal.fire({
        icon: 'error',
        title: 'Eroare STT',
        text: errorMessage,
        timer: 3000,
        showConfirmButton: false
      });
    };

    this.recognition.onspeechstart = () => {
      // Speech detected
    };

    this.recognition.onspeechend = () => {
      // Speech ended
    };

    this.recognition.onend = () => {
      this.isListening = false;
      this.interimText = '';
    };
  }

  startListening(): void {
    if (!this.recognition) {
      this.initializeSpeechRecognition();
      if (!this.recognition) return;
    }

    // Don't start if already listening
    if (this.isListening) {
      return;
    }

    try {
      this.recognition.lang = this.selectedLanguage;
      this.recognition.start();
      this.isListening = true;
    } catch (error) {
      console.error('Error starting recognition:', error);
      this.isListening = false;
    }
  }

  stopListening(): void {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (error) {
        console.error('Error stopping recognition:', error);
      }
      this.isListening = false;
    }
  }

  clearTranscript(): void {
    this.transcriptText = '';
    this.interimText = '';
  }

  copyToClipboard(): void {
    if (!this.transcriptText) {
      Swal.fire({
        icon: 'warning',
        title: 'Text Gol',
        text: 'Nu există text de copiat.',
        timer: 2000,
        showConfirmButton: false
      });
      return;
    }

    navigator.clipboard.writeText(this.transcriptText).then(() => {
      Swal.fire({
        icon: 'success',
        title: 'Copiat!',
        text: 'Textul a fost copiat în clipboard.',
        timer: 2000,
        showConfirmButton: false
      });
    }).catch(err => {
      console.error('Failed to copy:', err);
      Swal.fire({
        icon: 'error',
        title: 'Eroare',
        text: 'Nu s-a putut copia textul.',
        timer: 2000,
        showConfirmButton: false
      });
    });
  }

  onLanguageChange(event: any): void {
    this.selectedLanguage = event.target.value;
    if (this.isListening) {
      this.stopListening();
      setTimeout(() => {
        this.startListening();
      }, 500);
    }
  }

  goBack(): void {
    this.router.navigate(['/home']);
  }
}
