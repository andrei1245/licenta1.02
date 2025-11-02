import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomeComponent } from './components/home/home.component';
import { LoginComponent } from './components/login/login.component';
import { RegisterComponent } from './components/register/register.component';
import { EditMp3Component } from './components/edit-mp3/edit-mp3.component';
import { ProfileComponent } from './components/profile/profile.component';
import { RecordComponent } from './components/record/record.component';
import { TtsComponent } from './components/tts/tts.component';
import { SttComponent } from './components/stt/stt.component';

const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'edit-mp3/:id',
    loadComponent: () => import('./components/edit-mp3/edit-mp3.component')
    .then(m => m.EditMp3Component)},
  { path: 'home',  component: HomeComponent },
  {path: 'profile',component: ProfileComponent},
  {path: 'record',component: RecordComponent},
  {path: 'tts',component: TtsComponent},
  {path: 'stt',component: SttComponent}
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
