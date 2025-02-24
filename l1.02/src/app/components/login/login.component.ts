import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';


@Component({
  selector: 'app-login',
  standalone: false,
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'] // Corectare aici
})
export class LoginComponent implements OnInit{
  form: FormGroup;

  constructor(
    private formBuilder: FormBuilder,
    private http:HttpClient,
    private router: Router
  ){}
  ngOnInit(): void {
    this.form=this.formBuilder.group({
      email:'',
      password: ''
    });
  }
  submit():void{
      this.form.markAllAsTouched();
      this.form.updateValueAndValidity();
      console.log("Form status:", this.form.status);
      console.log("Form errors:", this.form.errors);
      console.log("Form controls:", this.form.controls);
    
      let user = this.form.value;
      console.log("Updated form values:", user);
    
      // Verificare câmpuri goale
      if (!user.email || !user.password) {
        Swal.fire("Error", "Please enter all the fields", "error");
        return;
      }
    
      // Validare email (Regex + Validatorul Angular)
      const validEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!validEmailRegex.test(user.email) || this.form.controls['email'].invalid) {
        Swal.fire("Error", "Please enter a valid email", "error");
        return;
      }
    
      // Trimite request-ul dacă validările sunt OK
      this.http.post("http://localhost:5000/api/login", user, { withCredentials: true })
        .subscribe(
          (res) => this.router.navigate(['/']),
          (err) => {
            Swal.fire("Error", err.error?.message || "An error occurred", "error");
          }
        );
    
      console.log("Form status:", this.form.status);
      console.log("Email control status:", this.form.controls['email'].status);
      console.log("Password control status:", this.form.controls['password'].status);
    }
}
