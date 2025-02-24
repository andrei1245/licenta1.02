import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { Emitters } from '../../emitters/emitter';
import { Router } from '@angular/router';

@Component({
  selector: 'app-home',
  standalone: false,
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'] // ✅ Corectare `styleUrls`
})
export class HomeComponent implements OnInit {
  message: string = ""; // ✅

  constructor(private http: HttpClient, private router: Router) {}

  ngOnInit(): void {
    this.http.get('http://localhost:5000/api/user', { withCredentials: true })
      .subscribe(
        (res: any) => { 
          this.message = "Welcome"; 
          Emitters.authEmitter.emit(true)
        },
        (err) => {
          console.error("Error fetching user data:", err);
          this.message = "Error loading user data .";
          Emitters.authEmitter.emit(false)
        }
      );
  }
}
