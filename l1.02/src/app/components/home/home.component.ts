import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { Emitters } from '../../emitters/emitter';
import { Router } from '@angular/router';

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
  mp3List: any[] = []; // Lista pentru fișierele MP3

  constructor(private http: HttpClient, private router: Router) {}

  ngOnInit(): void {
    this.loadUserData();
    this.loadMP3Files(); // Încărcăm lista de fișiere la inițializare
  }
   
  editFile(fileId: string): void {
    this.router.navigate(['/edit-mp3', fileId]); // Navigare către pagina de edit
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
      next: (files: any) => {
        this.mp3List = files;
      },
      error: (err) => {
        console.error("Error loading MP3 files:", err);
        if(err.status === 401) {
          this.router.navigate(['/login']);
        } else {
          alert('Error loading files list');
        }
      }
    });
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
          this.loadMP3Files(); // Reîmprospătăm lista după upload
        },
        error: (error) => {
          console.error('Upload failed:', error);
          alert('Upload failed!');
        }
      });
  }
}