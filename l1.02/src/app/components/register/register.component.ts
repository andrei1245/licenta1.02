import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';
import { ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-register',
  standalone: false,
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css']
})
export class RegisterComponent implements OnInit {
  form: FormGroup;

  constructor(
    private formBuilder: FormBuilder,
    private http: HttpClient,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.form = this.formBuilder.group({
      email: ["", [Validators.required, Validators.email]],
      password: ["", Validators.required]
    });
  }

  submit(): void {
    this.form.markAllAsTouched();
    this.form.updateValueAndValidity();
    console.log("Form status:", this.form.status);
    console.log("Form errors:", this.form.errors);
    console.log("Form controls:", this.form.controls);
  
    let user = this.form.value;
    console.log("Updated form values:", user);
  
    
    if (!user.email || !user.password) {
      Swal.fire("Error", "Please enter all the fields", "error");
      return;
    }
  
    const validEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!validEmailRegex.test(user.email) || this.form.controls['email'].invalid) {
      Swal.fire("Error", "Please enter a valid email", "error");
      return;
    }
  
    
    this.http.post("http://localhost:5000/api/register", user, { withCredentials: true })
      .subscribe(
        () => this.router.navigate(['/']),
        (err) => {
          Swal.fire("Error", err.error?.message || "An error occurred", "error");
        }
      );
  
    console.log("Form status:", this.form.status);
    console.log("Email control status:", this.form.controls['email'].status);
    console.log("Password control status:", this.form.controls['password'].status);
  }
}