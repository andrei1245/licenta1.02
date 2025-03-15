import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { Emitters } from '../../emitters/emitter';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-profile',
  standalone: false,
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css']
})
export class ProfileComponent implements OnInit {
  public authenticated: boolean = false;
  public accountForm: FormGroup;
  public updateMessage: string = '';
  public updateError: string = '';

  constructor(private http: HttpClient, private fb: FormBuilder) {
    this.accountForm = this.fb.group({
      email: ['', [Validators.email]],
      old_password: ['', [Validators.required]],
      new_password: [''],
      confirm_password: ['']
    }, { validator: this.conditionalPasswordValidator });
  }

  ngOnInit(): void {
     // Get current user data
    this.http.get('http://localhost:5000/api/user', { withCredentials: true })
      .subscribe({
        next: (response: any) => {
          this.accountForm.patchValue({
            email: response.email
          });
          this.authenticated = true;
          Emitters.authEmitter.emit(true);
        },
        error: () => {
          this.authenticated = false;
          Emitters.authEmitter.emit(false);
        }
      });

    Emitters.authEmitter.subscribe((auth: boolean) => {
      this.authenticated = auth;
    });
  }

  conditionalPasswordValidator(form: FormGroup) {
    const oldPassword = form.get('old_password')?.value;
    const newPassword = form.get('new_password')?.value;
    const confirmPassword = form.get('confirm_password')?.value;

    // If new password is being set, validate all password fields
    if (newPassword || confirmPassword) {
      if (!newPassword || !confirmPassword) {
        return { incomplete: true };
      }
      if (newPassword !== confirmPassword) {
        return { mismatch: true };
      }
    }

    // If no changes are made
    if (!form.get('email')?.value && !newPassword) {
      return { noChanges: true };
    }

    return null;
  }

  onAccountUpdate(): void {
    if (this.accountForm.valid) {
      const { email, old_password, new_password } = this.accountForm.value;
      const updates: any = {
        old_password // Always include current password
      };

      if (email) updates.email = email;
      if (new_password) updates.new_password = new_password;

      this.http.put('http://localhost:5000/api/user/update', 
        updates,
        { withCredentials: true }
      ).subscribe({
        next: (response: any) => {
          Swal.fire({
            icon: 'success',
            title: 'Success!',
            text: response.message
          });
          this.accountForm.reset();
        },
        error: (error) => {
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.error.message || 'An error occurred'
          });
        }
      });
    } else {
      Swal.fire({
        icon: 'warning',
        title: 'Invalid Form',
        text: 'Please fill in all required fields correctly'
      });
    }
  }
}
