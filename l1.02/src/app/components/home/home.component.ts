import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { Emitters } from '../../emitters/emitter';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';
import { time } from 'node:console';
import { subscribe } from 'node:diagnostics_channel';

interface MP3File {
  _id: string;
  filename: string;
  uploadDate: Date;
  timestamp: number;
  duration?: number;
}

@Component({
  selector: 'app-home',
  standalone: false,
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {
  message: string = "Welcome to the MP3 uploader!";
  selectedFile: File | null = null;
  uploadedFile: string | null = null;
  mp3List: MP3File[] = [];
  currentTimestamp: number = Date.now(); // Add this property

  constructor(private http: HttpClient, private router: Router) {}

  ngOnInit(): void {
    this.loadUserData();
    this.loadMP3Files();
  }
   
  editFile(fileId: string): void {
    this.router.navigate(['/edit-mp3', fileId]); 
  }

  copyFile(fileId: string): void {
    this.http.post(`http://localhost:5000/api/mp3/${fileId}/copy`, {}, {
      withCredentials: true 
    }).subscribe({
      next: (res: any) => {
        Swal.fire({
          icon: 'success',
          title: 'File copied successfully',
          showConfirmButton: false,
          timer: 1000
        });
        this.loadMP3Files(); 
      },
      error: (error) => {
        console.error('Copy failed:', error);
        alert('Copy failed!');
      }
    });
  }

private loadUserData(): void {
    this.http.get('http://localhost:5000/api/user', { withCredentials: true })
      .subscribe({
        next: (res: any) => { 
          this.message = "Welcome"; 
          Emitters.authEmitter.emit(true);
        },
        error: (err) => {
          console.error("Error fetching user data:", err);
          this.message = "Error loading user data.";
          Emitters.authEmitter.emit(false);
        }
      });
  }


  private loadMP3Files(): void {
    this.http.get('http://localhost:5000/api/mp3s', { withCredentials: true })
    .subscribe({
      next: (res: any) => {
        const files = res.data ? res.data : res;
        this.mp3List = files.map((file: MP3File) => ({
          ...file,
          timestamp: Date.now()
        }));

        // Get duration for each audio file
        this.mp3List.forEach(file => {
          const audio = new Audio();
          let retryCount = 0;
          const maxRetries = 3;
          
          const loadAudio = () => {
            const loadHandler = () => {
              if (audio.duration && isFinite(audio.duration)) {
                console.log(`Duration for ${file.filename}:`, audio.duration);
                file.duration = audio.duration;
                cleanup();
              } else {
                retryWithDelay();
              }
            };

            const errorHandler = (err: ErrorEvent) => {
              console.error(`Error loading audio for ${file.filename}:`, err);
              retryWithDelay();
            };

            const retryWithDelay = () => {
              cleanup();
              if (retryCount < maxRetries) {
                retryCount++;
                console.log(`Retrying (${retryCount}/${maxRetries}) for ${file.filename}`);
                setTimeout(() => loadAudio(), 1000 * retryCount);
              } else {
                console.warn(`Failed to load audio for ${file.filename} after ${maxRetries} attempts`);
                file.duration = 0;
              }
            };

            const cleanup = () => {
              audio.removeEventListener('loadedmetadata', loadHandler);
              audio.removeEventListener('error', errorHandler);
            };

            audio.addEventListener('loadedmetadata', loadHandler);
            audio.addEventListener('error', errorHandler);
            
            audio.preload = 'metadata';
            audio.src = `http://localhost:5000/api/mp3/${file._id}?t=${Date.now()}`;
          };

          loadAudio();
        });
      },
      error: (err) => {
        console.error("Error loading MP3 files:", err);
        if (err.status === 401) {
          this.router.navigate(['/login']);
        } else {
          alert('Error loading files list');
        }
      }
    });
  }

deleteFile(fileId: string): void {
    console.log('Deleting file ID:', fileId);
    if (confirm('Are you sure you want to delete this file?')) {
      this.http.delete(`http://localhost:5000/api/delete-mp3/${fileId}`, { withCredentials: true })
        .subscribe({
          next: () => {
            Swal.fire({
              text: 'File deleted successfully',
              showConfirmButton: false,
              timer: 1000,
              icon: 'success'            
            });
            this.loadMP3Files(); 
          },
          error: (err) => {
            console.error('Error deleting file:', err);
            if (err.status === 404) {
              alert('File not found on the server');
            } else if (err.status === 500) {
              alert('Internal server error. Please check the backend logs.');
            } else {
              alert('Failed to delete file');
            }
          }
        });
    }
  }
  
 
  onFileSelected(event: any): void {
    const file: File = event.target.files[0];
    if (file && file.type === 'audio/mpeg') {
      this.selectedFile = file;
    } else {
      alert('Please select a valid MP3 file');
      this.selectedFile = null;
    }
  }

  uploadFile(event: Event): void {
    event.preventDefault();
    if (!this.selectedFile) {
      alert('No file selected');
      return;
    }

    const formData = new FormData();
    formData.append('mp3', this.selectedFile);

    this.http.post('http://localhost:5000/api/upload', formData, { withCredentials: true })
      .subscribe({
        next: (res: any) => {
          alert('File uploaded successfully');
          this.uploadedFile = res.file;
          this.loadMP3Files(); 
        },
        error: (error) => {
          console.error('Upload failed:', error);
          alert('Upload failed!');
        }
      });
  }


  downloadFile(fileId: string): void {
    this.http.get(`http://localhost:5000/api/mp3/${fileId}/download`, {
      responseType: 'blob',
      withCredentials: true
    }).subscribe({
      next: (blob: Blob) => {
        // Find the file info from mp3List
        const file = this.mp3List.find(f => f._id === fileId);
        if (!file) {
          alert('File information not found');
          return;
        }
  
        // Create a download link
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.filename; // Use the original filename
        document.body.appendChild(a);
        a.click();
        
        // Cleanup
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      },
      error: (error) => {
        console.error('Download error:', error);
        alert('Failed to download file');
      }
    });
  }

  navigateToRecord(): void {
    this.router.navigate(['/record']);
  }

  navigateToTTS(): void {
    this.router.navigate(['/tts']);
  }

  navigateToSTT(): void {
    this.router.navigate(['/stt']);
  }
}