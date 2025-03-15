import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { Emitters } from '../../emitters/emitter';
import { Router } from '@angular/router';

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
  message: string = "";
  selectedFile: File | null = null;
  uploadedFile: string | null = null;
  mp3List: MP3File[] = []; 

  constructor(private http: HttpClient, private router: Router) {}

  ngOnInit(): void {
   
    this.loadUserData();
    this.loadMP3Files(); 
  }
   
  editFile(fileId: string): void {
    this.router.navigate(['/edit-mp3', fileId]); 
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
          
          // Add event listeners before setting src
          const loadHandler = () => {
            if (audio.duration && isFinite(audio.duration)) {
              console.log(`Duration for ${file.filename}:`, audio.duration);
              file.duration = audio.duration;
            } else {
              console.warn(`Invalid duration for file: ${file.filename}`);
              file.duration = 0;
            }
            cleanup();
          };

          const errorHandler = (err: ErrorEvent) => {
            console.error(`Error loading audio for ${file.filename}:`, err);
            file.duration = 0;
            cleanup();
          };

          const cleanup = () => {
            audio.removeEventListener('loadedmetadata', loadHandler);
            audio.removeEventListener('error', errorHandler);
            audio.remove(); // Remove the audio element
          };

          audio.addEventListener('loadedmetadata', loadHandler);
          audio.addEventListener('error', errorHandler);
          
          // Set preload and src after adding listeners
          audio.preload = 'metadata';
          audio.src = `http://localhost:5000/api/mp3/${file._id}?t=${file.timestamp}`;
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
            alert('File deleted successfully');
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
}