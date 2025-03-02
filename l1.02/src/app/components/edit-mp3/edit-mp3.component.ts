import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-edit-mp3',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './edit-mp3.component.html',
  styleUrls: ['./edit-mp3.component.css']
})
export class EditMp3Component implements OnInit {
  file: any = null;
  errorMessage: string = '';
  originalFilename: string = '';
  loading = true; // Adăugat pentru gestionarea stării de încărcare
  isUpdating = false; // Adăugat pentru a preveni dubla trimitere a formularului

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
  private loadFile(id: string): void {
    this.http.get(`http://localhost:5000/api/mp3/${id}/details`, { 
      withCredentials: true 
    }).subscribe({
      next: (res: any) => this.handleSuccess(res), // Elimină parametrul id de aici
      error: (err) => this.handleError(err)
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
      next: (res: any) => {
        console.log('Răspuns API brut din updateFile:', res); // Log the raw response
        this.handleUpdateSuccess(res);
      },
      error: (err) => {
        this.handleUpdateError(err);
        this.isUpdating = false;
      }
    });
  }
  

  // === Metode helper ===
  private handleSuccess(response: any): void {
    try {
      console.log('Răspuns API brut:', response);
      
      if (!response?.data || !response.data._id || !response.data.filename) {
        // Crează un HttpErrorResponse corect
        const error = new HttpErrorResponse({
          error: { message: 'Structură invalidă a răspunsului' },
          status: 500,
          statusText: 'Internal Server Error',
          url: this.route.snapshot.url.join('/')
        });
        throw error;
      }
  
      this.file = {
        _id: response.data._id,
        filename: response.data.filename,
        uploadDate: new Date(response.data.uploadDate)
      };
  
      this.originalFilename = this.file.filename;
      this.loading = false;
  
    } catch (error) {
      console.error('Eroare procesare răspuns:', error);
      if (error instanceof HttpErrorResponse) {
        this.handleError(error);
      } else {
        this.handleError(new HttpErrorResponse({
          error: { message: 'Eroare necunoscută' },
          status: 500
        }));
      }
    }
  }


  private handleError(error: HttpErrorResponse): void {
    this.loading = false;
    
    if (error.status === 401) {
      this.router.navigate(['/login']);
      return;
    }

    this.errorMessage = this.getErrorMessage(error);
    console.error('Eroare la încărcare:', error);
  }

  private handleUpdateSuccess(response: any): void {
    try {
      console.log('Răspuns API brut:', response); // Log the raw response for debugging
  
      // Parse the response based on its actual structure
      const updatedData = response.file || response; // Use the `file` field
  
      // Debugging: Log the updatedData to see its structure
      console.log('Date actualizate:', updatedData);
  
      // Validate the response structure
      if (!updatedData || !updatedData._id) {
        throw new Error('Date invalide în răspuns: Lipsește _id sau structura este incorectă');
      }
  
      // Update the component state with the new data
      this.file = {
        ...this.file,
        ...updatedData
      };
      this.originalFilename = updatedData.filename;
  
      // Show success message
      this.showSuccessAlert('Modificările au fost salvate!');
  
      // Navigate to home after 1.5 seconds
      setTimeout(() => {
        this.router.navigate(['/home']);
      }, 1500);
  
    } catch (error) {
      console.error('Eroare în handleUpdateSuccess:', error);
      this.handleUpdateError(error as HttpErrorResponse);
    } finally {
      this.isUpdating = false;
    }
  }

  
  private showSuccessAlert(message: string): void {
    const alert = document.createElement('div');
    alert.className = 'success-alert';
    alert.textContent = message;
    document.body.appendChild(alert);
    
    setTimeout(() => {
      alert.remove();
    }, 2000);
  }

  private handleUpdateError(error: HttpErrorResponse): void {
    this.isUpdating = false;
    this.errorMessage = this.getErrorMessage(error);
    console.error('Eroare la actualizare:', error);
  }

  private validateForm(): boolean {
    if (!this.file?.filename?.trim()) {
      this.errorMessage = 'Numele fișierului nu poate fi gol!';
      return false;
    }

    if (this.file.filename === this.originalFilename) {
      this.errorMessage = 'Nu s-au detectat modificări!';
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
    this.router.navigate(['/home']);
  }
}