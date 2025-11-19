import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import Swal from 'sweetalert2';

interface CelebrityVoice {
  id: string;
  name: string;
  description: string;
}

@Component({
  selector: 'app-voice-cloning',
  standalone: false,
  templateUrl: './voice-cloning.component.html',
  styleUrl: './voice-cloning.component.css'
})
export class VoiceCloningComponent {
  isRecording: boolean = false;
  isProcessing: boolean = false;
  mediaRecorder: MediaRecorder | null = null;
  audioChunks: Blob[] = [];
  recordedAudioUrl: string | null = null;
  clonedAudioUrl: string | null = null;
  selectedVoice: string = 'trump';

  celebrityVoices: CelebrityVoice[] = [
    { id: 'trump', name: 'Donald Trump', description: 'RVC Model - High Quality' }
  ];

  constructor(private http: HttpClient) {}

  async startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(stream);
      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        this.audioChunks.push(event.data);
      };

      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        this.recordedAudioUrl = URL.createObjectURL(audioBlob);
      };

      this.mediaRecorder.start();
      this.isRecording = true;

      Swal.fire({
        icon: 'info',
        title: 'Recording...',
        text: 'Speak clearly into your microphone',
        showConfirmButton: false,
        timer: 1500
      });
    } catch (error) {
      console.error('Error accessing microphone:', error);
      Swal.fire({
        icon: 'error',
        title: 'Microphone Error',
        text: 'Could not access your microphone'
      });
    }
  }

  stopRecording() {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
      this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
      this.isRecording = false;

      Swal.fire({
        icon: 'success',
        title: 'Recording Complete',
        text: 'Now select a celebrity voice and click Clone Voice',
        showConfirmButton: false,
        timer: 2000
      });
    }
  }

  async cloneVoice() {
    if (!this.recordedAudioUrl) {
      Swal.fire({
        icon: 'warning',
        title: 'No Recording',
        text: 'Please record your voice first'
      });
      return;
    }

    this.isProcessing = true;

    Swal.fire({
      icon: 'info',
      title: 'Cloning Voice...',
      text: 'This may take 30-60 seconds',
      allowOutsideClick: false,
      showConfirmButton: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    try {
      const audioBlob = await fetch(this.recordedAudioUrl).then(r => r.blob());
      const formData = new FormData();
      formData.append('audioFile', audioBlob, 'recording.webm');
      formData.append('targetVoice', this.selectedVoice);

      const response = await this.http.post('http://localhost:5000/api/clone-voice', 
        formData, 
        { 
          responseType: 'blob',
          withCredentials: true 
        }
      ).toPromise();

      if (response) {
        this.clonedAudioUrl = URL.createObjectURL(response);
        
        Swal.fire({
          icon: 'success',
          title: 'Voice Cloned!',
          text: 'Your voice has been transformed',
          showConfirmButton: false,
          timer: 2000
        });
      }
    } catch (error) {
      console.error('Voice cloning error:', error);
      Swal.fire({
        icon: 'error',
        title: 'Cloning Failed',
        text: 'Error processing voice. Please try again.'
      });
    } finally {
      this.isProcessing = false;
    }
  }

  downloadCloned() {
    if (this.clonedAudioUrl) {
      const a = document.createElement('a');
      a.href = this.clonedAudioUrl;
      a.download = `cloned-${this.selectedVoice}-${Date.now()}.mp3`;
      a.click();
    }
  }

  async saveToDatabase() {
    if (!this.clonedAudioUrl) {
      Swal.fire({
        icon: 'warning',
        title: 'No Cloned Audio',
        text: 'Please clone your voice first'
      });
      return;
    }

    try {
      const audioBlob = await fetch(this.clonedAudioUrl).then(r => r.blob());
      const formData = new FormData();
      formData.append('mp3', audioBlob, `cloned-${this.selectedVoice}-${Date.now()}.mp3`);

      await this.http.post('http://localhost:5000/api/upload', 
        formData, 
        { withCredentials: true }
      ).toPromise();

      Swal.fire({
        icon: 'success',
        title: 'Saved!',
        text: 'Cloned voice saved to your library',
        showConfirmButton: false,
        timer: 2000
      });
    } catch (error) {
      console.error('Save error:', error);
      Swal.fire({
        icon: 'error',
        title: 'Save Failed',
        text: 'Could not save to database'
      });
    }
  }

  clearRecording() {
    if (this.recordedAudioUrl) {
      URL.revokeObjectURL(this.recordedAudioUrl);
      this.recordedAudioUrl = null;
    }
    if (this.clonedAudioUrl) {
      URL.revokeObjectURL(this.clonedAudioUrl);
      this.clonedAudioUrl = null;
    }
    this.audioChunks = [];
  }
}
