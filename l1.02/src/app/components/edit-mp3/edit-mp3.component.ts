import { Component, OnInit, AfterViewInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-edit-mp3',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './edit-mp3.component.html',
  styleUrls: ['./edit-mp3.component.css']
})
export class EditMp3Component implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('audioPlayer') audioPlayerRef!: ElementRef<HTMLAudioElement>;
  
  file: any = null;
  errorMessage: string = '';
  originalFilename: string = '';
  loading = true; // Adăugat pentru gestionarea stării de încărcare
  isUpdating = false; // Adăugat pentru a preveni dubla trimitere a formularului

  // Add these properties
  audioElement: HTMLAudioElement | null = null;
  startTime: number = 0;
  endTime: number = 0;
  duration: number = 0;
  baselineSoundLevel: number = 100;
  timestamp: number = Date.now();
  private audioCheck: any = null;
  currentTime: number = 0;

  // Add these properties to the class
  availableFiles: any[] = [];
  selectedFileId: string | null = null;
  showFileSelector: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient,
    private router: Router
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    
    if (id && this.isValidId(id)) {
      this.loadFile(id);
    } else {
      this.handleInvalidId();
    }
  }

  ngAfterViewInit() {
    // Initialize audio element after view is ready
    if (this.audioPlayerRef?.nativeElement) {
      this.initAudioElement();
    }
  }

  ngOnDestroy() {
    // Clean up interval when component is destroyed
    if (this.audioCheck) {
      clearInterval(this.audioCheck);
    }
    // Remove event listeners
    if (this.audioElement) {
      this.audioElement.removeEventListener('loadedmetadata', this.handleMetadata);
      this.audioElement.removeEventListener('durationchange', this.handleDurationChange);
      this.audioElement.removeEventListener('canplaythrough', this.handleCanPlayThrough);
    }
  }

  private handleMetadata = () => {
    if (this.audioElement) {
      console.log('Metadata loaded, duration:', this.audioElement.duration);
      if (this.audioElement.duration && !isNaN(this.audioElement.duration)) {
        this.duration = this.audioElement.duration;
        this.endTime = this.duration;
      }
    }
  };

  private handleDurationChange = () => {
    if (this.audioElement) {
      console.log('Duration changed:', this.audioElement.duration);
      if (this.audioElement.duration && !isNaN(this.audioElement.duration)) {
        this.duration = this.audioElement.duration;
        this.endTime = this.duration;
      }
    }
  };

  private handleCanPlayThrough = () => {
    if (this.audioElement) {
      console.log('Can play through, duration:', this.audioElement.duration);
      if (this.audioElement.duration && !isNaN(this.audioElement.duration)) {
        this.duration = this.audioElement.duration;
        this.endTime = this.duration;
      }
    }
  };

  private initAudioElement() {
    if (this.audioCheck) {
      clearInterval(this.audioCheck);
      this.audioCheck = null;
    }

    // Create a new Audio element to preload the file
    const preloadAudio = new Audio();
    preloadAudio.src = `http://localhost:5000/api/mp3/${this.file._id}?t=${this.timestamp}`;
    
    preloadAudio.addEventListener('loadedmetadata', () => {
      console.log('Preload metadata loaded, duration:', preloadAudio.duration);
      if (preloadAudio.duration && !isNaN(preloadAudio.duration)) {
        this.duration = preloadAudio.duration;
        this.endTime = this.duration;
      }
    });

    // Initialize the visible audio element
    if (this.audioPlayerRef?.nativeElement) {
      this.audioElement = this.audioPlayerRef.nativeElement;

      // Remove existing listeners
      this.audioElement.removeEventListener('loadedmetadata', this.handleMetadata);
      this.audioElement.removeEventListener('durationchange', this.handleDurationChange);
      this.audioElement.removeEventListener('canplaythrough', this.handleCanPlayThrough);

      // Add event listeners
      this.audioElement.addEventListener('loadedmetadata', this.handleMetadata);
      this.audioElement.addEventListener('durationchange', this.handleDurationChange);
      this.audioElement.addEventListener('canplaythrough', this.handleCanPlayThrough);
      this.audioElement.addEventListener('timeupdate', () => {
        if (this.audioElement) {
          requestAnimationFrame(() => {
            this.currentTime = this.audioElement!.currentTime;
          });
        }
      });

      // Force load the audio
      this.audioElement.load();
      console.log('Audio element initialized');
    }
  }

  // Update the loadFile method to reinitialize audio element after loading new file
  private loadFile(id: string): void {
    this.loading = true;
    this.duration = 0; // Reset duration
    this.timestamp = Date.now(); // Update timestamp for cache busting

    this.http.get(`http://localhost:5000/api/mp3/${id}/details`, { 
      withCredentials: true 
    }).subscribe({
      next: (response: any) => {
        this.file = response.data;
        this.originalFilename = response.data.filename;
        this.loading = false;
        
        // Wait for view to update before initializing audio
        setTimeout(() => {
          this.initAudioElement();
          
          // Add additional check after a delay
          setTimeout(() => {
            if (this.duration === 0 && this.audioElement) {
              console.log('Retrying audio duration fetch...');
              this.audioElement.load();
              this.initAudioElement();
            }
          }, 1000);
        }, 100);
      },
      error: (error) => {
        this.errorMessage = error.error.message || 'Error loading file';
        this.loading = false;
      }
    });
  }

  cutMP3() {
    console.log('Attempting to cut MP3:', {
      startTime: this.startTime,
      endTime: this.endTime,
      duration: this.duration,
      baselineSoundLevel: this.baselineSoundLevel
    });
  
    if (!this.validateCutTimes()) return;
  
    this.isUpdating = true;
    this.http.post(
      `http://localhost:5000/api/mp3/${this.file._id}/cut`,
      { 
        startTime: parseFloat(this.startTime.toString()),
        endTime: parseFloat(this.endTime.toString()),
        baselineSoundLevel: parseInt(this.baselineSoundLevel.toString())
      },
      { withCredentials: true }
    ).subscribe({
      next: (response: any) => {
        console.log('Cut response:', response);
        Swal.fire({
          icon: 'success',
          title: 'Success!',
          text: `MP3 cut successfully. Original size: ${response.originalSize} bytes, New size: ${response.newSize} bytes`,
          timer: 1000,
          showConfirmButton: false
        }).then(() => {
          this.startTime = 0;
          this.endTime = 0;
          this.baselineSoundLevel = 100;
          // Force reload audio with new timestamp
          this.timestamp = Date.now();
          
          // Reload file details and reinitialize audio
          this.loadFile(this.file._id);
          
          // Reset updating state to enable the button again
          this.isUpdating = false;
        });
      },
      error: (error) => {
        console.error('Cut error:', error);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: error.error.message || 'Failed to cut MP3'
        });
        this.isUpdating = false;
      }
    });
  }
  
  updateFile(): void {
    if (!this.validateForm()) return;
  
    this.isUpdating = true;
    this.errorMessage = '';
  
    this.http.put(
      `http://localhost:5000/api/edit-mp3/${this.file._id}`,
      { filename: this.file.filename.trim() },
      { withCredentials: true }
    ).subscribe({
      next: () => {
        Swal.fire({
          icon: 'success',
          title: 'Success!',
          text: 'Changes saved successfully',
          timer: 1500,
          showConfirmButton: false
        }).then(() => {
          this.router.navigate(['/home']);
        });
      },
      error: (error) => {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: error.error.message || 'Failed to update file'
        });
        this.isUpdating = false;
      }
    });
  }

  // Add this method to load available files
  loadAvailableFiles() {
    this.http.get('http://localhost:5000/api/mp3s', { 
      withCredentials: true 
    }).subscribe({
      next: (res: any) => {
        this.availableFiles = res.data.filter((f: any) => f._id !== this.file._id);
        this.showFileSelector = true;
      },
      error: (err) => {
        console.error('Error loading files:', err);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Could not load available files'
        });
      }
    });
  }

  // Add concat method
  concatMP3() {
    if (!this.selectedFileId) {
      Swal.fire({
        icon: 'warning',
        title: 'No File Selected',
        text: 'Please select a file to concatenate'
      });
      return;
    }
  
    this.isUpdating = true;
    this.http.post(
      `http://localhost:5000/api/mp3/${this.file._id}/concat`,
      { secondFileId: this.selectedFileId },
      { withCredentials: true }
    ).subscribe({
      next: (response: any) => {
        Swal.fire({
          icon: 'success',
          title: 'Success!',
          text: 'Files concatenated successfully',
          timer: 1000,
          showConfirmButton: false
        }).then(() => {
          this.selectedFileId = null;
          this.showFileSelector = false;
          this.timestamp = Date.now();
          this.loadFile(this.file._id);
          this.isUpdating = false;
        });
      },
      error: (err) => {
        console.error('Concat error:', err);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: err.error?.message || 'Failed to concatenate files'
        });
        this.isUpdating = false;
      }
    });
  }

  private validateCutTimes(): boolean {
    console.log('Validating times:', {
      startTime: this.startTime,
      endTime: this.endTime,
      duration: this.duration
    });

    // Check if values are numbers and not NaN
    if (typeof this.startTime !== 'number' || isNaN(this.startTime) ||
        typeof this.endTime !== 'number' || isNaN(this.endTime) ||
        typeof this.duration !== 'number' || isNaN(this.duration)) {
      Swal.fire({
        icon: 'error',
        title: 'Invalid Input',
        text: 'Please enter valid numbers for start and end times'
      });
      return false;
    }

    // Validate time ranges
    if (this.startTime < 0) {
      Swal.fire({
        icon: 'error',
        title: 'Invalid Start Time',
        text: 'Start time cannot be negative'
      });
      return false;
    }

    if (this.endTime <= this.startTime) {
      Swal.fire({
        icon: 'error',
        title: 'Invalid Time Range',
        text: 'End time must be greater than start time'
      });
      return false;
    }

    if (this.endTime > this.duration) {
      Swal.fire({
        icon: 'error',
        title: 'Invalid End Time',
        text: `End time cannot exceed audio duration (${this.duration.toFixed(2)} seconds)`
      });
      return false;
    }

    return true;
  }

  private validateForm(): boolean {
    if (!this.file?.filename?.trim()) {
      this.errorMessage = 'Numele fișierului nu poate fi gol!';
      return false;
    }
    return true;
  }

  private getErrorMessage(error: HttpErrorResponse): string {
    if (error.status === 0) {
      return 'Nu există conexiune la server!';
    }

    return error.error?.message || 
           error.error?.error || 
           `Eroare necunoscută (${error.status})`;
  }

  private handleInvalidId(): void {
    this.errorMessage = 'ID invalid!';
    this.loading = false;
    setTimeout(() => this.router.navigate(['/home']), 2000);
  }

  private isValidId(id: string): boolean {
    return /^[0-9a-fA-F]{24}$/.test(id);
  }
  navigateToHome(): void {
    this.router.navigate(['/home']).then(() => {;
    window.location.reload();  
    });
  }

  // Add this method to format time in seconds
  formatTime(seconds: number): string {
    if (typeof seconds !== 'number' || isNaN(seconds)) {
      return '0.0';
    }
    return seconds.toFixed(1);
  }
}