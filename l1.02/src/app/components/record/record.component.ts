import { Component, OnDestroy, ViewChild, ElementRef, AfterViewInit, PLATFORM_ID, Inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-record',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './record.component.html',
  styleUrls: ['./record.component.css']
})
export class RecordComponent implements OnDestroy, AfterViewInit {
  @ViewChild('visualizer', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;
  
  // Make these properties public
  public isRecording = false;
  public recordedTime = '';
  public filename = '';
  public chunks: Blob[] = [];
  public audioUrl: string | null = null;

  // Keep these properties private
  private isBrowser: boolean;
  private canvasInitialized = false;
  private mediaRecorder: MediaRecorder | null = null;
  private timer: any;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private canvasCtx: CanvasRenderingContext2D | null = null;
  private animationId: number | null = null;

  constructor(
    private http: HttpClient, 
    private router: Router,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngAfterViewInit() {
    if (!this.isBrowser) return;

    try {
      const canvas = this.canvasRef.nativeElement;
      this.canvasCtx = canvas.getContext('2d');
      
      if (!this.canvasCtx) {
        throw new Error('Failed to get canvas context');
      }

      // Initial canvas setup
      this.canvasCtx.fillStyle = 'rgb(20, 20, 20)';
      this.canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
      
      this.canvasInitialized = true;
    } catch (err) {
      console.error('Canvas initialization error:', err);
    }
  }

  async startRecording() {
    if (!this.isBrowser) return;
    
    // Wait for canvas initialization if needed
    if (!this.canvasInitialized) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (!this.canvasRef?.nativeElement || !this.canvasCtx) {
      console.error('Canvas not properly initialized');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        } 
      });
      
      this.audioContext = new AudioContext();
      const source = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;
      source.connect(this.analyser);

      this.drawVisualization();

      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 128000
      });
      
      this.chunks = [];
      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          this.chunks.push(e.data);
        }
      };

      this.mediaRecorder.start(1000); // Record in 1-second chunks
      this.isRecording = true;
      this.startTimer();
    } catch (err) {
      console.error('Error accessing microphone:', err);
      alert('Could not access microphone. Please check permissions.');
    }
  }

  private drawVisualization() {
    if (!this.isBrowser || !this.analyser || !this.canvasCtx) return;

    const canvas = this.canvasCtx.canvas;
    const WIDTH = canvas.width;
    const HEIGHT = canvas.height;
    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      if (!this.isBrowser) return;

      this.animationId = requestAnimationFrame(draw);
      this.analyser!.getByteFrequencyData(dataArray);

      this.canvasCtx!.fillStyle = 'rgb(20, 20, 20)';
      this.canvasCtx!.fillRect(0, 0, WIDTH, HEIGHT);

      const barWidth = (WIDTH / bufferLength) * 2.5;
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = dataArray[i] / 255 * HEIGHT;

        const hue = (i / bufferLength) * 300;
        this.canvasCtx!.fillStyle = `hsl(${hue}, 100%, 50%)`;
        
        this.canvasCtx!.fillRect(x, HEIGHT - barHeight, barWidth, barHeight);
        x += barWidth + 1;
      }
    };

    draw();
  }

  stopRecording() {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
      this.isRecording = false;
      this.stopTimer();

      if (this.animationId) {
        cancelAnimationFrame(this.animationId);
        this.animationId = null;
      }

      // Wait for the last chunk to be processed
      this.mediaRecorder.addEventListener('stop', () => {
        const blob = new Blob(this.chunks, { type: 'audio/webm;codecs=opus' });
        if (this.audioUrl) {
          URL.revokeObjectURL(this.audioUrl);
        }
        this.audioUrl = URL.createObjectURL(blob);
        
        if (this.mediaRecorder?.stream) {
          this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
        }
      });
    }
  }

  saveRecording() {
    if (!this.chunks.length || !this.filename) return;

    const blob = new Blob(this.chunks, { type: 'audio/webm;codecs=opus' });
    const formData = new FormData();
    
    formData.append('mp3', blob, this.filename + '.mp3');
    formData.append('trimSilence', 'true'); // Add flag to indicate silence trimming

    this.http.post('http://localhost:5000/api/upload', formData, { 
      withCredentials: true 
    }).subscribe({
      next: (response: any) => {
        Swal.fire({
          icon: 'success',
          title: 'Success!',
          text: 'Recording saved successfully',
          timer: 1500,
          showConfirmButton: false
        }).then(() => {
          this.router.navigate(['/home']);
        });
      },
      error: (err) => {
        console.error('Error saving recording:', err);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: err.error?.message || 'Failed to save recording'
        });
      }
    });
  }

  private startTimer() {
    let seconds = 0;
    this.timer = setInterval(() => {
      seconds++;
      this.recordedTime = new Date(seconds * 1000).toISOString().substr(11, 8);
    }, 1000);
  }

  private stopTimer() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  ngOnDestroy() {
    this.stopTimer();
    if (this.audioUrl) {
      URL.revokeObjectURL(this.audioUrl);
    }
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    if (this.audioContext) {
      this.audioContext.close();
    }
  }
}